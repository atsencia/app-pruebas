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

## Volver a pedir una firma por link (decidido, sin implementar)

Decidido el 2026-09-28. Todo el trabajo es en `backend-vecindad`: la API y el
panel. El app no cambia.

**Hoy:** una firma hecha por link es definitiva. Si firmó la persona
equivocada o con datos mal escritos, no hay forma de corregirla desde el panel.

**Lo decidido:** que Social pueda mandar un link nuevo a un firmante que ya
firmó. La firma nueva reemplaza a la anterior (vale solo la última) y,
mientras no se firme el link nuevo, la anterior sigue valiendo, así que el
acta nunca queda sin firma. No hay botón de "anular" aparte.
Con el acta `cerrada` no se puede: eso ya lo bloquean `enviarLinkFirma` y
`cargarFirma`.

**El historial sale solo:** cada firma queda en su propio archivo
(`firma_link_<firmante>_<timestamp>.png`, ver `guardarImagenFirma`) y cada
link en `firma_tokens` (quién, cuándo, `usado`, `firmado_en`). Al firmar,
`guardarFirma*` sobrescribe las columnas del firmante en `registros`, así
que la última gana sin más lógica. `invalidarTokensAnteriores` ya desactiva
los links viejos que no se usaron.

- [ ] `enviarLinkFirma` (`usercontroller.js`): quitar el 409 "ya firmó por
      link; esa firma es la definitiva". Si ya firmó, pedir `reemplazar: true`
      en el body (así el panel obliga a confirmar) y responder 409 con la fecha
      de la firma actual si no viene.
- [ ] `cargarFirma` (`Firma.js`): quitar el bloqueo "Este firmante ya firmó
      el acta". Basta con que el token esté activo y sin usar.
- [ ] Panel: con la firma ya puesta, el botón pasa a "Pedir firma de nuevo" y
      pide confirmar: "X ya firmó el DD/MM. Si firma de nuevo, esa firma
      reemplaza la anterior. ¿Continuar?". Permitir cambiar el correo.
- [ ] (Opcional) En el detalle del acta, mostrar las firmas anteriores
      (fecha y nombre) a partir de `firma_tokens`.
- [x] Excel: no hace falta nada. Se mandan todas las actas (menos las que
      siguen subiendo), no solo las cerradas, y cualquier cambio (firma,
      correo, estado) sube `actualizado_en` y la fila se reenvía. El "Link
      al acta" es `acta.html?id=<uuid>` y no cambia al cerrar: antes muestra
      los datos vivos y después la copia congelada `datos.cerrado.json`.
- [ ] Probar: firmar → pedir de nuevo → el acta sigue con la vieja → firmar
      el link nuevo → queda la nueva. El link viejo sin usar ya no sirve, y
      con el acta cerrada no deja pedirla.

### Qué firma se puede pedir en cada estado (decidido el 2026-09-28)

- Propietario, concesionario y profesional firman **antes** de que
  Interventoría revise el acta. Interventoría da el check sobre un acta que
  ya tiene esas firmas.
- Con el acta `confirmada_interventoria`, la única firma que se puede pedir
  es la del delegado de Interventoría. Cuando él firma, Social cierra.
- Después de la firma del delegado de Interventoría el acta **no se puede
  editar**: ni otra firma, ni pedirle de nuevo la suya, ni re-subirla desde
  el app.

- Concesionario y profesional: firma obligatoria. Propietario: la firma
  **no** es obligatoria, pero sus datos personales sí (nombre, cédula y
  celular; por confirmar si el correo también).
- Propietario: nombre, cédula, celular y correo, todos obligatorios.
- ~~El bloqueo va al enviar a Interventoría~~ Cambiado el mismo día:
  Interventoría puede revisar y confirmar aunque falten firmas. Con el acta
  confirmada, Social pide las que falten y, cuando están todas, le pide la
  firma al delegado de Interventoría. Lo que se bloquea es ese link.

Implementado el 2026-09-28 en `backend-vecindad`:

- [x] `motivoFirmaNoPermitida` (`RevisionController.js`), usado por
      `enviarLinkFirma`, `vistaFirma` y `cargarFirma`: propietario,
      concesionario y profesional solo en `recibida`, `devuelta_gestor` y
      `devuelta_interventoria` y `confirmada_interventoria`; interventoría
      solo en `confirmada_interventoria`; con `inter_firma` puesta, nada más.
- [x] El link (y la firma) de Interventoría exige
      (`faltantesParaFirmaInterventoria`) firmas de concesionario y
      profesional y nombre, cédula, celular y correo del propietario (mira la
      base y el `datos.json`, porque las firmas del app viven ahí). `cerrar`
      exige la firma de interventoría.
- [x] Celular del propietario: si el app no lo trajo, Social lo carga en el
      modal "Enviar firma" eligiendo Propietario (se guarda en
      `prop_telefono` al generar el link, igual que el correo).
- [x] El app ya no deja editar fuera de `recibida`/`devuelta_gestor`
      (`Registrodetailsheet.tsx`), así que no hay re-subida después de la
      firma de Interventoría.
- [x] Panel: "Enviar firma" con el acta en Social o confirmada (la opción
      Interventoría solo con el acta confirmada); "Cerrar acta" desactivado
      hasta que Interventoría firme.
- [ ] Probarlo contra una base real (solo se probaron las reglas aisladas).
- [ ] Actas viejas: las que ya tienen `inter_firma` del flujo anterior
      quedan bloqueadas para otras firmas. ¿Las actas madre también deben
      exigir estas firmas y datos?

## Push

- [x] 2026-09-22: pusheados a `origin/master` los 3 commits que ya estaban
      listos (respaldo local, marca de agua, encabezado versionado) más el
      cableado del módulo nativo.
