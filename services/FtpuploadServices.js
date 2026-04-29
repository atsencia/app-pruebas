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
  const ahora  = new Date();
  const fecha  = ahora.toISOString().replace(/[-:T.]/g, '').substring(0, 15);
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

async function base64AArchivoTemp(base64, nombre) {
  let datos = base64;

  const commaIndex = base64.indexOf(',');
  if (commaIndex !== -1) {
    datos = base64.slice(commaIndex + 1);
  }

  const uri = `${FileSystem.cacheDirectory}${nombre}`;

  await FileSystem.writeAsStringAsync(uri, datos, {
    encoding: FileSystem.EncodingType.Base64,
  });

  datos = null;
  base64 = null;

  return uri;
}

async function construirListaMultimedia(formulario) {
  const lista = [];
  const extra = formulario.extra || {};

  (formulario.fotos || []).forEach((f, i) => {
    if (!esURILocal(f.uri)) return;
    const ext = extDeURI(f.uri, 'jpg');
    lista.push({
      uriLocal:     f.uri,
      nombreRemoto: `foto_${String(i + 1).padStart(3, '0')}.${ext}`,
      categoria:    'fotos',
      descripcion:  f.descripcion || `Foto ${i + 1}`,
    });
  });

  (formulario.fotosFachada || []).forEach((f, i) => {
    if (!esURILocal(f.uri)) return;
    const ext = extDeURI(f.uri, 'jpg');
    lista.push({
      uriLocal:     f.uri,
      nombreRemoto: `fachada_${String(i + 1).padStart(3, '0')}.${ext}`,
      categoria:    'fotosFachada',
      descripcion:  f.descripcion || `Fachada ${i + 1}`,
    });
  });

  const firmaConcRaw = extra.firmaConcesionario?.firma;
  if (firmaConcRaw) {
    let uriLocal;
    if (firmaConcRaw.startsWith('file://')) {
      uriLocal = firmaConcRaw;
    } else if (firmaConcRaw.startsWith('data:') || firmaConcRaw.length > 200) {
      uriLocal = await base64AArchivoTemp(firmaConcRaw, 'firma_concesionario.png');
    }
    if (uriLocal) {
      lista.push({
        uriLocal,
        nombreRemoto: 'firma_concesionario.png',
        categoria:    'firmas',
        descripcion:  'Firma del representante delegado concesionario',
        esTemporal:   !firmaConcRaw.startsWith('file://'), // flag para limpieza
      });
    }
  }

  const firmaProfRaw = extra.firmaProfesional?.firma;
  if (firmaProfRaw) {
    let uriLocal;
    if (firmaProfRaw.startsWith('file://')) {
      uriLocal = firmaProfRaw;
    } else if (firmaProfRaw.startsWith('data:') || firmaProfRaw.length > 200) {
      uriLocal = await base64AArchivoTemp(firmaProfRaw, 'firma_profesional.png');
    }
    if (uriLocal) {
      lista.push({
        uriLocal,
        nombreRemoto: 'firma_profesional.png',
        categoria:    'firmas',
        descripcion:  'Firma del profesional técnico',
        esTemporal:   !firmaProfRaw.startsWith('file://'), // flag para limpieza
      });
    }
  }

  (formulario.videos || []).forEach((v, i) => {
    if (!esURILocal(v.uri)) return;
    const ext = extDeURI(v.uri, 'mp4');
    lista.push({
      uriLocal:     v.uri,
      nombreRemoto: `video_${String(i + 1).padStart(3, '0')}.${ext}`,
      categoria:    'videos',
      descripcion:  v.descripcion || `Video ${i + 1}`,
    });
  });

  return lista;
}

function construirDatosJSON(id, formulario, listaMultimedia, archivosRemotos = {}) {
  const extra = formulario.extra || {};

  const resolverFirma = (firmaRaw, nombreArchivo) => {
    if (!firmaRaw) return null;
    if (firmaRaw.startsWith('file://') || firmaRaw.startsWith('data:') || firmaRaw.length > 200) {
      return nombreArchivo ?? null;
    }
    return firmaRaw;
  };

  const firmaConcItem   = listaMultimedia.find(a => a.categoria === 'firmas' && a.nombreRemoto.startsWith('firma_concesionario'));
  const firmaProfItem   = listaMultimedia.find(a => a.categoria === 'firmas' && a.nombreRemoto.startsWith('firma_profesional'));
  const firmaConcNombre = firmaConcItem ? firmaConcItem.nombreRemoto : null;
  const firmaProfNombre = firmaProfItem ? firmaProfItem.nombreRemoto : null;

  const agrupar = (cat) => [
    ...(archivosRemotos[cat] || []),
    ...listaMultimedia
      .filter(a => a.categoria === cat)
      .map(a => ({ archivo: a.nombreRemoto, descripcion: a.descripcion })),
  ];

  return {
    id,
    version:    '1.0',
    timestamp:  new Date().toISOString(),
    dispositivo: { plataforma: require('react-native').Platform.OS },
    formulario: {
      ...extra,
      firmaConcesionario: {
        ...extra.firmaConcesionario,
        firma: resolverFirma(extra.firmaConcesionario?.firma, firmaConcNombre),
      },
      firmaProfesional: {
        ...extra.firmaProfesional,
        firma: resolverFirma(extra.firmaProfesional?.firma, firmaProfNombre),
      },
      fotosCount:        (archivosRemotos.fotos?.length || 0)        + listaMultimedia.filter(a => a.categoria === 'fotos').length,
      fotosFachadaCount: (archivosRemotos.fotosFachada?.length || 0) + listaMultimedia.filter(a => a.categoria === 'fotosFachada').length,
      videosCount:       (archivosRemotos.videos?.length || 0)       + listaMultimedia.filter(a => a.categoria === 'videos').length,
    },
    multimedia: {
      fotos:        agrupar('fotos'),
      fotosFachada: agrupar('fotosFachada'),
      firmas:       agrupar('firmas'),
      videos:       agrupar('videos'),
    },
  };
}

