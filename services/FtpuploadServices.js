// services/FTPUploadService.js
import * as FileSystem from 'expo-file-system/legacy';
import FTPClient from './FTPClient';

const FTP_CONFIG = {
  host: '187.33.154.112',
  port: 21,
  user: 'ftpuser',
  password: 'Sencia2026AT',
  baseDir: '/home/ftpuser/uploads',
};

function generarIDUnico() {
  const ahora = new Date();
  const fecha = ahora.toISOString().replace(/[-:T.]/g, '').substring(0, 15);
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${fecha}_${random}`;
}

function extDeURI(uri, fallback = 'jpg') {
  const match = uri.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  return match ? match[1].toLowerCase() : fallback;
}

const esURILocal = (uri) =>
  uri.startsWith('file://') ||
  uri.startsWith('content://') ||
  (FileSystem.cacheDirectory && uri.startsWith(FileSystem.cacheDirectory));

const esURLRemota = (uri) =>
  uri.startsWith('http://') || uri.startsWith('https://');

async function base64AArchivoTemp(base64, nombre) {
  let datos = base64;
  const commaIndex = base64.indexOf(',');
  if (commaIndex !== -1) datos = base64.slice(commaIndex + 1);

  const uri = `${FileSystem.cacheDirectory}${nombre}`;

  await FileSystem.writeAsStringAsync(uri, datos, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return uri;
}

function esBase64Valido(str) {
  if (typeof str !== 'string') return false;
  // Base64 puro (sin header data:) debe tener solo estos chars
  const base64Regex = /^[A-Za-z0-9+/=]+$/;
  return base64Regex.test(str.replace(/\s/g, ''));
}

/**
 * Descarga una URL remota al cache local para poder subirla por FTP.
 * Util cuando se edita un acta y las fotos/firmas ya tienen URL http.
 */
async function descargarURLATemp(url, nombreArchivo) {
  const uri = `${FileSystem.cacheDirectory}${nombreArchivo}`;
  try {
    const result = await FileSystem.downloadAsync(url, uri);
    if (result.status !== 200) {
      console.warn(`⚠️ No se pudo descargar ${url} — status ${result.status}`);
      return null;
    }
    return uri;
  } catch (e) {
    console.warn(`⚠️ Error descargando ${url}:`, e.message);
    return null;
  }
}

async function firmaAUriLocal(firmaRaw, nombreArchivo) {
  if (!firmaRaw || typeof firmaRaw !== 'string') return null;

  // Ya es URI local — usar directo
  if (firmaRaw.startsWith('file://')) return firmaRaw;

  // Data URL base64 (ej: data:image/png;base64,...)
  if (firmaRaw.startsWith('data:')) return await base64AArchivoTemp(firmaRaw, nombreArchivo);

  // SVG como string
  if (firmaRaw.startsWith('<svg') || firmaRaw.startsWith('<?xml')) {
    const uri = `${FileSystem.cacheDirectory}${nombreArchivo.replace('.png', '.svg')}`;
    await FileSystem.writeAsStringAsync(uri, firmaRaw, { encoding: FileSystem.EncodingType.UTF8 });
    return uri;
  }

  // URL remota (caso edición — ya existe en el servidor)
  // La descargamos para resubirla intacta
  if (esURLRemota(firmaRaw)) {
    return await descargarURLATemp(firmaRaw, nombreArchivo);
  }

  // Base64 puro sin header
  if (esBase64Valido(firmaRaw)) {
    return await base64AArchivoTemp(firmaRaw, nombreArchivo);
  }

  // Si es string de paths SVG (del SignaturePad)
  if (typeof firmaRaw === 'string' && firmaRaw.includes('M') && !esBase64Valido(firmaRaw) && !esURLRemota(firmaRaw)) {
    const paths = firmaRaw.split('|');
    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200">${paths.map(path => `<path d="${path}" stroke="#000" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}</svg>`;
    const uri = `${FileSystem.cacheDirectory}${nombreArchivo.replace('.png', '.svg')}`;
    await FileSystem.writeAsStringAsync(uri, svgContent, { encoding: FileSystem.EncodingType.UTF8 });
    return uri;
  }

  console.warn('⚠️ Firma no reconocida:', firmaRaw.slice(0, 80));
  return null;
}

// ==================== MULTIMEDIA ====================
async function construirListaMultimedia(formulario) {
  const lista = [];
  const extra = formulario.extra || {};

  // ── Fotos generales y fachada ────────────────────
  for (const key of ['fotos', 'fotosFachada']) {
    const items = formulario[key] || [];
    for (let i = 0; i < items.length; i++) {
      const f = items[i];
      const uri = f.uri ?? f;
      const prefix = key === 'fotos' ? 'foto' : 'fachada';
      const nombreRemoto = `${prefix}_${String(i + 1).padStart(3, '0')}.${extDeURI(uri, 'jpg')}`;

      if (esURILocal(uri)) {
        lista.push({
          uriLocal: uri,
          nombreRemoto,
          categoria: key,
          descripcion: f.descripcion || `${key === 'fotos' ? 'Foto' : 'Fachada'} ${i + 1}`,
          esTemporal: false,
        });
      } else if (esURLRemota(uri)) {
        // Edición: la foto ya está en el servidor, la re-descargamos para resubirla
        const uriLocal = await descargarURLATemp(uri, `_tmp_${nombreRemoto}`);
        if (uriLocal) {
          lista.push({
            uriLocal,
            nombreRemoto,
            categoria: key,
            descripcion: f.descripcion || `${key === 'fotos' ? 'Foto' : 'Fachada'} ${i + 1}`,
            esTemporal: true,
          });
        }
      }
      // Si es null/undefined o no reconocida, se salta
    }
  }

  // ── Firmas (las 3) — SIEMPRE como archivos, NUNCA en el JSON ────────
  const firmasConfig = [
    {
      raw: extra.firmaConcesionario?.firma,
      nombre: 'firma_concesionario',
      desc: 'Firma del representante delegado concesionario',
    },
    {
      raw: extra.firmaProfesional?.firma,
      nombre: 'firma_profesional',
      desc: 'Firma del profesional técnico',
    },
    {
      raw: extra.firmaPropietarioPredio?.firma,
      nombre: 'firma_propietario_predio',
      desc: 'Firma del dueño del predio',
    },
  ];

  for (const f of firmasConfig) {
    if (!f.raw) continue;

    // Determinar extensión antes de resolver URI
    const esSVG = f.raw.startsWith('<svg') || f.raw.startsWith('<?xml') || (typeof f.raw === 'string' && f.raw.includes('M') && !esBase64Valido(f.raw) && !esURLRemota(f.raw));
    const ext = esSVG ? 'svg' : 'png';
    const nombreArchivo = `${f.nombre}.${ext}`;

    const uriLocal = await firmaAUriLocal(f.raw, nombreArchivo);
    if (!uriLocal) continue;

    lista.push({
      uriLocal,
      nombreRemoto: nombreArchivo,
      categoria: 'firmas',
      descripcion: f.desc,
      esTemporal: true,
    });
  }

  // ── Videos ────────────────────────────────────────
  const videos = formulario.videos || [];
  for (let i = 0; i < videos.length; i++) {
    const v = videos[i];
    const uri = v.uri ?? v;
    const ext = extDeURI(uri, 'mp4');
    const nombreRemoto = `video_${String(i + 1).padStart(3, '0')}.${ext}`;

    if (esURILocal(uri)) {
      lista.push({
        uriLocal: uri,
        nombreRemoto,
        categoria: 'videos',
        descripcion: v.descripcion || `Video ${i + 1}`,
        esTemporal: false,
      });
    } else if (esURLRemota(uri)) {
      const uriLocal = await descargarURLATemp(uri, `_tmp_${nombreRemoto}`);
      if (uriLocal) {
        lista.push({
          uriLocal,
          nombreRemoto,
          categoria: 'videos',
          descripcion: v.descripcion || `Video ${i + 1}`,
          esTemporal: true,
        });
      }
    }
  }

  return lista;
}

// ==================== JSON FINAL ====================
// IMPORTANTE: Las firmas se guardan como NOMBRE DE ARCHIVO, no como base64.
// El viewer las resolverá a URLs usando el endpoint /media/:archivo
function construirDatosJSON(id, formulario, listaMultimedia) {
  const extra = formulario.extra || {};

  // Buscar nombres de archivo de firmas en la lista de multimedia
  const firmaConcNombre =
    listaMultimedia.find(a => a.nombreRemoto.startsWith('firma_concesionario'))?.nombreRemoto ?? null;
  const firmaProfNombre =
    listaMultimedia.find(a => a.nombreRemoto.startsWith('firma_profesional'))?.nombreRemoto ?? null;
  const firmaPropNombre =
    listaMultimedia.find(a => a.nombreRemoto.startsWith('firma_propietario_predio'))?.nombreRemoto ?? null;

  const agruparMediaPorCategoria = (cat) =>
    listaMultimedia
      .filter(a => a.categoria === cat)
      .map(a => ({ archivo: a.nombreRemoto, descripcion: a.descripcion }));

  return {
    id,
    version: '1.1',
    timestamp: new Date().toISOString(),
    revisado_por: formulario.revisado_por ?? null,
    dispositivo: { plataforma: require('react-native').Platform.OS },

    formulario: {
      // Todos los campos del acta excepto las firmas en base64
      ...extra,

      // Firmas: solo nombre de archivo (sin base64, sin data:)
      firmaConcesionario: {
        ...(extra.firmaConcesionario ?? {}),
        firma: firmaConcNombre,  // ej: "firma_concesionario.png" o null
      },
      firmaProfesional: {
        ...(extra.firmaProfesional ?? {}),
        firma: firmaProfNombre,
      },
      firmaPropietarioPredio: {
        ...(extra.firmaPropietarioPredio ?? {}),
        firma: firmaPropNombre,
      },

      fotosCount:        listaMultimedia.filter(a => a.categoria === 'fotos').length,
      fotosFachadaCount: listaMultimedia.filter(a => a.categoria === 'fotosFachada').length,
      videosCount:       listaMultimedia.filter(a => a.categoria === 'videos').length,
    },

    multimedia: {
      fotos:        agruparMediaPorCategoria('fotos'),
      fotosFachada: agruparMediaPorCategoria('fotosFachada'),
      firmas:       agruparMediaPorCategoria('firmas'),
      videos:       agruparMediaPorCategoria('videos'),
    },
  };
}

// ==================== FUNCIÓN PRINCIPAL ====================
export async function subirFormularioFTP(formulario, onProgreso = () => {}) {
  const id      = formulario.registro_uuid || generarIDUnico();
  const carpeta = `${FTP_CONFIG.baseDir}/${id}`;
  const ftp     = new FTPClient(FTP_CONFIG);

  let listaMultimedia = [];

  try {
    onProgreso(5, 'Conectando al servidor FTP...');
    await ftp.connect();
    await ftp.crearDirectorio(FTP_CONFIG.baseDir);
    await ftp.crearDirectorio(carpeta);

    onProgreso(10, 'Preparando archivos multimedia y firmas...');
    listaMultimedia = await construirListaMultimedia(formulario);

    // Construir JSON con firmas como nombres de archivo (no base64)
    const datosJSON = construirDatosJSON(id, formulario, listaMultimedia);

    onProgreso(15, 'Subiendo datos.json...');
    await ftp.subirArchivo(
      JSON.stringify(datosJSON, null, 2),
      `${carpeta}/datos.json`,
      false
    );

    // Subir todos los archivos (fotos, fachada, firmas, videos)
    const total = listaMultimedia.length;
    for (let i = 0; i < total; i++) {
      const item = listaMultimedia[i];
      const rutaRemota = `${carpeta}/${item.nombreRemoto}`;
      const basePct = 25 + Math.round((i / total) * 65);

      onProgreso(
        basePct,
        `Subiendo ${item.categoria} (${i + 1}/${total}): ${item.nombreRemoto}`
      );

      await ftp.subirArchivoDesdeURI(item.uriLocal, rutaRemota, (sent, totalBytes) => {
        const pct = basePct + Math.round((sent / totalBytes) * (65 / total));
        onProgreso(pct, `${item.nombreRemoto}: ${Math.round((sent / totalBytes) * 100)}%`);
      });

      // Limpiar temporales del cache
      if (item.esTemporal) {
        await FileSystem.deleteAsync(item.uriLocal, { idempotent: true }).catch(() => {});
      }
    }

    // Archivo .done para marcar subida completa
    await ftp.subirArchivo(
      JSON.stringify({ completado: true, timestamp: new Date().toISOString() }),
      `${carpeta}/.done`,
      false
    );

    await ftp.disconnect();
    onProgreso(100, '¡Registro enviado correctamente!');

    return {
      success: true,
      id,
      carpeta: id,
      mensaje: 'Registro enviado correctamente',
    };

  } catch (error) {
    console.error('[FTPUpload] Error:', error);
    try { await ftp.disconnect(); } catch (_) {}

    // Limpiar temporales aunque haya error
    for (const item of listaMultimedia) {
      if (item.esTemporal) {
        await FileSystem.deleteAsync(item.uriLocal, { idempotent: true }).catch(() => {});
      }
    }

    return { success: false, id, mensaje: error.message };
  }
}