// services/queueWorker.js
// Worker con: hasta 10 actas en paralelo, reintentos por timeout/peso,
// expo-background-fetch para carga con app en background/cerrada.

import * as Network         from 'expo-network';
import * as MediaLibrary    from 'expo-media-library';
import * as FileSystem      from 'expo-file-system/legacy';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager     from 'expo-task-manager';

import {
  leerCola,
  actualizarEstado,
  incrementarReintentos,
  ESTADO,
} from './uploadQueue';
import { subirFormularioFTP } from './FtpuploadServices';

// ── Configuración ────────────────────────────────────────────
const TAREA_BG          = 'FTP_QUEUE_BG_TASK';
const INTERVALO_MS      = 8_000;   // polling foreground cada 8s
const MAX_PARALELOS     = 10;      // máximo de actas simultáneas
const BYTES_ARCHIVO_MAX = 50 * 1024 * 1024; // >50 MB → timeout extendido

let _timer      = null;
let _enProceso  = new Set(); // ids actualmente subiendo
let _listeners  = [];

// ── Suscripción para la UI ───────────────────────────────────
export function suscribir(fn) {
  _listeners.push(fn);
  return () => { _listeners = _listeners.filter(l => l !== fn); };
}
function notificar(evento) {
  _listeners.forEach(fn => fn(evento));
}

// ── Verificar conectividad ───────────────────────────────────
async function hayConexion() {
  try {
    const estado = await Network.getNetworkStateAsync();
    return !!(
      estado.isConnected &&
      estado.isInternetReachable &&
      estado.type !== Network.NetworkStateType.NONE &&
      estado.type !== Network.NetworkStateType.UNKNOWN
    );
  } catch { return false; }
}

// ── Guardar fotos en álbum del dispositivo ───────────────────
// Se llama ANTES de subir — el técnico siempre conserva copia local
async function guardarEnAlbum(formulario) {
  try {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') return;

    const nombreAlbum = `Acta - ${
      (formulario.direccion || formulario.extra?.direccion || 'Sin dirección')
        .replace(/[/\\:*?"<>|]/g, '')
        .substring(0, 50)
    }`;

    const fotos = [
      ...(formulario.fotos        || []),
      ...(formulario.fotosFachada || []),
    ];

    for (const foto of fotos) {
      const uri = foto.uri ?? foto;
      if (!uri?.startsWith('file://')) continue;
      try {
        const asset = await MediaLibrary.createAssetAsync(uri);
        await MediaLibrary.createAlbumAsync(nombreAlbum, asset, false);
      } catch { /* ya existe en el álbum */ }
    }
  } catch (e) {
    console.warn('[QueueWorker] guardarEnAlbum:', e.message);
  }
}

// ── Borrar archivos locales originales tras éxito ────────────
async function borrarArchivosLocales(formulario) {
  const uris = [
    ...(formulario.fotos        || []).map(f => f.uri ?? f),
    ...(formulario.fotosFachada || []).map(f => f.uri ?? f),
    ...(formulario.videos       || []).map(v => v.uri ?? v),
  ];
  for (const uri of uris) {
    if (!uri?.startsWith('file://')) continue;
    try { await FileSystem.deleteAsync(uri, { idempotent: true }); } catch {}
  }
}

// ── Calcular timeout según peso total estimado ───────────────
// Si algún archivo es muy pesado, le damos más margen antes de reintentar
function timeoutParaFormulario(formulario) {
  const archivos = [
    ...(formulario.fotos        || []),
    ...(formulario.fotosFachada || []),
    ...(formulario.videos       || []),
  ];
  const pesoEstimado = archivos.length * 5 * 1024 * 1024; // estimado ~5 MB por archivo
  // >50 MB → 8 min | >20 MB → 5 min | resto → 3 min
  if (pesoEstimado > BYTES_ARCHIVO_MAX) return 8 * 60_000;
  if (pesoEstimado > 20 * 1024 * 1024) return 5 * 60_000;
  return 3 * 60_000;
}

