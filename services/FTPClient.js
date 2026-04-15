// ============================================================
// services/FTPClient.js
// ============================================================
import { Buffer } from 'buffer';
import TcpSocket from 'react-native-tcp-socket';
import * as FileSystem from 'expo-file-system';

const TIMEOUT_CONEXION = 15000;
const TIMEOUT_COMANDO  = 20000;
const TIMEOUT_TRANSFER = 120000;

const DEBUG = true;
const log    = (...args) => DEBUG && console.log('[FTPClient]', ...args);
const logErr = (...args) => console.error('[FTPClient]', ...args);

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

  async connect() {
    log(`Conectando a ${this.host}:${this.port}...`);
    await this._abrirControlSocket();
    await this._waitForCode('220');

    log('Enviando credenciales...');
    await this._sendCommand(`USER ${this.user}`, '331');
    await this._sendCommand(`PASS ${this.password}`, '230');
    log('Login exitoso.');

    await this._sendCommand('TYPE I', '200');
  }

  async disconnect() {
    try {
      await this._sendCommand('QUIT', '221');
    } catch (_) {
      // ignorar
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
   * Sube contenido de texto (ej: JSON) directamente como buffer.
   */
  async subirArchivo(contenido, rutaRemota, esBase64 = false, onProgreso = null) {
    log(`Subiendo archivo → ${rutaRemota}`);

    const buffer = esBase64
      ? Buffer.from(contenido, 'base64')
      : Buffer.from(contenido, 'utf8');

    const totalBytes = buffer.length;
    log(`Tamaño: ${(totalBytes / 1024).toFixed(1)} KB`);

    const { host: dataHost, port: dataPort } = await this._entrarModoPasivo();

    const espera226 = this._waitForCode('226');
    this._enviarLinea(`STOR ${rutaRemota}`);
    await this._waitForAnyCode(['125', '150']);

    await this._transferirDatos(dataHost, dataPort, buffer, totalBytes, onProgreso);

    await espera226;
    log(`✅ Archivo subido: ${rutaRemota}`);
  }

  /**
   * Sube un archivo desde su URI local leyendo en chunks de base64
   * y enviando bytes reales — nunca guarda el archivo completo en memoria.
   *
   * @param {string} uriLocal      - URI del dispositivo (file://)
   * @param {string} rutaRemota    - Ruta completa en el servidor FTP
   * @param {Function} onProgreso  - Callback (bytesSent, totalBytes)
   */
  async subirArchivoDesdeURI(uriLocal, rutaRemota, onProgreso = null) {
    log(`Subiendo desde URI → ${rutaRemota}`);

    // 1. Verificar existencia y tamaño
    const fileInfo = await FileSystem.getInfoAsync(uriLocal, { size: true });
    if (!fileInfo.exists) throw new Error(`Archivo no encontrado: ${uriLocal}`);
    const totalBytes = fileInfo.size;
    log(`Tamaño: ${(totalBytes / 1024).toFixed(1)} KB`);

    // 2. Entrar en modo pasivo
    const { host: dataHost, port: dataPort } = await this._entrarModoPasivo();

    // 3. Registrar espera del 226 ANTES de enviar STOR
    const espera226 = this._waitForCode('226');
    this._enviarLinea(`STOR ${rutaRemota}`);
    await this._waitForAnyCode(['125', '150']);

    // 4. Transferir en chunks para no saturar memoria
    const CHUNK_SIZE = 256 * 1024; // 256 KB por chunk

    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        dataSocket.destroy();
        reject(new Error('Timeout en transferencia de datos'));
      }, TIMEOUT_TRANSFER);

      const dataSocket = TcpSocket.createConnection({
        host: dataHost,
        port: dataPort,
        tls: false,
        reuseAddress: true,
      });

      let bytesSent = 0;
      let offset    = 0;

      const enviarChunk = async () => {
        if (offset >= totalBytes) {
          // Todo enviado — cerrar socket de datos
          dataSocket.end();
          return;
        }

        const length = Math.min(CHUNK_SIZE, totalBytes - offset);

        try {
          // expo-file-system lee en base64, lo convertimos a bytes reales
          const chunkB64 = await FileSystem.readAsStringAsync(uriLocal, {
            encoding: FileSystem.EncodingType.Base64,
            length,
            position: offset,
          });

          const chunkBuffer = Buffer.from(chunkB64, 'base64');
          offset += length;

          dataSocket.write(chunkBuffer, () => {
            bytesSent += chunkBuffer.length;
            onProgreso?.(bytesSent, totalBytes);
            enviarChunk(); // siguiente chunk tras confirmar envío
          });
        } catch (err) {
          clearTimeout(timer);
          dataSocket.destroy();
          reject(err);
        }
      };

      dataSocket.on('connect', () => {
        log('Socket de datos abierto, iniciando transferencia en chunks...');
        enviarChunk();
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

    await espera226;
    log(`✅ Archivo subido desde URI: ${rutaRemota}`);
  }

  /**
   * Crea un directorio remoto (no falla si ya existe).
   */
  async crearDirectorio(ruta) {
    try {
      await this._sendCommand(`MKD ${ruta}`, '257');
      log(`Directorio creado: ${ruta}`);
    } catch (e) {
      if (!e.message?.includes('550')) throw e;
      log(`Directorio ya existe: ${ruta}`);
    }
  }

  /**
   * Lista los archivos de un directorio remoto.
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

      this._controlSocket = TcpSocket.createConnection({
        host: this.host,
        port: this.port,
        tls: false,
        reuseAddress: true,
      });

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

  _procesarBuffer() {
    const lineas = this._buffer.split('\r\n');
    this._buffer = lineas.pop();

    for (const linea of lineas) {
      if (!linea) continue;

      const codigo      = linea.substring(0, 3);
      const esMultilinea = linea[3] === '-';
      if (esMultilinea) continue;

      const coincide =
        (this._waitingFor    && codigo === this._waitingFor) ||
        (this._waitingForAny && this._waitingForAny.includes(codigo));

      if (coincide) {
        this._waitingFor     = null;
        this._waitingForAny  = null;
        const resolver       = this._pendingResolve;
        this._pendingResolve = null;
        this._pendingReject  = null;
        resolver?.(linea);
      } else if (codigo.startsWith('4') || codigo.startsWith('5')) {
        this._waitingFor     = null;
        this._waitingForAny  = null;
        const rejecter       = this._pendingReject;
        this._pendingResolve = null;
        this._pendingReject  = null;
        rejecter?.(new Error(`FTP Error ${codigo}: ${linea.substring(4)}`));
      }
    }
  }

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
      this._procesarBuffer();
    });
  }

  _waitForAnyCode(codigos) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._pendingResolve = null;
        this._pendingReject  = null;
        this._waitingForAny  = null;
        reject(new Error(`Timeout esperando códigos FTP ${codigos.join('/')}`));
      }, TIMEOUT_COMANDO);

      this._waitingForAny  = codigos;
      this._pendingResolve = (linea) => { clearTimeout(timer); this._waitingForAny = null; resolve(linea); };
      this._pendingReject  = (err)   => { clearTimeout(timer); this._waitingForAny = null; reject(err); };
      this._procesarBuffer();
    });
  }

  async _sendCommand(comando, esperado) {
    const logCmd = comando.startsWith('PASS') ? 'PASS ****' : comando;
    log('→ COMANDO:', logCmd);
    const promesa = this._waitForCode(esperado);
    this._enviarLinea(comando);
    return promesa;
  }

  _enviarLinea(texto) {
    if (!this._controlSocket) throw new Error('No hay conexión FTP activa');
    this._controlSocket.write(texto + '\r\n');
  }

  // ──────────────────────────────────────────────────────────
  // INTERNALS: MODO PASIVO (PASV)
  // ──────────────────────────────────────────────────────────

  async _entrarModoPasivo() {
    const respuesta = await this._sendCommand('PASV', '227');
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

  _transferirDatos(host, port, buffer, totalBytes, onProgreso) {
    return new Promise((resolve, reject) => {
      const CHUNK_SIZE = 64 * 1024;
      let offset    = 0;
      let bytesSent = 0;

      const timer = setTimeout(() => {
        dataSocket.destroy();
        reject(new Error('Timeout en transferencia de datos'));
      }, TIMEOUT_TRANSFER);

      const dataSocket = TcpSocket.createConnection({
        host, port, tls: false, reuseAddress: true,
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

  _recibirDatosTexto(host, port) {
    return new Promise((resolve, reject) => {
      let datos = '';

      const timer = setTimeout(() => {
        dataSocket.destroy();
        reject(new Error('Timeout recibiendo datos'));
      }, TIMEOUT_COMANDO);

      const dataSocket = TcpSocket.createConnection({
        host, port, tls: false, reuseAddress: true,
      });

      dataSocket.on('data', (data) => {
        datos += typeof data === 'string' ? data : data.toString('utf8');
      });

      dataSocket.on('close', () => { clearTimeout(timer); resolve(datos); });
      dataSocket.on('error', (err) => { clearTimeout(timer); reject(err); });
    });
  }
}