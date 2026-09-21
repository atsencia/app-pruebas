// services/queueWorker.js
import { AppState } from 'react-native';
import * as Network      from 'expo-network';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem   from 'expo-file-system/legacy';
import * as Notifications from 'expo-notifications';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

import {
  leerCola,
  actualizarEstado,
  incrementarReintentos,
  ESTADO,
} from './uploadQueue';
import { subirFormularioFTP, validarSubidaBackend } from './FtpuploadServices';
import { borrarRespaldo, limpiarRespaldosHuerfanos } from './respaldoLocal';

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

// ── Aviso al pasar a segundo plano con una subida activa ─────
// El SFTP corre en el hilo de la app: si el SO la suspende (pantalla
// bloqueada, usuario cambia de app, fabricante agresivo con la batería),
// la transferencia muere sin aviso y el ítem queda huérfano (ver tick()).
// No hay forma de evitar eso de raíz sin mover la subida a HTTP(S) con
// background upload nativo, así que mientras tanto avisamos con:
//  1) activateKeepAwakeAsync durante cada subida — evita que la pantalla
//     se bloquee sola, la causa más común de interrupción.
//  2) una notificación local apenas la app deja de estar en foreground
//     con una subida en curso — es la única forma de que el aviso llegue
//     si el usuario ya salió de la app.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList:   true,
    shouldPlaySound:  false,
    shouldSetBadge:   false,
  }),
});

let _permisoNotifPedido = false;
async function asegurarPermisoNotificacion() {
  if (_permisoNotifPedido) return;
  _permisoNotifPedido = true;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') await Notifications.requestPermissionsAsync();
  } catch (e) {
    console.warn('[QueueWorker] No se pudo pedir permiso de notificaciones:', e.message);
  }
}

async function avisarSegundoPlanoConSubida() {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Hay una subida en curso',
        body:  'Si cerrás la app o el celular la manda a segundo plano ahora, la subida se puede interrumpir y va a tener que reintentar sola.',
      },
      trigger: null,
    });
  } catch (e) {
    console.warn('[QueueWorker] No se pudo mostrar el aviso de segundo plano:', e.message);
  }
}

AppState.addEventListener('change', (siguienteEstado) => {
  if (siguienteEstado !== 'active' && _enProceso.size > 0) {
    avisarSegundoPlanoConSubida();
  }
});

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
// Solo se llama cuando el backend confirmó la carga completa. Borra la carpeta
// de respaldo del acta (si tenía) y cualquier archivo local que siga suelto
// (actas encoladas antes del respaldo o cuyo respaldo no se pudo crear).
async function borrarArchivosLocales(formulario) {
  await borrarRespaldo(formulario);

  const uris = [
    ...(formulario.fotos        || []).map(f => f.uri ?? f),
    ...(formulario.fotosFachada || []).map(f => f.uri ?? f),
    ...(formulario.videos       || []).map(v => v.uri ?? v),
    ...(formulario.documentosAdicionales || []).map(d => d.uri ?? d),
  ];
  for (const uri of uris) {
    if (!uri?.startsWith('file://')) continue;
    try { await FileSystem.deleteAsync(uri, { idempotent: true }); } catch {}
  }
}

// ── Confirmar contra el backend tras la subida FTP ───────────
// El FTPClient ya verificó tamaños durante la subida, así que apenas
// termina normalmente el backend ya ve todo — unos pocos reintentos
// cortos alcanzan. Si no confirma en ese lapso, no se asume ni éxito
// ni error: el ítem queda en VERIFICANDO y sigue reintentándose desde
// tick() sin volver a subir nada.
const INTENTOS_VALIDACION_INICIAL = 4;
const ESPERA_VALIDACION_MS = 3000;

