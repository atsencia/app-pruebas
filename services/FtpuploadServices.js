// ============================================================
// services/FTPUploadService.js
// ============================================================
// Servicio de alto nivel que usa FTPClient para subir
// los datos del formulario empaquetados en un archivo JSON.
//
// FLUJO COMPLETO:
//   1. Tomar los datos del formulario
//   2. Generar un nombre de archivo único (sin duplicados)
//   3. Empaquetar todo en un JSON
//   4. Subir el JSON al servidor FTP
//   5. Subir cada foto/video como archivo separado
//   6. Tras confirmación del servidor → borrar archivos locales
// ============================================================

import * as FileSystem from 'expo-file-system';
import FTPClient from './FTPClient';

// ── CONFIGURACIÓN ─────────────────────────────────────────
// ⚠️  Mueve estas variables a un .env en producción.
//     npm install react-native-dotenv  y  babel-plugin-module-resolver
const FTP_CONFIG = {
  host    : '187.33.154.112',   // ← cambia esto
  port    : 21,
  user    : 'ftpuser',            // ← cambia esto
  password: 'Sencia2026AT',         // ← cambia esto
  baseDir : '/home/ftpuser/uploads',          // Carpeta raíz en el servidor FTP
};

// ── Helpers ──────────────────────────────────────────────

/**
 * Genera un ID único para el registro basado en timestamp + random.
 * Esto evita duplicados incluso si dos dispositivos suben a la vez.
 * Formato: YYYYMMDD_HHMMSS_XXXX
 */
