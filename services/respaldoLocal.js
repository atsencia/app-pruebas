// ============================================================
// services/respaldoLocal.js
// Respaldo local de los archivos de un acta mientras está en la cola.
//
// Las fotos (con marca de agua), videos y documentos nacen en la carpeta
// CACHÉ de la app, que Android puede vaciar solo cuando falta espacio (o el
// usuario con "Borrar caché"). Si eso pasa con un envío pendiente, sus
// archivos se pierden. Por eso, al encolar, se copian a un lugar persistente y
// se borran solo cuando el backend confirma que la carga está completa:
//
//  1. Carpeta que el usuario elige en el almacenamiento del teléfono (visible
//     en el gestor de archivos, sobrevive a "Borrar datos" y a desinstalar).
//     Se copia por flujo con el módulo nativo `actas-storage`.
//  2. Si no eligió carpeta, perdió el permiso o el módulo nativo no está:
//     `documentDirectory/pendientes/` (interno de la app, Android no lo vacía).
//
// Cada acta tiene su propia subcarpeta: acta_<ms>_<rand>/
// ============================================================
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { Directory } from 'expo-file-system';
import ActasStorage from '@/modules/actas-storage';

const RAIZ_PRIVADA = `${FileSystem.documentDirectory}pendientes/`;
const CLAVE_CARPETA = 'respaldo_carpeta_uri';
const UN_DIA_MS = 24 * 60 * 60 * 1000;

// La carpeta elegida debe estar en el almacenamiento del teléfono o la SD: la
// subida la lee con el proveedor de archivos del sistema, no con Drive u otros.
const PROVEEDOR_ALMACENAMIENTO = 'com.android.externalstorage.documents';

const CATEGORIAS = [
  { key: 'fotos',                 prefijo: 'foto',      extDefecto: 'jpg' },
  { key: 'fotosFachada',          prefijo: 'fachada',   extDefecto: 'jpg' },
  { key: 'videos',                prefijo: 'video',     extDefecto: 'mp4' },
  { key: 'documentosAdicionales', prefijo: 'documento', extDefecto: 'pdf' },
];

const MIME = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic',
  mp4: 'video/mp4', mov: 'video/quicktime', '3gp': 'video/3gpp', mkv: 'video/x-matroska',
  pdf: 'application/pdf', doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};
const mimeDe = (ext) => MIME[ext] ?? 'application/octet-stream';

const esLocal = (uri) =>
  typeof uri === 'string' && (uri.startsWith('file://') || uri.startsWith('content://'));

function extension(uri, defecto) {
  const m = uri.split('?')[0].match(/\.([A-Za-z0-9]{2,5})$/);
  return (m ? m[1] : defecto).toLowerCase();
}

async function borrarDirPrivado(dir) {
  try { await FileSystem.deleteAsync(dir, { idempotent: true }); } catch {}
}

const sinBarraFinal = (uri) => uri.replace(/\/+$/, '');

// ── Carpeta elegida por el usuario ────────────────────────────

// { uri, nombre } si hay carpeta elegida y la app aún tiene permiso; si no, null.
export async function obtenerCarpetaRespaldo() {
  if (!ActasStorage) return null;
  try {
    const uri = await AsyncStorage.getItem(CLAVE_CARPETA);
    if (!uri) return null;
    if (!(await ActasStorage.tienePermiso(uri))) return null;
    return { uri, nombre: (await ActasStorage.nombreCarpeta(uri)) || 'Carpeta elegida' };
  } catch {
    return null;
  }
}

