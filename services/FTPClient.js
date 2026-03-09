// ============================================================
// services/FTPClient.js
// ============================================================
// Cliente FTP minimalista implementado sobre TCP sockets puros.
// Usa: react-native-tcp-socket
//
// INSTALACIÓN:
//   npm install react-native-tcp-socket
//   cd ios && pod install          ← solo si usas iOS
//   npx expo prebuild              ← requerido (Bare Workflow)
//
// PROTOCOLO FTP RESUMIDO:
//   El cliente abre una conexión de CONTROL (puerto 21) donde
//   envía comandos en texto plano y lee respuestas numéricas.
//   Para transferir archivos se abre una segunda conexión de
//   DATOS en modo PASIVO (PASV): el servidor indica en qué
//   puerto escucha y el cliente se conecta ahí para enviar
//   el binario del archivo.
//
//   Flujo básico:
//     [connect :21] → 220 Welcome
//     USER xxx      → 331 Password required
//     PASS xxx      → 230 Logged in
//     TYPE I        → 200 Binary mode
//     PASV          → 227 (h1,h2,h3,h4,p1,p2)  ← puerto de datos
//     [connect :dataPort]
//     STOR archivo  → 125 Data connection open
//     [enviar bytes por data socket]
//     [cerrar data socket] → 226 Transfer complete
//     QUIT          → 221 Goodbye
// ============================================================
import { Buffer } from 'buffer';
import TcpSocket from 'react-native-tcp-socket';

// ── Tiempos de espera ─────────────────────────────────────
const TIMEOUT_CONEXION = 15000;   // 15 seg para conectar
const TIMEOUT_COMANDO  = 20000;   // 20 seg para cada respuesta
const TIMEOUT_TRANSFER = 120000;  // 2 min para transferencia de datos

// ── Utilidades de log (desactivar en producción) ──────────
const DEBUG = true;
const log   = (...args) => DEBUG && console.log('[FTPClient]', ...args);
const logErr= (...args) => console.error('[FTPClient]', ...args);


// ============================================================
// CLASE PRINCIPAL: FTPClient
// ============================================================
export default class FTPClient {

constructor(config) {
  this.host     = config.host;
  this.port     = config.port || 21;
  this.user     = config.user;
  this.password = config.password;
  this.passive  = config.passive !== false;

  this._controlSocket  = null;
  this._buffer         = '';
  this._pendingResolve = null;
  this._pendingReject  = null;
  this._waitingFor     = null;
  this._waitingForAny  = null;
}


  // ──────────────────────────────────────────────────────────
  // CONEXIÓN Y LOGIN
  // ──────────────────────────────────────────────────────────

  /**
   * Conecta al servidor FTP y hace login.
   * Debe llamarse antes de cualquier operación.
   */
  async connect() {
    log(`Conectando a ${this.host}:${this.port}...`);

    await this._abrirControlSocket();
    await this._waitForCode('220');   // Banner de bienvenida

    log('Enviando credenciales...');
    await this._sendCommand(`USER ${this.user}`, '331');   // Pide contraseña
    await this._sendCommand(`PASS ${this.password}`, '230'); // Login OK

    log('Login exitoso.');

    // Poner en modo binario para no corromper archivos
    await this._sendCommand('TYPE I', '200');
  }


  /**
   * Cierra la conexión limpiamente.
   */
  async disconnect() {
    try {
      await this._sendCommand('QUIT', '221');
    } catch (_) {
      // Ignorar errores al cerrar
    } finally {
      this._controlSocket?.destroy();
      this._controlSocket = null;
      log('Desconectado.');
    }
  }


  // ──────────────────────────────────────────────────────────
  // OPERACIONES DE ARCHIVO
  // ──────────────────────────────────────────────────────────

  /**
   * Sube un archivo al servidor FTP.
   *
   * @param {string} contenido     - Contenido del archivo (texto o base64)
   * @param {string} rutaRemota    - Ruta completa en el servidor, ej: '/uploads/datos.json'
   * @param {boolean} esBase64     - true si contenido es base64 (para binarios)
   * @param {Function} onProgreso  - Callback (bytesSent, totalBytes)
   */
  
  async subirArchivo(contenido, rutaRemota, esBase64 = false, onProgreso = null) {
  log(`Subiendo archivo → ${rutaRemota}`);

  const buffer = esBase64
    ? Buffer.from(contenido, 'base64')
    : Buffer.from(contenido, 'utf8');

  const totalBytes = buffer.length;
  log(`Tamaño: ${(totalBytes / 1024).toFixed(1)} KB`);

  const { host: dataHost, port: dataPort } = await this._entrarModoPasivo();

  // Registrar espera del 226 ANTES de todo
  const espera226 = this._waitForCode('226');

  // Enviar STOR
  this._enviarLinea(`STOR ${rutaRemota}`);

  // Esperar 125 O 150 (depende del servidor, ambos son válidos)
  await this._waitForAnyCode(['125', '150']);

  // Ahora transferir
  await this._transferirDatos(dataHost, dataPort, buffer, totalBytes, onProgreso);

  await espera226;
  log(`✅ Archivo subido: ${rutaRemota}`);
}