function generarIDUnico() {
  const ahora  = new Date();
  const fecha  = ahora.toISOString().replace(/[-:T]/g, '').substring(0, 15);
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${fecha}_${random}`;
}

/**
 * Lee un archivo local y lo devuelve como base64.
 * Necesario para enviar binarios (fotos/videos) por FTP.
 */
async function leerArchivoComoBase64(uri) {
  const contenido = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return contenido;
}

/**
 * Borra un archivo local de forma segura.
 */
async function borrarArchivoLocal(uri) {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) {
      await FileSystem.deleteAsync(uri, { idempotent: true });
      console.log('[FTPUpload] Borrado local:', uri);
    }
  } catch (e) {
    console.warn('[FTPUpload] No se pudo borrar:', uri, e.message);
  }
}


// ── FUNCIÓN PRINCIPAL ─────────────────────────────────────

/**
 * Empaqueta y sube un formulario completo al servidor FTP.
 *
 * Estructura de archivos en el servidor:
 *   /formularios/
 *     └── 20260308_143022_AB3C/          ← carpeta por registro
 *           ├── datos.json               ← campos del formulario
 *           ├── foto_1.jpg
 *           ├── foto_2.jpg
 *           └── video_1.mp4
 *
 * El script en el servidor (ver proceso_registros.py) detecta
 * la carpeta nueva, lee datos.json y sube a la DB.
 *
 * @param {Object}   formulario           - Datos del formulario
 * @param {string}   formulario.nombre
 * @param {string}   formulario.apellido
 * @param {string}   formulario.direccion
 * @param {Object}   formulario.georef    - { latitud, longitud }
 * @param {Array}    formulario.fotos     - [{ uri, nombre }]
 * @param {Array}    formulario.videos    - [{ uri, nombre }]
 * @param {Object}  [formulario.extra]    - Propiedades adicionales que serán fusionadas
 *                                         dentro de `datos.json` (por ejemplo, el
 *                                         objeto completo de `buildDatos`).
 * @param {Function} onProgreso           - Callback(porcentaje, mensaje)
 *
 * @returns {Promise<{ success: boolean, id: string, mensaje: string }>}
 */
export async function subirFormularioFTP(formulario, onProgreso = () => {}) {
  const id         = generarIDUnico();
  const carpeta    = `${FTP_CONFIG.baseDir}/${id}`;
  const ftp        = new FTPClient(FTP_CONFIG);
  const archivosSubidos = [];   // Para borrar localmente al final

  try {
    // ── PASO 1: Conectar ──────────────────────────────────
    onProgreso(2, 'Conectando al servidor FTP...');
    await ftp.connect();

    // ── PASO 2: Crear carpeta del registro ────────────────
    onProgreso(8, 'Creando directorio en el servidor...');
    await ftp.crearDirectorio(FTP_CONFIG.baseDir);   // Por si no existe
    await ftp.crearDirectorio(carpeta);

    // ── PASO 3: Empaquetar y subir datos.json ─────────────
    onProgreso(12, 'Subiendo datos del formulario...');

    const datosRegistro = {
      id,
      version   : '1.0',                              // Para versionado del esquema
      timestamp : new Date().toISOString(),
      dispositivo: {
        plataforma: require('react-native').Platform.OS,
      },
      formulario: {
        nombre   : formulario.nombre,
        apellido : formulario.apellido,
        direccion: formulario.direccion,
        georef   : {
          latitud : formulario.georef?.latitud,
          longitud: formulario.georef?.longitud,
        },
        // fusionar campos arbitrarios (p. ej. buildDatos()) sin romper
        // cuando `extra` sea undefined
        ...(formulario.extra || {}),
      },
      multimedia: {
        // El servidor sabrá qué archivos buscar en esta misma carpeta
        fotos : (formulario.fotos  || []).map((f, i) => `foto_${i + 1}.jpg`),
        videos: (formulario.videos || []).map((v, i) => `video_${i + 1}.mp4`),
      },
    };

    const jsonString = JSON.stringify(datosRegistro, null, 2);
    await ftp.subirArchivo(jsonString, `${carpeta}/datos.json`, false);
    onProgreso(20, 'Datos del formulario subidos ✓');

    // ── PASO 4: Subir fotos ───────────────────────────────
    const totalFotos  = (formulario.fotos  || []).length;
    const totalVideos = (formulario.videos || []).length;
    const totalArchivos = totalFotos + totalVideos;

    for (let i = 0; i < totalFotos; i++) {
      const foto        = formulario.fotos[i];
      const nombreRemoto= `foto_${i + 1}.jpg`;
      const rutaRemota  = `${carpeta}/${nombreRemoto}`;

      const porcentajeBase = 20 + ((i / totalArchivos) * 60);
      onProgreso(
        Math.round(porcentajeBase),
        `Subiendo foto ${i + 1} de ${totalFotos}...`
      );

      // Leer foto como base64 y subir
      const base64 = await leerArchivoComoBase64(foto.uri);
      await ftp.subirArchivo(
        base64,
        rutaRemota,
        true,   // es base64
        (sent, total) => {
          const subPct = sent / total;
          const pct    = porcentajeBase + (subPct / totalArchivos * 60);
          onProgreso(Math.round(pct), `Foto ${i + 1}: ${Math.round(subPct * 100)}%`);
        }
      );

      archivosSubidos.push(foto.uri);
      onProgreso(Math.round(porcentajeBase + 60 / totalArchivos), `Foto ${i + 1} subida ✓`);
    }

    // ── PASO 5: Subir videos ──────────────────────────────
    for (let i = 0; i < totalVideos; i++) {
      const video       = formulario.videos[i];
      const nombreRemoto= `video_${i + 1}.mp4`;
      const rutaRemota  = `${carpeta}/${nombreRemoto}`;

      const porcentajeBase = 20 + (((totalFotos + i) / totalArchivos) * 60);
      onProgreso(
        Math.round(porcentajeBase),
        `Subiendo video ${i + 1} de ${totalVideos}...`
      );

      const base64 = await leerArchivoComoBase64(video.uri);
      await ftp.subirArchivo(
        base64,
        rutaRemota,
        true,
        (sent, total) => {
          const subPct = sent / total;
          const pct    = porcentajeBase + (subPct / totalArchivos * 60);
          onProgreso(Math.round(pct), `Video ${i + 1}: ${Math.round(subPct * 100)}%`);
        }
      );

      archivosSubidos.push(video.uri);
      onProgreso(
        Math.round(porcentajeBase + 60 / totalArchivos),
        `Video ${i + 1} subido ✓`
      );
    }

    // ── PASO 6: Crear archivo .done como señal al servidor ─
    // El script del servidor esperará este archivo para saber
    // que el registro está completo (no a medias).
    onProgreso(85, 'Marcando registro como completo...');
    await ftp.subirArchivo(
      JSON.stringify({ completado: true, timestamp: new Date().toISOString() }),
      `${carpeta}/.done`,
      false
    );

    // ── PASO 7: Desconectar ───────────────────────────────
    onProgreso(90, 'Cerrando conexión FTP...');
    await ftp.disconnect();

    // ── PASO 8: Borrar archivos locales ───────────────────
    // SOLO AQUÍ, después de confirmar que todo subió bien.
    onProgreso(95, 'Limpiando archivos locales...');
    for (const uri of archivosSubidos) {
      await borrarArchivoLocal(uri);
    }

    onProgreso(100, '¡Registro enviado con éxito!');
    return { success: true, id, mensaje: `Registro ${id} subido correctamente.` };

  } catch (error) {
    console.error('[FTPUpload] Error:', error);

    // Intentar cerrar la conexión aunque haya fallado
    try { await ftp.disconnect(); } catch (_) {}

    // NO borramos los archivos locales si hubo error
    return {
      success: false,
      id,
      mensaje: `Error al subir el registro: ${error.message}`,
    };
  }
}