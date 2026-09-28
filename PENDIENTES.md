# Pendientes — app-vecindad

## Respaldo local de fotos/videos/PDFs (módulo nativo `actas-storage`)

Estado al 2026-09-21: el módulo Kotlin compila (`:actas-storage:compileDebugKotlin`
→ `BUILD SUCCESSFUL`), está enlazado por autolinking, y `expo run:android`
generó e instaló la app en el emulador `Small_Tablet` sin errores ni crashes
en logcat. `asegurarCarpetaRespaldo()` ya se llama desde
`hooks/useUploadQueue.js` antes de encolar un acta.

Lo que **no** se probó todavía (falta hacerlo en un dispositivo real o en el
emulador con la app completa, iniciando sesión y llenando un acta de verdad):

- [ ] Que el diálogo "Guardar copia de los archivos" aparezca la primera vez
      que se encola un acta, y que el selector del sistema (SAF) devuelva una
      URI `content://com.android.externalstorage.documents/...` válida.
- [ ] Que `ActasStorage.copiarAArbol` copie fotos/video/PDF a esa carpeta sin
      corromperlos (la verificación de tamaño en `respaldarEnCarpetaElegida`
      debería atajar una copia incompleta, pero no se ha visto en la práctica).
- [ ] Que la subida SFTP (`FtpuploadServices.js`) lea esos archivos
      `content://` con `ActasStorage.copiarAArchivo` y los suba bien
      (probar sobre todo con el video, que es el archivo grande).
- [ ] Que `borrarRespaldo` borre la subcarpeta del acta cuando el backend
      confirma la carga, y que no la borre si falla el envío.
- [ ] Qué pasa si el usuario revoca el permiso de la carpeta desde Ajustes de
      Android mientras hay un acta pendiente en la cola.
- [ ] Probar en un teléfono real (no solo el emulador) — Android 11+ tiene
      restricciones de SAF que el emulador podría no reproducir igual.

## Documentos adicionales se pierden al editar un acta

Encontrado el 2026-09-28. Al editar un acta ya subida (p. ej. una que
devolvieron), `app/form.tsx` carga fotos, fachada, videos y firmas desde
`GET /api/registros/:uuid/acta`, pero **no** carga `multimedia.documentos`.
Además, `construirListaMultimedia` en `services/FtpuploadServices.js` salta
los documentos que no son locales (`if (!esURILocal(uri)) continue;`). Por eso,
al re-subir el acta, el nuevo `datos.json` sale sin los documentos anexos que
tenía. Los archivos siguen en la carpeta del servidor, pero el acta ya no los
lista.

- [x] En `cargarActa` (`app/form.tsx`), cargar `data.multimedia.documentos`
      en `documentosAdicionales` (con su `url`, nombre y descripción).
- [x] En `construirListaMultimedia`, para los documentos con URL remota:
      descargarlos con `descargarURLATemp` y re-subirlos, igual que hoy se hace
      con fotos y videos.
- [ ] Probarlo: editar un acta con documentos, re-subirla y confirmar que el
      acta los sigue mostrando.

## Push

- [x] 2026-09-22: pusheados a `origin/master` los 3 commits que ya estaban
      listos (respaldo local, marca de agua, encabezado versionado) más el
      cableado del módulo nativo.
