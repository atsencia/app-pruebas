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

/**
 * Deduce la extensión real de una URI local.
 * Fallback: jpg para fotos, mp4 para videos.
 */
function extDeURI(uri, fallback = 'jpg') {
  const match = uri.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  return match ? match[1].toLowerCase() : fallback;
}

/**
 * Construye la lista de archivos multimedia asignando nombres únicos
 * y sin colisiones entre categorías.
 *
 * Convención de nombres:
 *   foto_001.jpg       — fotos generales
 *   fachada_001.jpg    — fotos de fachada
 *   firma_conc_001.jpg — firma concesionario
 *   firma_prof_001.jpg — firma profesional
 *   video_001.mp4      — videos
 *
 * Retorna un array de objetos:
 *   { uriLocal, nombreRemoto, categoria, descripcion }
 */
function construirListaMultimedia(formulario) {
  const lista = [];
  const extra = formulario.extra || {};

  // ── Fotos generales ──────────────────────────────────────
  (formulario.fotos || []).forEach((f, i) => {
    const ext = extDeURI(f.uri, 'jpg');
    lista.push({
      uriLocal:     f.uri,
      nombreRemoto: `foto_${String(i + 1).padStart(3, '0')}.${ext}`,
      categoria:    'fotos',
      descripcion:  f.descripcion || `Foto ${i + 1}`,
    });
  });

  // ── Fotos de fachada ─────────────────────────────────────
  (formulario.fotosFachada || []).forEach((f, i) => {
    const ext = extDeURI(f.uri, 'jpg');
    lista.push({
      uriLocal:     f.uri,
      nombreRemoto: `fachada_${String(i + 1).padStart(3, '0')}.${ext}`,
      categoria:    'fotosFachada',
      descripcion:  f.descripcion || `Fachada ${i + 1}`,
    });
  });

  // ── Firma concesionario (si vino como URI, no como base64) ─
  const firmaConcUri = extra.firmaConcesionario && extra.firmaConcesionario.firma;
  if (firmaConcUri && firmaConcUri.startsWith('file://')) {
    const ext = extDeURI(firmaConcUri, 'png');
    lista.push({
      uriLocal:     firmaConcUri,
      nombreRemoto: `firma_concesionario.${ext}`,
      categoria:    'firmas',
      descripcion:  'Firma del representante delegado concesionario',
    });
  }

  // ── Firma profesional (si vino como URI, no como base64) ───
  const firmaProfUri = extra.firmaProfesional && extra.firmaProfesional.firma;
  if (firmaProfUri && firmaProfUri.startsWith('file://')) {
    const ext = extDeURI(firmaProfUri, 'png');
    lista.push({
      uriLocal:     firmaProfUri,
      nombreRemoto: `firma_profesional.${ext}`,
      categoria:    'firmas',
      descripcion:  'Firma del profesional técnico',
    });
  }

  // ── Videos ───────────────────────────────────────────────
  (formulario.videos || []).forEach((v, i) => {
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

/**
 * Construye el JSON del registro.
 * Las firmas se referencian por nombre de archivo si son URI,
 * o se incluyen inline como base64 si son strings cortos (firma dibujada).
 */
function construirDatosJSON(id, formulario, listaMultimedia) {
  const extra = formulario.extra || {};

  // Resolver referencia de firma: URI → nombreRemoto; base64/null → tal cual
  const resolverFirma = (firmaRaw, nombreArchivo) => {
    if (!firmaRaw) return null;
    if (firmaRaw.startsWith('file://')) return nombreArchivo; // referencia al archivo subido
    return firmaRaw; // base64 inline (firma dibujada en pantalla)
  };

  const firmaConcItem = listaMultimedia.find(a => a.categoria === 'firmas' && a.nombreRemoto.startsWith('firma_concesionario'));
  const firmaProfItem = listaMultimedia.find(a => a.categoria === 'firmas' && a.nombreRemoto.startsWith('firma_profesional'));
  const firmaConcNombre = firmaConcItem ? firmaConcItem.nombreRemoto : null;
  const firmaProfNombre = firmaProfItem ? firmaProfItem.nombreRemoto : null;

  // Agrupar multimedia por categoría para la sección "multimedia" del JSON
  const agrupar = (cat) =>
    listaMultimedia
      .filter(a => a.categoria === cat)
      .map(a => ({ archivo: a.nombreRemoto, descripcion: a.descripcion }));

  return {
    id,
    version:    '1.0',
    timestamp:  new Date().toISOString(),
    dispositivo: {
      plataforma: require('react-native').Platform.OS,
    },
    formulario: {
      ...extra,

      // Sobrescribir firmas con referencia correcta (archivo o base64)
      firmaConcesionario: {
        ...extra.firmaConcesionario,
        firma: resolverFirma(extra.firmaConcesionario && extra.firmaConcesionario.firma, firmaConcNombre),
      },
      firmaProfesional: {
        ...extra.firmaProfesional,
        firma: resolverFirma(extra.firmaProfesional && extra.firmaProfesional.firma, firmaProfNombre),
      },

      fotosCount:  listaMultimedia.filter(a => a.categoria === 'fotos').length,
      videosCount: listaMultimedia.filter(a => a.categoria === 'videos').length,
    },
    multimedia: {
      fotos:        agrupar('fotos'),
      fotosFachada: agrupar('fotosFachada'),
      firmas:       agrupar('firmas'),
      videos:       agrupar('videos'),
    },
  };
}

// ─────────────────────────────────────────────────────────────
// FUNCIÓN PRINCIPAL
// ─────────────────────────────────────────────────────────────

export async function subirFormularioFTP(formulario, onProgreso = () => {}) {
  const id      = generarIDUnico();
  const carpeta = `${FTP_CONFIG.baseDir}/${id}`;
  const ftp     = new FTPClient(FTP_CONFIG);

  try {
    // ── 1. Conectar ────────────────────────────────────────
    onProgreso(5, 'Conectando al servidor FTP...');
    await ftp.connect();

    await ftp.crearDirectorio(FTP_CONFIG.baseDir);
    await ftp.crearDirectorio(carpeta);

    // ── 2. Preparar lista de multimedia (nombres únicos) ───
    onProgreso(10, 'Preparando archivos...');
    const listaMultimedia = construirListaMultimedia(formulario);

    // ── 3. Construir y subir datos.json ────────────────────
    onProgreso(15, 'Subiendo datos.json...');
    const datosJSON = construirDatosJSON(id, formulario, listaMultimedia);

    await ftp.subirArchivo(
      JSON.stringify(datosJSON, null, 2),
      `${carpeta}/datos.json`,
      false
    );
    onProgreso(25, 'datos.json subido ✓');

    // ── 4. Subir cada archivo multimedia ───────────────────
    const total = listaMultimedia.length;

    for (let i = 0; i < total; i++) {
      const item        = listaMultimedia[i];

              // ← AGREGAR ESTO
        console.log('[DEBUG multimedia]', {
          categoria:    item.categoria,
          nombreRemoto: item.nombreRemoto,
          uriLocal:     item.uriLocal,
        });

          const fileInfo = await FileSystem.getInfoAsync(item.uriLocal, { size: true });
          console.log('[DEBUG fileInfo]', fileInfo);

      const rutaRemota  = `${carpeta}/${item.nombreRemoto}`;
      const basePct     = 25 + Math.round((i / total) * 65);

      onProgreso(basePct, `Subiendo ${item.categoria} (${i + 1}/${total}): ${item.nombreRemoto}`);

      await ftp.subirArchivoDesdeURI(

        item.uriLocal,
        rutaRemota,
        (sent, totalBytes) => {
          const pct = basePct + Math.round((sent / totalBytes) * (65 / total));
          onProgreso(pct, `${item.nombreRemoto}: ${Math.round((sent / totalBytes) * 100)}%`);
        }
      );
    }

    // ── 5. Archivo .done ───────────────────────────────────
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
    return { success: false, id, mensaje: error.message };
  }
}