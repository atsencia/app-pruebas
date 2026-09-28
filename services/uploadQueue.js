// ============================================================
// services/uploadQueue.js
// Cola persistida en AsyncStorage. Cada ítem representa
// un formulario completo pendiente de subir al FTP.
// ============================================================
import AsyncStorage from '@react-native-async-storage/async-storage';
import { generarIDUnico } from './FtpuploadServices';
import { borrarRespaldo } from './respaldoLocal';

const QUEUE_KEY = 'ftp_upload_queue';

// Estados posibles de un ítem
export const ESTADO = {
  PENDIENTE: 'pendiente',
  SUBIENDO:  'subiendo',
  // Los archivos ya llegaron al FTP (.done subido) pero el backend
  // todavía no confirma que la carpeta esté completa — se sigue
  // reintentando la validación en cada tick, sin re-subir nada.
  VERIFICANDO: 'verificando',
  COMPLETADO: 'completado',
  ERROR:      'error',
};

// ── Leer toda la cola ────────────────────────────────────────
export async function leerCola() {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const cola = raw ? JSON.parse(raw) : [];
    // Colas de versiones anteriores: el reenvío de un acta devuelta quedaba
    // con el mismo id que el envío original y nunca avanzaba (ver encolar()).
    // Se le da un id propio (determinístico, así no cambia entre lecturas).
    const vistos = new Set();
    let cambio = false;
    cola.forEach((item, idx) => {
      if (vistos.has(item.id)) {
        item.id = `${item.id}__dup${idx}`;
        cambio = true;
      }
      vistos.add(item.id);
    });
    if (cambio) await guardarCola(cola);
    return cola;
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
export async function encolar(formulario, token = null) {
  const cola = await leerCola();

  // El ID de la carpeta se fija UNA vez, acá. Antes se inventaba en cada
  // llamada a subirFormularioFTP, así que cada reintento de la cola (o la
  // recuperación de una subida que se cortó) creaba otra carpeta en el
  // servidor y el processor la registraba como un acta nueva: actas
  // duplicadas, la primera a medias en 'borrador'. Con el ID fijo, un
  // reintento vuelve a escribir en la misma carpeta.
  if (!formulario.registro_uuid) {
    formulario = { ...formulario, registro_uuid: generarIDUnico() };
  }

  // Un acta que ya se había enviado desde este teléfono (p. ej. la devolvieron
  // y se corrige) deja su envío anterior en la cola, marcado 'completado',
  // con el mismo registro_uuid. Antes el nuevo envío se agregaba con el mismo
  // id y todo lo que actualiza por id (actualizarEstado, incrementarReintentos)
  // pegaba en el ítem viejo: el nuevo quedaba 'pendiente' para siempre y se
  // volvía a subir en cada tick ("se queda cargando y nunca sube"). Ahora el
  // envío nuevo REEMPLAZA a los anteriores de esa acta que no estén en curso
  // (completados, en error o todavía pendientes) y lleva un id propio.
  const uuid = formulario.registro_uuid;
  const reemplazables = [ESTADO.COMPLETADO, ESTADO.ERROR, ESTADO.PENDIENTE];
  const reemplazados = cola.filter(
    (i) => i.formulario.registro_uuid === uuid && reemplazables.includes(i.estado)
  );
  const restante = cola.filter((i) => !reemplazados.includes(i));

  const item = {
    id:          `${uuid}__${Date.now()}`,
    formulario,
    token,        // ← agregar acá
    estado:      ESTADO.PENDIENTE,
    reintentos:  0,
    creadoEn:    new Date().toISOString(),
    ultimoError: null,
  };

  restante.push(item);
  await guardarCola(restante);

  // La copia local de un envío reemplazado que no llegó a completarse ya no
  // la referencia nadie (el nuevo envío trae su propia copia).
  for (const viejo of reemplazados) {
    if (viejo.estado !== ESTADO.COMPLETADO) {
      await borrarRespaldo(viejo.formulario).catch(() => {});
    }
  }
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
    verificando:cola.filter(i => i.estado === ESTADO.VERIFICANDO).length,
    completados:cola.filter(i => i.estado === ESTADO.COMPLETADO).length,
    errores:    cola.filter(i => i.estado === ESTADO.ERROR).length,
    items:      cola, // lista completa para la pantalla de cola
  };
}