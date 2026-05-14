// ============================================================
// services/uploadQueue.js
// Cola persistida en AsyncStorage. Cada ítem representa
// un formulario completo pendiente de subir al FTP.
// ============================================================
import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = 'ftp_upload_queue';

// Estados posibles de un ítem
export const ESTADO = {
  PENDIENTE: 'pendiente',
  SUBIENDO:  'subiendo',
  COMPLETADO: 'completado',
  ERROR:      'error',
};

// ── Leer toda la cola ────────────────────────────────────────
export async function leerCola() {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// ── Guardar toda la cola ─────────────────────────────────────
async function guardarCola(cola) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(cola));
}

// ── Agregar un formulario a la cola ──────────────────────────
// Devuelve el ítem creado
export async function encolar(formulario) {
  const cola = await leerCola();

  // Evitar duplicados por registro_uuid
  const yaExiste = cola.some(
    (i) => i.formulario.registro_uuid &&
           i.formulario.registro_uuid === formulario.registro_uuid &&
           i.estado !== ESTADO.COMPLETADO
  );
  if (yaExiste) return null;

  const item = {
    id:          formulario.registro_uuid || `local_${Date.now()}`,
    formulario,  // objeto completo que se pasará a subirFormularioFTP
    estado:      ESTADO.PENDIENTE,
    reintentos:  0,
    creadoEn:    new Date().toISOString(),
    ultimoError: null,
  };

  cola.push(item);
  await guardarCola(cola);
  return item;
}

// ── Actualizar estado de un ítem ─────────────────────────────
export async function actualizarEstado(id, estado, extras = {}) {
  const cola = await leerCola();
  const idx  = cola.findIndex((i) => i.id === id);
  if (idx === -1) return;

  cola[idx] = { ...cola[idx], estado, ...extras };
  await guardarCola(cola);
  return cola[idx];
}

// ── Incrementar reintentos ────────────────────────────────────
export async function incrementarReintentos(id, mensajeError) {
  const cola = await leerCola();
  const idx  = cola.findIndex((i) => i.id === id);
  if (idx === -1) return;

  cola[idx].reintentos  += 1;
  cola[idx].ultimoError  = mensajeError;
  cola[idx].estado       = cola[idx].reintentos >= 3
    ? ESTADO.ERROR      // máximo 3 intentos, luego se marca error definitivo
    : ESTADO.PENDIENTE;

  await guardarCola(cola);
  return cola[idx];
}

// ── Limpiar completados (limpieza periódica) ─────────────────
export async function limpiarCompletados() {
  const cola = await leerCola();
  const filtrada = cola.filter((i) => i.estado !== ESTADO.COMPLETADO);
  await guardarCola(filtrada);
}

// ── Reintentar un ítem en error ──────────────────────────────
export async function reintentarItem(id) {
  await actualizarEstado(id, ESTADO.PENDIENTE, {
    reintentos: 0,
    ultimoError: null,
  });
}

// ── Estadísticas rápidas para la UI ─────────────────────────
export async function obtenerEstadisticas() {
  const cola = await leerCola();
  return {
    total:      cola.length,
    pendientes: cola.filter(i => i.estado === ESTADO.PENDIENTE).length,
    subiendo:   cola.filter(i => i.estado === ESTADO.SUBIENDO).length,
    completados:cola.filter(i => i.estado === ESTADO.COMPLETADO).length,
    errores:    cola.filter(i => i.estado === ESTADO.ERROR).length,
    items:      cola, // lista completa para la pantalla de cola
  };
}