function esperar(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function confirmarConBackend(carpeta, token) {
  let ultimo = { ok: false, completo: false };
  for (let i = 0; i < INTENTOS_VALIDACION_INICIAL; i++) {
    ultimo = await validarSubidaBackend(carpeta, token);
    if (ultimo.completo) return ultimo;
    await esperar(ESPERA_VALIDACION_MS);
  }
  return ultimo;
}

// ── Procesar un ítem ─────────────────────────────────────────
async function procesarItem(item) {
  if (_enProceso.has(item.id)) return;
  _enProceso.add(item.id);

  await actualizarEstado(item.id, ESTADO.SUBIENDO);
  notificar({ tipo: 'inicio', id: item.id });

  const tagKeepAwake = `subida-${item.id}`;
  await asegurarPermisoNotificacion();
  await activateKeepAwakeAsync(tagKeepAwake).catch(() => {});

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

    notificar({ tipo: 'verificando', id: item.id });
    const confirmacion = await confirmarConBackend(resultado.carpeta, item.token);

    if (confirmacion.completo) {
      await actualizarEstado(item.id, ESTADO.COMPLETADO, {
        completadoEn: new Date().toISOString(),
      });
      await borrarArchivosLocales(item.formulario);
      notificar({ tipo: 'completado', id: item.id, carpeta: resultado.carpeta });
    } else {
      // El FTP terminó bien pero el backend todavía no confirma la carpeta
      // como completa (ej. .done tardó en llegar, o faltó algún archivo).
      // No se borra nada local todavía ni se marca error: se reintenta la
      // validación (sin re-subir) en cada tick hasta que el backend confirme.
      await actualizarEstado(item.id, ESTADO.VERIFICANDO, {
        carpetaFtp: resultado.carpeta,
        ultimaVerificacion: new Date().toISOString(),
        ultimoErrorVerificacion: confirmacion.error || (confirmacion.faltantes?.length
          ? `Faltan archivos: ${confirmacion.faltantes.join(', ')}`
          : 'El servidor aún no confirma la carga completa.'),
      });
      notificar({
        tipo: 'pendiente_verificacion',
        id: item.id,
        carpeta: resultado.carpeta,
        mensaje: confirmacion.error || 'Subida enviada, esperando confirmación del servidor...',
      });
    }

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
    await deactivateKeepAwake(tagKeepAwake).catch(() => {});
  }
}

// ── Reverificar un ítem que ya se subió pero el backend no había
//    confirmado todavía — NO vuelve a subir nada por FTP, solo
//    re-consulta /validar. ──────────────────────────────────────
async function reverificarItem(item) {
  if (_enProceso.has(item.id)) return;
  _enProceso.add(item.id);

  try {
    const carpeta = item.carpetaFtp || item.id;
    const confirmacion = await validarSubidaBackend(carpeta, item.token);

    if (confirmacion.completo) {
      await actualizarEstado(item.id, ESTADO.COMPLETADO, {
        completadoEn: new Date().toISOString(),
      });
      await borrarArchivosLocales(item.formulario);
      notificar({ tipo: 'completado', id: item.id, carpeta });
    } else {
      await actualizarEstado(item.id, ESTADO.VERIFICANDO, {
        ultimaVerificacion: new Date().toISOString(),
        ultimoErrorVerificacion: confirmacion.error || (confirmacion.faltantes?.length
          ? `Faltan archivos: ${confirmacion.faltantes.join(', ')}`
          : 'El servidor aún no confirma la carga completa.'),
      });
    }
  } catch (e) {
    console.warn('[QueueWorker] reverificarItem:', e.message);
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

  let cola = await leerCola();

  // ── Recuperar ítems huérfanos ─────────────────────────────
  // Un ítem queda en SUBIENDO solo mientras su promesa de subida
  // sigue corriendo en _enProceso. Si la app se cerró o el SO la
  // mató a mitad de una transferencia larga (ej. video pesado),
  // la promesa nunca resuelve ni rechaza: el ítem queda grabado
  // como SUBIENDO en AsyncStorage para siempre y jamás se retoma,
  // porque tick() solo mira pendientes/verificando.
  // Al reiniciar, _enProceso arranca vacío, así que cualquier
  // ítem en SUBIENDO que no esté ahí es huérfano de una sesión
  // anterior: se reencola (respetando el máximo de reintentos).
  const huerfanos = cola.filter(
    i => i.estado === ESTADO.SUBIENDO && !_enProceso.has(i.id)
  );
  if (huerfanos.length > 0) {
    for (const item of huerfanos) {
      await incrementarReintentos(
        item.id,
        'Subida interrumpida (la app se cerró o pasó a segundo plano durante la transferencia). Reintentando...'
      );
      notificar({ tipo: 'huerfano_recuperado', id: item.id });
    }
    cola = await leerCola();
  }

  const verificando = cola.filter(
    i => i.estado === ESTADO.VERIFICANDO && !_enProceso.has(i.id)
  );
  verificando.forEach(item => reverificarItem(item));

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
  // Carpetas de respaldo que ningún envío de la cola referencia (una vez por sesión).
  leerCola().then(limpiarRespaldosHuerfanos).catch(() => {});
  _timer = setInterval(tick, INTERVALO_MS);
  tick();
}

export function detenerWorker() {
  if (_timer) { clearInterval(_timer); _timer = null; }
}

export function forzarProcesar() { tick(); }

export function haySubiendoActualmente() { return _enProceso.size > 0; }