// ── Procesar un ítem individual ──────────────────────────────
async function procesarItem(item) {
  if (_enProceso.has(item.id)) return; // ya está subiendo
  _enProceso.add(item.id);

  await actualizarEstado(item.id, ESTADO.SUBIENDO);
  notificar({ tipo: 'inicio', id: item.id });

  const timeout = timeoutParaFormulario(item.formulario);

  // Race: subida vs timeout generoso por peso
  const promesaSubida = (async () => {
    await guardarEnAlbum(item.formulario);
    return await subirFormularioFTP(
      item.formulario,
      (pct, msg) => notificar({ tipo: 'progreso', id: item.id, pct, msg })
    );
  })();

  const promesaTimeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Timeout: el archivo es muy pesado o la conexión es lenta (${timeout / 60000} min)`)), timeout)
  );

  try {
    const resultado = await Promise.race([promesaSubida, promesaTimeout]);
    if (!resultado.success) throw new Error(resultado.mensaje);

    await actualizarEstado(item.id, ESTADO.COMPLETADO, {
      completadoEn: new Date().toISOString(),
    });
    await borrarArchivosLocales(item.formulario);
    notificar({ tipo: 'completado', id: item.id, carpeta: resultado.carpeta });

  } catch (error) {
    console.error('[QueueWorker] Error en item', item.id, ':', error.message);

    // Si fue timeout de conexión (no de peso), volver a PENDIENTE inmediatamente
    const esTimeout = error.message.toLowerCase().includes('timeout');
    const actualizado = await incrementarReintentos(item.id, error.message);

    notificar({
      tipo:       'error',
      id:         item.id,
      mensaje:    error.message,
      reintentos: actualizado?.reintentos ?? 0,
      definitivo: actualizado?.estado === ESTADO.ERROR,
      esTimeout,
    });

    // Si fue timeout de conexión, verificar red y marcar pendiente para reintentar pronto
    if (esTimeout) {
      const sigue = await hayConexion();
      if (!sigue) notificar({ tipo: 'sin_conexion' });
    }

  } finally {
    _enProceso.delete(item.id);
  }
}

// ── Ciclo principal (procesa hasta MAX_PARALELOS a la vez) ───
async function tick() {
  const conexion = await hayConexion();
  if (!conexion) {
    notificar({ tipo: 'sin_conexion' });
    return;
  }

  const cola = await leerCola();
  const pendientes = cola.filter(
    i => i.estado === ESTADO.PENDIENTE && !_enProceso.has(i.id)
  );

  if (pendientes.length === 0) return;

  // Lanzar en paralelo respetando el límite
  const slots = MAX_PARALELOS - _enProceso.size;
  if (slots <= 0) return;

  const lote = pendientes.slice(0, slots);
  // No await — se lanzan en paralelo, cada una gestiona su propio estado
  lote.forEach(item => procesarItem(item));
}

// ── Background Task (app cerrada / en background) ────────────
TaskManager.defineTask(TAREA_BG, async () => {
  try {
    await tick();
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// ── API pública ──────────────────────────────────────────────
export async function iniciarWorker() {
  if (_timer) return; // ya corriendo

  // 1. Registrar tarea de background
  // ── Background Task ──────────────────────────────────────────
// defineTask DEBE llamarse antes de registerTaskAsync, pero fuera de async
// Lo envolvemos en un try/catch por si TaskManager no está disponible
try {
  TaskManager.defineTask(TAREA_BG, async () => {
    try {
      await tick();
      return BackgroundFetch.BackgroundFetchResult.NewData;
    } catch {
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }
  });
} catch (e) {
  console.warn('[QueueWorker] TaskManager no disponible:', e.message);
}

  // 2. Polling en foreground
  console.log('[QueueWorker] Iniciado (foreground)');
  _timer = setInterval(tick, INTERVALO_MS);
  tick(); // ejecutar inmediatamente
}

export function detenerWorker() {
  if (_timer) { clearInterval(_timer); _timer = null; }
}

export function forzarProcesar() { tick(); }

export function haySubiendoActualmente() { return _enProceso.size > 0; }