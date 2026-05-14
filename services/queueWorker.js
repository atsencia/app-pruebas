// services/queueWorker.js
import * as Network      from 'expo-network';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem   from 'expo-file-system/legacy';

import {
  leerCola,
  actualizarEstado,
  incrementarReintentos,
  ESTADO,
} from './uploadQueue';
import { subirFormularioFTP } from './FtpuploadServices';

// ── Imports opcionales (no disponibles en Expo Go / web) ─────
let BackgroundFetch = null;
let TaskManager     = null;
try {
  BackgroundFetch = require('expo-background-fetch');
  TaskManager     = require('expo-task-manager');
} catch (e) {
  console.warn('[QueueWorker] Background fetch no disponible en este entorno');
}

// ── Configuración ────────────────────────────────────────────
const TAREA_BG          = 'FTP_QUEUE_BG_TASK';
const INTERVALO_MS      = 8_000;
const MAX_PARALELOS     = 10;
const BYTES_ARCHIVO_MAX = 50 * 1024 * 1024;

let _timer     = null;
let _enProceso = new Set();
let _listeners = [];

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

// ── Guardar fotos en álbum (sin pedir permisos — ya se pidieron en el form) ──
async function guardarEnAlbum(formulario) {
  try {
    const { status } = await MediaLibrary.getPermissionsAsync(); // solo consulta
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
      } catch { /* ya existe */ }
    }
  } catch (e) {
    console.warn('[QueueWorker] guardarEnAlbum:', e.message);
  }
}

// ── Borrar archivos locales tras éxito ───────────────────────
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

// ── Timeout según peso estimado ──────────────────────────────
function timeoutParaFormulario(formulario) {
  const archivos = [
    ...(formulario.fotos        || []),
    ...(formulario.fotosFachada || []),
    ...(formulario.videos       || []),
  ];
  const pesoEstimado = archivos.length * 5 * 1024 * 1024;
  if (pesoEstimado > BYTES_ARCHIVO_MAX)      return 8 * 60_000;
  if (pesoEstimado > 20 * 1024 * 1024)      return 5 * 60_000;
  return 3 * 60_000;
}

// ── Procesar un ítem ─────────────────────────────────────────
async function procesarItem(item) {
  if (_enProceso.has(item.id)) return;
  _enProceso.add(item.id);

  await actualizarEstado(item.id, ESTADO.SUBIENDO);
  notificar({ tipo: 'inicio', id: item.id });

  const timeout = timeoutParaFormulario(item.formulario);

  const promesaSubida = (async () => {
    await guardarEnAlbum(item.formulario);
    return await subirFormularioFTP(
      item.formulario,
      (pct, msg) => notificar({ tipo: 'progreso', id: item.id, pct, msg })
    );
  })();

  const promesaTimeout = new Promise((_, reject) =>
    setTimeout(
      () => reject(new Error(`Timeout: conexión lenta o archivo muy pesado (${timeout / 60000} min)`)),
      timeout
    )
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

    if (esTimeout) {
      const sigue = await hayConexion();
      if (!sigue) notificar({ tipo: 'sin_conexion' });
    }

  } finally {
    _enProceso.delete(item.id);
  }
}

// ── Ciclo principal ──────────────────────────────────────────
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

  const slots = MAX_PARALELOS - _enProceso.size;
  if (slots <= 0) return;

  pendientes.slice(0, slots).forEach(item => procesarItem(item));
}

// ── Registrar tarea background UNA SOLA VEZ al cargar el módulo ──
// defineTask debe estar en el nivel raíz, no dentro de funciones async
if (TaskManager) {
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
    console.warn('[QueueWorker] defineTask falló:', e.message);
  }
}

// ── API pública ──────────────────────────────────────────────
export async function iniciarWorker() {
  if (_timer) return; // ya corriendo

  // Registrar background fetch si está disponible
  if (BackgroundFetch && TaskManager) {
    try {
      await BackgroundFetch.registerTaskAsync(TAREA_BG, {
        minimumInterval: 15,
        stopOnTerminate:  false,
        startOnBoot:      true,
      });
      console.log('[QueueWorker] Background fetch registrado');
    } catch (e) {
      console.warn('[QueueWorker] registerTaskAsync:', e.message);
    }
  }

  console.log('[QueueWorker] Iniciado (foreground)');
  _timer = setInterval(tick, INTERVALO_MS);
  tick();
}

export function detenerWorker() {
  if (_timer) { clearInterval(_timer); _timer = null; }
}

export function forzarProcesar() { tick(); }

export function haySubiendoActualmente() { return _enProceso.size > 0; }