  /**
   * Crea un directorio remoto (no falla si ya existe).
   * @param {string} ruta - Ej: '/uploads/formularios'
   */
  async crearDirectorio(ruta) {
    try {
      await this._sendCommand(`MKD ${ruta}`, '257');
      log(`Directorio creado: ${ruta}`);
    } catch (e) {
      // 550 = ya existe, ignorar
      if (!e.message?.includes('550')) throw e;
      log(`Directorio ya existe: ${ruta}`);
    }
  }


  /**
   * Lista los archivos de un directorio remoto.
   * Útil para verificar que el archivo fue subido.
   * @param {string} ruta
   * @returns {Promise<string>} Listado en texto plano
   */
  async listarDirectorio(ruta = '.') {
    const { host: dataHost, port: dataPort } = await this._entrarModoPasivo();
    this._enviarLinea(`LIST ${ruta}`);

    const listado = await this._recibirDatosTexto(dataHost, dataPort);
    await this._waitForCode('226');
    return listado;
  }


  // ──────────────────────────────────────────────────────────
  // INTERNALS: SOCKET DE CONTROL
  // ──────────────────────────────────────────────────────────

  _abrirControlSocket() {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout al conectar a ${this.host}:${this.port}`));
    }, TIMEOUT_CONEXION);

    // ── API actualizada de react-native-tcp-socket ──
    // createConnection recibe options y callback por separado
    this._controlSocket = TcpSocket.createConnection({
      host: this.host,
      port: this.port,
      tls: false,          // sin TLS (FTP plano)
      reuseAddress: true,
    });

    // El callback va en el evento 'connect', no en createConnection
    this._controlSocket.on('connect', () => {
      clearTimeout(timer);
      log('Socket de control abierto.');
      resolve();
    });

    this._controlSocket.on('data', (data) => {
      const texto = typeof data === 'string' ? data : data.toString('utf8');
      this._buffer += texto;
      log('← SERVIDOR:', texto.trim());
      this._procesarBuffer();
    });

    this._controlSocket.on('error', (err) => {
      logErr('Error en socket de control:', err.message);
      clearTimeout(timer);
      this._pendingReject?.(err);
      reject(err);
    });

    this._controlSocket.on('close', () => {
      log('Socket de control cerrado.');
    });
  });
}


  /**
   * Procesa el buffer de respuestas del servidor.
   * Las respuestas FTP tienen el formato: "XXX texto\r\n"
   * Las multi-línea son: "XXX-texto\r\n ... XXX texto\r\n"
   */
  _procesarBuffer() {
  const lineas = this._buffer.split('\r\n');
  this._buffer = lineas.pop();

  for (const linea of lineas) {
    if (!linea) continue;

    const codigo = linea.substring(0, 3);
    const esMultilinea = linea[3] === '-';
    if (esMultilinea) continue;

    // ¿Coincide con código simple o con array de códigos?
    const coincide =
      (this._waitingFor && codigo === this._waitingFor) ||
      (this._waitingForAny && this._waitingForAny.includes(codigo));

    if (coincide) {
      this._waitingFor    = null;
      this._waitingForAny = null;
      const resolver      = this._pendingResolve;
      this._pendingResolve = null;
      this._pendingReject  = null;
      resolver?.(linea);
    }
    // Códigos de error: 4xx y 5xx
    else if (codigo.startsWith('4') || codigo.startsWith('5')) {
      this._waitingFor    = null;
      this._waitingForAny = null;
      const rejecter      = this._pendingReject;
      this._pendingResolve = null;
      this._pendingReject  = null;
      rejecter?.(new Error(`FTP Error ${codigo}: ${linea.substring(4)}`));
    }
  }
}


  /**
   * Espera a recibir un código específico del servidor.
   * @param {string} codigo - Ej: '230', '226'
   */
  _waitForCode(codigo) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._pendingResolve = null;
        this._pendingReject  = null;
        this._waitingFor     = null;
        reject(new Error(`Timeout esperando código FTP ${codigo}`));
      }, TIMEOUT_COMANDO);

      this._pendingResolve = (linea) => { clearTimeout(timer); resolve(linea); };
      this._pendingReject  = (err)   => { clearTimeout(timer); reject(err); };
      this._waitingFor     = codigo;

      // Si ya está en el buffer, procesarlo ahora
      this._procesarBuffer();
    });
  }

_waitForAnyCode(codigos) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      this._pendingResolve = null;
      this._pendingReject  = null;
      this._waitingFor     = null;
      reject(new Error(`Timeout esperando códigos FTP ${codigos.join('/')}`));
    }, TIMEOUT_COMANDO);

    // Guardar los codigos aceptados en _waitingFor como array
    this._waitingForAny = codigos;

    this._pendingResolve = (linea) => { 
      clearTimeout(timer); 
      this._waitingForAny = null;
      resolve(linea); 
    };
    this._pendingReject = (err) => { 
      clearTimeout(timer); 
      this._waitingForAny = null;
      reject(err); 
    };

    this._procesarBuffer();
  });
}
  /**
   * Envía un comando y espera la respuesta esperada.
   * @param {string} comando  - Ej: 'USER admin'
   * @param {string} esperado - Código esperado, ej: '230'
   */
  async _sendCommand(comando, esperado) {
    // No loguear la contraseña
    const logCmd = comando.startsWith('PASS') ? 'PASS ****' : comando;
    log('→ COMANDO:', logCmd);

    const promesa = this._waitForCode(esperado);
    this._enviarLinea(comando);
    return promesa;
  }


  /**
   * Escribe una línea en el socket de control.
   */
  _enviarLinea(texto) {
    if (!this._controlSocket) throw new Error('No hay conexión FTP activa');
    this._controlSocket.write(texto + '\r\n');
  }


  // ──────────────────────────────────────────────────────────
  // INTERNALS: MODO PASIVO (PASV)
  // ──────────────────────────────────────────────────────────

  /**
   * Entra en modo pasivo y obtiene host/puerto para datos.
   * Respuesta PASV: "227 Entering Passive Mode (h1,h2,h3,h4,p1,p2)"
   * Puerto = p1 * 256 + p2
   */
  async _entrarModoPasivo() {
    const respuesta = await this._sendCommand('PASV', '227');

    // Extraer los 6 números entre paréntesis
    const match = respuesta.match(/\((\d+),(\d+),(\d+),(\d+),(\d+),(\d+)\)/);
    if (!match) throw new Error(`No se pudo parsear respuesta PASV: ${respuesta}`);

    const [, h1, h2, h3, h4, p1, p2] = match.map(Number);
    const host = `${h1}.${h2}.${h3}.${h4}`;
    const port = p1 * 256 + p2;

    log(`Modo pasivo: ${host}:${port}`);
    return { host, port };
  }


  // ──────────────────────────────────────────────────────────
  // INTERNALS: TRANSFERENCIA DE DATOS
  // ──────────────────────────────────────────────────────────

  /**
   * Abre el socket de datos y envía el buffer completo.
   * Implementa envío en chunks para reportar progreso.
   */
  _transferirDatos(host, port, buffer, totalBytes, onProgreso) {
  return new Promise((resolve, reject) => {
    const CHUNK_SIZE = 64 * 1024;
    let offset = 0;
    let bytesSent = 0;

    const timer = setTimeout(() => {
      dataSocket.destroy();
      reject(new Error('Timeout en transferencia de datos'));
    }, TIMEOUT_TRANSFER);

    const dataSocket = TcpSocket.createConnection({
      host,
      port,
      tls: false,
      reuseAddress: true,
    });

    const enviarSiguienteChunk = () => {
      if (offset >= totalBytes) {
        dataSocket.end();
        return;
      }
      const fin   = Math.min(offset + CHUNK_SIZE, totalBytes);
      const chunk = buffer.slice(offset, fin);
      offset = fin;

      dataSocket.write(chunk, () => {
        bytesSent += chunk.length;
        onProgreso?.(bytesSent, totalBytes);
        enviarSiguienteChunk();
      });
    };

    // ── evento connect en vez de callback ──
    dataSocket.on('connect', () => {
      log('Socket de datos abierto, iniciando transferencia...');
      enviarSiguienteChunk();
    });

    dataSocket.on('error', (err) => {
      clearTimeout(timer);
      logErr('Error en socket de datos:', err.message);
      reject(err);
    });

    dataSocket.on('close', () => {
      clearTimeout(timer);
      log('Socket de datos cerrado.');
      resolve();
    });
  });
}


  /**
   * Recibe datos de texto por el socket de datos (para LIST).
   */
  _recibirDatosTexto(host, port) {
  return new Promise((resolve, reject) => {
    let datos = '';

    const timer = setTimeout(() => {
      dataSocket.destroy();
      reject(new Error('Timeout recibiendo datos'));
    }, TIMEOUT_COMANDO);

    const dataSocket = TcpSocket.createConnection({
      host,
      port,
      tls: false,
      reuseAddress: true,
    });

    dataSocket.on('data', (data) => {
      datos += typeof data === 'string' ? data : data.toString('utf8');
    });

    dataSocket.on('close', () => {
      clearTimeout(timer);
      resolve(datos);
    });

    dataSocket.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}
}