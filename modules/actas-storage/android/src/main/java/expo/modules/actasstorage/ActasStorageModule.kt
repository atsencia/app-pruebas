package expo.modules.actasstorage

import android.content.Context
import android.net.Uri
import android.provider.DocumentsContract
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream

private const val BUFFER = 256 * 1024

/**
 * Copia y borra archivos dentro de una carpeta que el usuario eligió con el
 * selector del sistema (Storage Access Framework).
 *
 * expo-file-system no sirve para esto: `copyAsync` y `File.copy` solo aceptan
 * `file://` como destino, y `File.write` sobre una ruta SAF reescribe el archivo
 * entero en cada llamada (no permite escribir por trozos), lo que obligaría a
 * cargar un video completo en memoria. Aquí todo se copia por flujo, con un
 * buffer fijo, y las funciones son AsyncFunction (corren fuera del hilo de UI).
 */
class ActasStorageModule : Module() {
  private val context: Context
    get() = appContext.reactContext
      ?: throw CodedException("ERR_SIN_CONTEXTO", "Sin contexto de React", null)

  private val resolver get() = context.contentResolver

  override fun definition() = ModuleDefinition {
    Name("ActasStorage")

    // ¿Sigo teniendo permiso de escritura sobre la carpeta elegida (y existe)?
    AsyncFunction("tienePermiso") { arbolUri: String ->
      tienePermisoEscritura(Uri.parse(arbolUri))
    }

    // Nombre visible de la carpeta elegida (p. ej. "Actas Vecindad").
    AsyncFunction("nombreCarpeta") { arbolUri: String ->
      val arbol = Uri.parse(arbolUri)
      val raiz = raizDelArbol(arbol)
      resolver.query(raiz, arrayOf(DocumentsContract.Document.COLUMN_DISPLAY_NAME), null, null, null)
        ?.use { if (it.moveToFirst()) it.getString(0) else null }
    }

    // Copia `origen` (file:// o content://) a <arbol>/<subcarpeta>/<nombre>,
    // creando la subcarpeta si no existe. Devuelve la URI del archivo creado,
    // la de la subcarpeta (para borrarla al confirmar la carga) y los bytes copiados.
    AsyncFunction("copiarAArbol") { origen: String, arbolUri: String, subcarpeta: String, nombre: String, mime: String ->
      val arbol = Uri.parse(arbolUri)
      if (!tienePermisoEscritura(arbol)) {
        throw CodedException("ERR_SIN_PERMISO", "La app ya no tiene acceso a la carpeta elegida", null)
      }

      val dir = obtenerOCrearDirectorio(arbol, raizDelArbol(arbol), subcarpeta)
      val destino = DocumentsContract.createDocument(resolver, dir, mime, nombre)
        ?: throw CodedException("ERR_CREAR", "No se pudo crear '$nombre' en la carpeta elegida", null)

      try {
        val bytes = abrirEntrada(origen).use { entrada ->
          (resolver.openOutputStream(destino, "w")
            ?: throw CodedException("ERR_ESCRIBIR", "No se pudo abrir '$nombre' para escribir", null)
          ).use { salida -> entrada.copyTo(salida, BUFFER) }
        }
        mapOf("uri" to destino.toString(), "dirUri" to dir.toString(), "bytes" to bytes)
      } catch (e: Exception) {
        // No dejar un archivo a medias en la carpeta del usuario.
        try { DocumentsContract.deleteDocument(resolver, destino) } catch (_: Exception) {}
        throw e
      }
    }

    // Copia un archivo de la carpeta elegida (content://) a un archivo local
    // (file://): así la subida SFTP lo lee igual que cualquier otro.
    AsyncFunction("copiarAArchivo") { origen: String, destino: String ->
      val ruta = Uri.parse(destino).path ?: destino
      File(ruta).parentFile?.mkdirs()
      abrirEntrada(origen).use { entrada ->
        FileOutputStream(ruta).use { salida -> entrada.copyTo(salida, BUFFER) }
      }
    }

    // Borra un archivo o una carpeta (con todo su contenido). true si ya no existe.
    AsyncFunction("eliminar") { uri: String ->
      try {
        DocumentsContract.deleteDocument(resolver, Uri.parse(uri))
        true
      } catch (e: java.io.FileNotFoundException) {
        true // ya no estaba
      }
    }

    AsyncFunction("existe") { uri: String -> existe(Uri.parse(uri)) }

    AsyncFunction("tamano") { uri: String ->
      resolver.query(Uri.parse(uri), arrayOf(DocumentsContract.Document.COLUMN_SIZE), null, null, null)
        ?.use { if (it.moveToFirst() && !it.isNull(0)) it.getLong(0) else -1L } ?: -1L
    }
  }

  private fun normalizada(uri: Uri) = uri.toString().trimEnd('/')

  private fun raizDelArbol(arbol: Uri): Uri =
    DocumentsContract.buildDocumentUriUsingTree(arbol, DocumentsContract.getTreeDocumentId(arbol))

  private fun existe(uri: Uri): Boolean = try {
    resolver.query(uri, arrayOf(DocumentsContract.Document.COLUMN_DOCUMENT_ID), null, null, null)
      ?.use { it.moveToFirst() } ?: false
  } catch (_: Exception) {
    false
  }

  private fun tienePermisoEscritura(arbol: Uri): Boolean {
    val concedido = resolver.persistedUriPermissions.any {
      normalizada(it.uri) == normalizada(arbol) && it.isReadPermission && it.isWritePermission
    }
    return concedido && existe(raizDelArbol(arbol))
  }

  private fun abrirEntrada(origen: String): InputStream {
    val uri = Uri.parse(origen)
    return if (uri.scheme == "content") {
      resolver.openInputStream(uri)
        ?: throw CodedException("ERR_LEER", "No se pudo abrir el origen '$origen'", null)
    } else {
      File(uri.path ?: origen).inputStream()
    }
  }

  // Busca una subcarpeta por nombre bajo `padre`; si no existe, la crea.
  private fun obtenerOCrearDirectorio(arbol: Uri, padre: Uri, nombre: String): Uri {
    val hijos = DocumentsContract.buildChildDocumentsUriUsingTree(arbol, DocumentsContract.getDocumentId(padre))
    resolver.query(
      hijos,
      arrayOf(
        DocumentsContract.Document.COLUMN_DOCUMENT_ID,
        DocumentsContract.Document.COLUMN_DISPLAY_NAME,
        DocumentsContract.Document.COLUMN_MIME_TYPE,
      ),
      null, null, null,
    )?.use { c ->
      while (c.moveToNext()) {
        if (c.getString(1) == nombre && c.getString(2) == DocumentsContract.Document.MIME_TYPE_DIR) {
          return DocumentsContract.buildDocumentUriUsingTree(arbol, c.getString(0))
        }
      }
    }
    return DocumentsContract.createDocument(resolver, padre, DocumentsContract.Document.MIME_TYPE_DIR, nombre)
      ?: throw CodedException("ERR_CREAR", "No se pudo crear la carpeta '$nombre'", null)
  }
}