// Abre el selector del sistema. Devuelve { uri, nombre } o null si canceló o
// eligió algo que no sirve.
export async function elegirCarpetaRespaldo() {
  if (!ActasStorage) {
    Alert.alert('No disponible', 'Esta versión de la app no incluye la carpeta de respaldo. Instala la versión más reciente.');
    return null;
  }
  let dir;
  try {
    dir = await Directory.pickDirectoryAsync();
  } catch {
    return null; // canceló
  }
  const uri = sinBarraFinal(dir.uri);

  if (!uri.startsWith(`content://${PROVEEDOR_ALMACENAMIENTO}/`)) {
    Alert.alert('Carpeta no válida', 'Elige una carpeta del almacenamiento del teléfono (no de Google Drive u otra nube).');
    return null;
  }
  if (!(await ActasStorage.tienePermiso(uri))) {
    Alert.alert('Sin permiso', 'No se pudo obtener acceso de escritura a esa carpeta. Elige otra.');
    return null;
  }
  await AsyncStorage.setItem(CLAVE_CARPETA, uri);
  return { uri, nombre: (await ActasStorage.nombreCarpeta(uri)) || 'Carpeta elegida' };
}

let _yaPregunto = false;

// Antes de encolar: si no hay carpeta elegida (o perdió el permiso) se le
// ofrece elegirla, una vez por sesión. Si dice que no, se usa la carpeta privada.
export async function asegurarCarpetaRespaldo() {
  if (!ActasStorage || _yaPregunto) return;
  if (await obtenerCarpetaRespaldo()) return;
  _yaPregunto = true;

  await new Promise((resolve) => {
    Alert.alert(
      'Guardar copia de los archivos',
      'Elige una carpeta del teléfono donde guardar una copia de las fotos, videos y documentos mientras el acta se sube. ' +
      'Así no se pierden si el envío tarda, y la copia se borra sola cuando el servidor confirma la carga.',
      [
        { text: 'Ahora no', style: 'cancel', onPress: () => resolve() },
        { text: 'Elegir carpeta', onPress: () => { elegirCarpetaRespaldo().finally(resolve); } },
      ],
      { cancelable: false }
    );
  });
}

// ── Respaldo ──────────────────────────────────────────────────

// Recorre los archivos locales del formulario, copia cada uno con `copiarUno` y
// devuelve un formulario nuevo con las URIs de las copias.
async function copiarArchivos(formulario, copiarUno) {
  const originales = [];
  const nuevo = { ...formulario };

  for (const { key, prefijo, extDefecto } of CATEGORIAS) {
    const items = formulario[key];
    if (!Array.isArray(items) || items.length === 0) continue;

    nuevo[key] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const uri  = typeof item === 'string' ? item : item?.uri;

      // Remotas (edición de un registro) no se tocan.
      if (!esLocal(uri)) { nuevo[key].push(item); continue; }

      const ext     = extension(uri, extDefecto);
      const nombre  = `${prefijo}_${String(i + 1).padStart(3, '0')}.${ext}`;
      const destino = await copiarUno(uri, nombre, mimeDe(ext));

      originales.push(uri);
      nuevo[key].push(typeof item === 'string' ? destino : { ...item, uri: destino });
    }
  }
  return { nuevo, originales };
}

