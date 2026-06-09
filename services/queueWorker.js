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
const TAREA_BG      = 'FTP_QUEUE_BG_TASK';
const INTERVALO_MS  = 8_000;

// ✅ Reducido a 2 subidas paralelas.
// Con 10 paralelos y archivos de 30-100 MB cada uno, el ancho de banda
// se divide entre todos y ninguno termina a tiempo.
// Con 2, cada subida tiene banda suficiente para completar.
const MAX_PARALELOS = 2;

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

// ── Guardar fotos en álbum ───────────────────────────────────
async function guardarEnAlbum(formulario) {
  try {
    const { status } = await MediaLibrary.getPermissionsAsync();
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

// ── Procesar un ítem ─────────────────────────────────────────
async function procesarItem(item) {
  if (_enProceso.has(item.id)) return;
  _enProceso.add(item.id);

  await actualizarEstado(item.id, ESTADO.SUBIENDO);
  notificar({ tipo: 'inicio', id: item.id });

  try {
    // ✅ Sin Promise.race ni timeout arbitrario.
    //
    // Antes: un timeout de 3-8 min mataba la subida aunque el FTPClient
    //        estuviera funcionando bien. Con videos pesados por red móvil
    //        eso era insuficiente y lanzaba el error 226 falso.
    //
    // Ahora: la subida corre sin límite de tiempo desde el worker.
    //        El único control de tiempo está en FTPClient.js donde
    //        TIMEOUT_TRANSFER = 300_000 ms (5 min) por archivo individual,
    //        que es el lugar correcto para manejarlo.
    //
    // Si la red cae, el FTPClient lanzará su propio error de socket/timeout
    // y llegará aquí como catch normal — sin matar subidas válidas.

    await guardarEnAlbum(item.formulario);

    const resultado = await subirFormularioFTP(
      item.formulario,
      (pct, msg) => notificar({ tipo: 'progreso', id: item.id, pct, msg }),
      item.token  // ← agregar acá
    );

    if (!resultado.success) throw new Error(resultado.mensaje);

    await actualizarEstado(item.id, ESTADO.COMPLETADO, {
      completadoEn: new Date().toISOString(),
    });
    await borrarArchivosLocales(item.formulario);
    notificar({ tipo: 'completado', id: item.id, carpeta: resultado.carpeta });

  } catch (error) {
    console.error('[QueueWorker] Error en item', item.id, ':', error.message);

    const esSinConexion = error.message.toLowerCase().includes('timeout') ||
                          error.message.toLowerCase().includes('network') ||
                          error.message.toLowerCase().includes('conexión') ||
                          error.message.toLowerCase().includes('socket');

    const actualizado = await incrementarReintentos(item.id, error.message);

    notificar({
      tipo:       'error',
      id:         item.id,
      mensaje:    error.message,
      reintentos: actualizado?.reintentos ?? 0,
      definitivo: actualizado?.estado === ESTADO.ERROR,
      esTimeout:  esSinConexion,
    });

    if (esSinConexion) {
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

// ── Registrar tarea background ───────────────────────────────
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
  if (_timer) return;

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