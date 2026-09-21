// ============================================================
// services/respaldoLocal.js
// Respaldo local de los archivos de un acta mientras está en la cola.
//
// Las fotos (con marca de agua), videos y documentos nacen en la carpeta
// CACHÉ de la app, que Android puede vaciar solo cuando falta espacio (o el
// usuario con "Borrar caché"). Si eso pasa con un envío pendiente, sus
// archivos se pierden. Aquí se copian a `documentDirectory` (almacenamiento
// interno persistente de la app, que Android no vacía) y se borran solo
// cuando el backend confirma que la carga está completa.
//
// Cada acta tiene su propia carpeta: pendientes/acta_<ms>_<rand>/
// ============================================================
import * as FileSystem from 'expo-file-system/legacy';

const RAIZ = `${FileSystem.documentDirectory}pendientes/`;
const UN_DIA_MS = 24 * 60 * 60 * 1000;

const CATEGORIAS = [
  { key: 'fotos',                 prefijo: 'foto',      extDefecto: 'jpg' },
  { key: 'fotosFachada',          prefijo: 'fachada',   extDefecto: 'jpg' },
  { key: 'videos',                prefijo: 'video',     extDefecto: 'mp4' },
  { key: 'documentosAdicionales', prefijo: 'documento', extDefecto: 'pdf' },
];

const esLocal = (uri) =>
  typeof uri === 'string' && (uri.startsWith('file://') || uri.startsWith('content://'));

const yaRespaldado = (uri) => uri.startsWith(RAIZ);

function extension(uri, defecto) {
  const m = uri.split('?')[0].match(/\.([A-Za-z0-9]{2,5})$/);
  return (m ? m[1] : defecto).toLowerCase();
}

async function borrarDir(dir) {
  try { await FileSystem.deleteAsync(dir, { idempotent: true }); } catch {}
}

// Copia los archivos locales del formulario a su carpeta de respaldo y devuelve
// un formulario nuevo cuyas URIs apuntan a esas copias (más `respaldoLocal.dir`
// para poder borrarla al confirmar). `originales` son las URIs de origen:
// quien encole debe liberarlas con `liberarOriginales` SOLO si el encolado salió
// bien. Si algo falla no se bloquea el envío: se devuelve el formulario tal
// cual (sin respaldo), como funcionaba antes.
export async function resguardarArchivos(formulario) {
  const dir = `${RAIZ}acta_${Date.now()}_${Math.random().toString(36).slice(2, 8)}/`;
  const originales = [];

  try {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    const nuevo = { ...formulario };

    for (const { key, prefijo, extDefecto } of CATEGORIAS) {
      const items = formulario[key];
      if (!Array.isArray(items) || items.length === 0) continue;

      nuevo[key] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const uri  = typeof item === 'string' ? item : item?.uri;

        // Remotas (edición de un registro) o ya respaldadas: no se tocan.
        if (!esLocal(uri) || yaRespaldado(uri)) { nuevo[key].push(item); continue; }

        const destino = `${dir}${prefijo}_${String(i + 1).padStart(3, '0')}.${extension(uri, extDefecto)}`;
        await FileSystem.copyAsync({ from: uri, to: destino });

        const info = await FileSystem.getInfoAsync(destino);
        if (!info.exists || !info.size) throw new Error(`la copia de ${prefijo} ${i + 1} quedó vacía`);

        originales.push(uri);
        nuevo[key].push(typeof item === 'string' ? destino : { ...item, uri: destino });
      }
    }

    if (originales.length === 0) {
      await borrarDir(dir);
      return { formulario, originales: [] };
    }

    nuevo.respaldoLocal = { dir };
    return { formulario: nuevo, originales };
  } catch (e) {
    console.warn('[RespaldoLocal] no se pudo respaldar, se usan los archivos originales:', e?.message);
    await borrarDir(dir);
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
  const dir = formulario?.respaldoLocal?.dir;
  if (dir && dir.startsWith(RAIZ)) await borrarDir(dir);
}

// Borra carpetas de respaldo que ningún ítem de la cola referencia (p. ej. la
// app se cerró entre copiar y encolar). Solo las de más de un día, para no
// tocar una que se está creando ahora mismo.
export async function limpiarRespaldosHuerfanos(cola) {
  try {
    const info = await FileSystem.getInfoAsync(RAIZ);
    if (!info.exists) return;

    const enUso = new Set(
      (cola || []).map((i) => i.formulario?.respaldoLocal?.dir).filter(Boolean)
    );
    for (const nombre of await FileSystem.readDirectoryAsync(RAIZ)) {
      const dir = `${RAIZ}${nombre}/`;
      if (enUso.has(dir)) continue;
      const creadaEn = Number(nombre.split('_')[1]);
      if (Number.isFinite(creadaEn) && Date.now() - creadaEn < UN_DIA_MS) continue;
      await borrarDir(dir);
    }
  } catch (e) {
    console.warn('[RespaldoLocal] limpiarRespaldosHuerfanos:', e?.message);
  }
}