export async function subirFormularioFTP(formulario, onProgreso = () => {}) {
  const id      = formulario.registro_uuid || generarIDUnico();
  const carpeta = `${FTP_CONFIG.baseDir}/${id}`;
  const ftp     = new FTPClient(FTP_CONFIG);

  // Limpiar base64 en memoria antes de construir la lista
  // (evita serializar datos pesados accidentalmente)
  if (formulario.extra?.firmaConcesionario?.firma?.startsWith('data:')) {
    formulario.extra.firmaConcesionario.firma =
      formulario.extra.firmaConcesionario.firma; // se resolverá vía base64AArchivoTemp
  }
  if (formulario.extra?.firmaProfesional?.firma?.startsWith('data:')) {
    formulario.extra.firmaProfesional.firma =
      formulario.extra.firmaProfesional.firma;
  }

  const archivosRemotos = {
    fotos: (formulario.fotos || [])
      .filter(f => !esURILocal(f.uri))
      .map((f, i) => ({
        archivo:     f.uri.split('/').pop(),
        descripcion: f.descripcion || `Foto ${i + 1}`,
      })),
    fotosFachada: (formulario.fotosFachada || [])
      .filter(f => !esURILocal(f.uri))
      .map((f, i) => ({
        archivo:     f.uri.split('/').pop(),
        descripcion: f.descripcion || `Fachada ${i + 1}`,
      })),
    videos: (formulario.videos || [])
      .filter(v => !esURILocal(v.uri))
      .map((v, i) => ({
        archivo:     v.uri.split('/').pop(),
        descripcion: v.descripcion || `Video ${i + 1}`,
      })),
  };

  let listaMultimedia = [];

  try {
    onProgreso(5, 'Conectando al servidor FTP...');
    await ftp.connect();
    await ftp.crearDirectorio(FTP_CONFIG.baseDir);
    await ftp.crearDirectorio(carpeta);

    onProgreso(10, 'Preparando archivos...');
    listaMultimedia = await construirListaMultimedia(formulario);

    onProgreso(15, 'Subiendo datos.json...');
    const datosJSON = construirDatosJSON(id, formulario, listaMultimedia, archivosRemotos);
    await ftp.subirArchivo(
      JSON.stringify(datosJSON, null, 2),
      `${carpeta}/datos.json`,
      false
    );
    onProgreso(25, 'datos.json subido ✓');

    const total = listaMultimedia.length;
    for (let i = 0; i < total; i++) {
      const item       = listaMultimedia[i];
      const rutaRemota = `${carpeta}/${item.nombreRemoto}`;
      const basePct    = 25 + Math.round((i / total) * 65);

      onProgreso(basePct, `Subiendo ${item.categoria} (${i + 1}/${total}): ${item.nombreRemoto}`);

      await ftp.subirArchivoDesdeURI(
        item.uriLocal,
        rutaRemota,
        (sent, totalBytes) => {
          const pct = basePct + Math.round((sent / totalBytes) * (65 / total));
          onProgreso(pct, `${item.nombreRemoto}: ${Math.round((sent / totalBytes) * 100)}%`);
        }
      );

      // Limpiar archivo temporal de caché una vez subido
      if (item.esTemporal) {
        await FileSystem.deleteAsync(item.uriLocal, { idempotent: true });
      }
    }

    onProgreso(92, 'Marcando registro como completo...');
    await ftp.subirArchivo(
      JSON.stringify({ completado: true, timestamp: new Date().toISOString() }),
      `${carpeta}/.done`,
      false
    );

    await ftp.disconnect();
    onProgreso(100, '¡Registro enviado correctamente!');
    return { success: true, id, carpeta: id, mensaje: 'Registro enviado correctamente' };

  } catch (error) {
    console.error('[FTPUpload] Error:', error);
    try { await ftp.disconnect(); } catch (_) {}

    // Limpieza de temporales aunque falle la subida
    for (const item of listaMultimedia) {
      if (item.esTemporal) {
        await FileSystem.deleteAsync(item.uriLocal, { idempotent: true }).catch(() => {});
      }
    }

    return { success: false, id, mensaje: error.message };
  }
}