async function respaldarEnCarpetaElegida(formulario, arbolUri) {
  const subcarpeta = `acta_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  let dirUri = null;

  try {
    const { nuevo, originales } = await copiarArchivos(formulario, async (uri, nombre, mime) => {
      const r = await ActasStorage.copiarAArbol(uri, arbolUri, subcarpeta, nombre, mime);
      dirUri = r.dirUri;

      // Verificar que se copió completo (cuando se conoce el tamaño del origen).
      const origen = await FileSystem.getInfoAsync(uri);
      if (origen.exists && origen.size && origen.size !== r.bytes) {
        throw new Error(`la copia de ${nombre} quedó incompleta (${r.bytes} de ${origen.size} bytes)`);
      }
      if (!r.bytes) throw new Error(`la copia de ${nombre} quedó vacía`);
      return r.uri;
    });

    if (originales.length === 0) return { formulario, originales: [] };
    nuevo.respaldoLocal = { tipo: 'saf', dir: dirUri, arbol: arbolUri };
    return { formulario: nuevo, originales };
  } catch (e) {
    if (dirUri) { try { await ActasStorage.eliminar(dirUri); } catch {} }
    throw e;
  }
}

async function respaldarEnCarpetaPrivada(formulario) {
  const dir = `${RAIZ_PRIVADA}acta_${Date.now()}_${Math.random().toString(36).slice(2, 8)}/`;
  try {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });

    const { nuevo, originales } = await copiarArchivos(formulario, async (uri, nombre) => {
      const destino = `${dir}${nombre}`;
      await FileSystem.copyAsync({ from: uri, to: destino });
      const info = await FileSystem.getInfoAsync(destino);
      if (!info.exists || !info.size) throw new Error(`la copia de ${nombre} quedó vacía`);
      return destino;
    });

    if (originales.length === 0) { await borrarDirPrivado(dir); return { formulario, originales: [] }; }
    nuevo.respaldoLocal = { tipo: 'privada', dir };
    return { formulario: nuevo, originales };
  } catch (e) {
    await borrarDirPrivado(dir);
    throw e;
  }
}

// Copia los archivos locales del formulario a su carpeta de respaldo y devuelve
// un formulario nuevo cuyas URIs apuntan a esas copias (más `respaldoLocal` para
// poder borrarla al confirmar). `originales` son las URIs de origen: quien
// encole debe liberarlas con `liberarOriginales` SOLO si el encolado salió bien.
// Si algo falla no se bloquea el envío: se devuelve el formulario tal cual (sin
// respaldo), como funcionaba antes.
export async function resguardarArchivos(formulario) {
  if (formulario.respaldoLocal) return { formulario, originales: [] }; // ya respaldado

  const carpeta = await obtenerCarpetaRespaldo();
  if (carpeta) {
    try {
      return await respaldarEnCarpetaElegida(formulario, carpeta.uri);
    } catch (e) {
      console.warn('[RespaldoLocal] falló la carpeta elegida, se usa la privada:', e?.message);
    }
  }

  try {
    return await respaldarEnCarpetaPrivada(formulario);
  } catch (e) {
    console.warn('[RespaldoLocal] no se pudo respaldar, se usan los archivos originales:', e?.message);
    return { formulario, originales: [] };
  }
}

// Borra los originales (solo los que están en la caché de la app, que de todos
// modos es evictable) una vez que el acta quedó encolada con su respaldo.
export async function liberarOriginales(originales) {
  const cache = FileSystem.cacheDirectory;
  for (const uri of originales || []) {
    if (!cache || !uri.startsWith(cache)) continue;
    try { await FileSystem.deleteAsync(uri, { idempotent: true }); } catch {}
  }
}

// Borra la carpeta de respaldo de un acta (al confirmarse la carga, o si el
// encolado no se completó).
export async function borrarRespaldo(formulario) {
  const r = formulario?.respaldoLocal;
  if (!r?.dir) return;

  if (r.tipo === 'saf') {
    try {
      if (ActasStorage) await ActasStorage.eliminar(r.dir);
    } catch (e) {
      console.warn('[RespaldoLocal] no se pudo borrar la carpeta elegida:', e?.message);
    }
  } else if (r.dir.startsWith(RAIZ_PRIVADA)) {
    await borrarDirPrivado(r.dir);
  }
}

// Borra carpetas de respaldo privadas que ningún ítem de la cola referencia
// (p. ej. la app se cerró entre copiar y encolar). Solo las de más de un día,
// para no tocar una que se está creando ahora mismo. Las de la carpeta elegida
// por el usuario no se tocan: son suyas.
export async function limpiarRespaldosHuerfanos(cola) {
  try {
    const info = await FileSystem.getInfoAsync(RAIZ_PRIVADA);
    if (!info.exists) return;

    const enUso = new Set(
      (cola || []).map((i) => i.formulario?.respaldoLocal?.dir).filter(Boolean)
    );
    for (const nombre of await FileSystem.readDirectoryAsync(RAIZ_PRIVADA)) {
      const dir = `${RAIZ_PRIVADA}${nombre}/`;
      if (enUso.has(dir)) continue;
      const creadaEn = Number(nombre.split('_')[1]);
      if (Number.isFinite(creadaEn) && Date.now() - creadaEn < UN_DIA_MS) continue;
      await borrarDirPrivado(dir);
    }
  } catch (e) {
    console.warn('[RespaldoLocal] limpiarRespaldosHuerfanos:', e?.message);
  }
}
