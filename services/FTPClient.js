// ============================================================
// services/FTPClient.js
// ============================================================
import { Buffer } from 'buffer';
import TcpSocket from 'react-native-tcp-socket';
import * as FileSystem from 'expo-file-system/legacy';

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

    this._controlSocket = null;
    this._buffer        = '';
    this._waiters       = [];
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
    } catch (_) {}
    finally {
      this._waiters.forEach(w => { clearTimeout(w.timer); w.reject(new Error('Desconectado')); });
      this._waiters = [];
      if (this._controlSocket) this._controlSocket.destroy();
      this._controlSocket = null;
      log('Desconectado.');
    }
  }

  // ──────────────────────────────────────────────────────────
  // OPERACIONES DE ARCHIVO
  // ──────────────────────────────────────────────────────────

  /**
   * Sube contenido de texto/buffer (ej: JSON) directamente.
   */
  async subirArchivo(contenido, rutaRemota, esBase64 = false, onProgreso = null) {
    const buffer = esBase64
      ? Buffer.from(contenido, 'base64')
      : Buffer.from(contenido, 'utf8');

    const totalBytes = buffer.length;
    log(`Subiendo archivo → ${rutaRemota} (${totalBytes} bytes)`);

    const { host: dataHost, port: dataPort } = await this._entrarModoPasivo();

    // ✅ espera150 primero en la cola, luego espera226
    const espera150 = this._waitForAnyCode(['125', '150']);
    const espera226 = this._waitForCode('226', TIMEOUT_TRANSFER);

    const { socket: dataSocket, conectado } = this._crearSocketDatos(dataHost, dataPort);
    this._enviarLinea(`STOR ${rutaRemota}`);

    await Promise.all([conectado, espera150]);

    await this._enviarBufferPorSocket(dataSocket, buffer, totalBytes, onProgreso);
    await espera226;
    log(`✅ Archivo subido: ${rutaRemota}`);
  }

  /**
   * Sube un archivo desde su URI local leyendo en chunks.
   */
  async subirArchivoDesdeURI(uriLocal, rutaRemota, onProgreso = null) {
    log(`Subiendo desde URI → ${rutaRemota}`);

    const fileInfo = await FileSystem.getInfoAsync(uriLocal, { size: true });
    if (!fileInfo.exists) throw new Error(`Archivo no encontrado: ${uriLocal}`);
    const totalBytes = fileInfo.size;
    log(`Tamaño: ${(totalBytes / 1024).toFixed(1)} KB`);

    const { host: dataHost, port: dataPort } = await this._entrarModoPasivo();

    // ✅ espera150 primero en la cola, luego espera226
    const espera150 = this._waitForAnyCode(['125', '150']);
    const espera226 = this._waitForCode('226', TIMEOUT_TRANSFER);

    const { socket: dataSocket, conectado } = this._crearSocketDatos(dataHost, dataPort);
    this._enviarLinea(`STOR ${rutaRemota}`);

    await Promise.all([conectado, espera150]);

    await this._enviarChunksPorSocket(dataSocket, uriLocal, totalBytes, onProgreso);
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
      if (!e.message || !e.message.includes('550')) throw e;
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
        this._waiters.forEach(w => { clearTimeout(w.timer); w.reject(err); });
        this._waiters = [];
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

      const codigo       = linea.substring(0, 3);
      const esMultilinea = linea[3] === '-';
      if (esMultilinea) continue;

      log('[RAW]', JSON.stringify(linea));

      const idx = this._waiters.findIndex(w =>
        (w.code  && w.code === codigo) ||
        (w.codes && w.codes.includes(codigo))
      );

      if (idx !== -1) {
        const waiter = this._waiters.splice(idx, 1)[0];
        clearTimeout(waiter.timer);
        waiter.resolve(linea);
      } else if (codigo.startsWith('4') || codigo.startsWith('5')) {
        if (this._waiters.length > 0) {
          const waiter = this._waiters.shift();
          clearTimeout(waiter.timer);
          waiter.reject(new Error(`FTP Error ${codigo}: ${linea.substring(4)}`));
        }
      }
    }
  }

  _waitForCode(codigo, timeout = TIMEOUT_COMANDO) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._waiters = this._waiters.filter(w => w !== waiter);
        reject(new Error(`Timeout esperando código FTP ${codigo}`));
      }, timeout);

      const waiter = { code: codigo, timer, resolve, reject };
      this._waiters.push(waiter);
      this._procesarBuffer();
    });
  }

  _waitForAnyCode(codigos, timeout = TIMEOUT_COMANDO) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._waiters = this._waiters.filter(w => w !== waiter);
        reject(new Error(`Timeout esperando códigos FTP ${codigos.join('/')}`));
      }, timeout);

      const waiter = { codes: codigos, timer, resolve, reject };
      this._waiters.push(waiter);
      this._procesarBuffer();
    });
  }

  async _sendCommand(comando, esperado, timeout = TIMEOUT_COMANDO) {
    const logCmd = comando.startsWith('PASS') ? 'PASS ****' : comando;
    log('→ COMANDO:', logCmd);
    const promesa = this._waitForCode(esperado, timeout);
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
    log('PASV raw response:', respuesta);
    const match = respuesta.match(/\((\d+),(\d+),(\d+),(\d+),(\d+),(\d+)\)/);
    if (!match) throw new Error(`No se pudo parsear respuesta PASV: ${respuesta}`);

    const [, , , , , p1, p2] = match.map(Number);
    const port = p1 * 256 + p2;

    log(`Modo pasivo: ${this.host}:${port}`);
    return { host: this.host, port };
  }

  // ──────────────────────────────────────────────────────────
  // INTERNALS: SOCKET DE DATOS
  // ──────────────────────────────────────────────────────────

  /**
   * Crea un socket de datos y devuelve { socket, conectado }.
   * `conectado` es una Promise que resuelve cuando el socket está listo.
   */
  _crearSocketDatos(host, port) {
    let resolverConectado;
    let rechazarConectado;

    const conectado = new Promise((res, rej) => {
      resolverConectado = res;
      rechazarConectado = rej;
    });

    const timer = setTimeout(() => {
      socket.destroy();
      rechazarConectado(new Error('Timeout conectando socket de datos'));
    }, TIMEOUT_CONEXION);

    const socket = TcpSocket.createConnection({
      host, port, tls: false, reuseAddress: true,
    });

    socket.on('connect', () => {
      clearTimeout(timer);
      log('Socket de datos conectado.');
      resolverConectado();
    });

    socket.on('error', (err) => {
      clearTimeout(timer);
      logErr('Error en socket de datos:', err.message);
      rechazarConectado(err);
    });

    socket.on('close', () => {
      clearTimeout(timer);
      log('Socket de datos cerrado.');
    });

    return { socket, conectado };
  }

  /**
   * Envía un buffer completo por un socket ya conectado.
   * Sin callback de write — react-native-tcp-socket no lo garantiza.
   * El cierre se hace con un delay para asegurar que el buffer se vacíe.
   */
  _enviarBufferPorSocket(socket, buffer, totalBytes, onProgreso) {
    return new Promise((resolve, reject) => {
      socket.on('error', (err) => reject(err));

      setImmediate(() => {
        log(`Escribiendo ${totalBytes} bytes en socket de datos...`);
        try {
          socket.write(buffer); // sin callback — no es confiable en react-native-tcp-socket

          setTimeout(() => {
            log(`Cerrando socket de datos...`);
            if (typeof onProgreso === 'function') onProgreso(totalBytes, totalBytes);
            socket.end();
            resolve();
          }, 500);

        } catch (err) {
          socket.destroy();
          reject(err);
        }
      });
    });
  }

  /**
   * Lee un archivo local en chunks y los envía por un socket ya conectado.
   * Sin callback de write — react-native-tcp-socket no lo garantiza.
   * Entre chunks hay un yield de 50ms para no bloquear el event loop.
   */
  _enviarChunksPorSocket(socket, uriLocal, totalBytes, onProgreso) {
    return new Promise((resolve, reject) => {
      socket.on('error', (err) => reject(err));

      const CHUNK_BYTES = 192 * 1024;
      let bytesSent   = 0;
      let offsetBytes = 0;

      const enviarChunk = async () => {
        if (offsetBytes >= totalBytes) {
          // Dar margen para que el buffer de red se vacíe antes de cerrar
          setTimeout(() => {
            log(`Todos los chunks enviados (${bytesSent} bytes), cerrando socket...`);
            socket.end();
            resolve();
          }, 500);
          return;
        }

        const bytesALeer = Math.min(CHUNK_BYTES, totalBytes - offsetBytes);

        try {
          const chunkB64 = await FileSystem.readAsStringAsync(uriLocal, {
            encoding: FileSystem.EncodingType.Base64,
            position: offsetBytes,
            length:   bytesALeer,
          });

          const chunkBuffer = Buffer.from(chunkB64, 'base64');
          offsetBytes += chunkBuffer.length;
          log(`Chunk: ${chunkBuffer.length} bytes, offset: ${offsetBytes}/${totalBytes}`);

          socket.write(chunkBuffer); // sin callback

          bytesSent += chunkBuffer.length;
          if (typeof onProgreso === 'function') onProgreso(bytesSent, totalBytes);

          // Yield para no bloquear el event loop entre chunks
          await new Promise(r => setTimeout(r, 50));
          enviarChunk();

        } catch (err) {
          socket.destroy();
          reject(err);
        }
      };

      setImmediate(() => enviarChunk());
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