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
      exige la firma de interventoría y que no falte ninguna de las demás.
- [x] Celular del propietario: si el app no lo trajo, Social lo carga en el
      modal "Enviar firma" eligiendo Propietario (se guarda en
      `prop_telefono` al generar el link, igual que el correo).
- [x] El app ya no deja editar fuera de `recibida`/`devuelta_gestor`
      (`Registrodetailsheet.tsx`), así que no hay re-subida después de la
      firma de Interventoría.
- [x] Panel: "Enviar firma" con el acta en Social o confirmada (la opción
      Interventoría solo con el acta confirmada); "Cerrar acta" desactivado
      hasta que Interventoría firme.
- [x] Actas viejas que Interventoría firmó sin estar completas (decidido:
      opción b): con el acta confirmada, Social puede pedir las firmas que
      falten, y no se cierra hasta tenerlas. Cuando está completa, nada más.
- [x] Probado contra el API y la base locales (2026-09-28): flujo normal
      con el acta madre (16) y acta vieja firmada (17), incluido firmar por
      link y cerrar.
- [ ] ¿Las actas madre también deben exigir estas firmas y datos? Hoy sí.

## Movistar Arena: firmas de los directores por lote (decidido 2026-09-29)

**El caso:** las actas del lote (≈300 zonas × inicio/seguimiento/cierre,
hasta ~6000) las levanta en sitio el personal de campo, que firma ahí. Pero
los firmantes "oficiales" son los mismos directores para todo el lote
(interventoría, Movistar, Sencia). Firmar en sitio está bien.

**Lo decidido:**
- En observaciones queda siempre quién estuvo y firmó en sitio (los dos
  profesionales y el delegado de interventoría), aunque después la firma
  del recuadro se reemplace por una hecha por link.
- Los datos del propietario y de los directores (incluido el delegado de
  interventoría) se llenan en el acta madre y pasan a todas las zonas (la
  firma del propietario no).
- Si los directores quieren firmar, se les manda **un link por lote** y
  firman **todas** las actas de una vez (sin desmarcar: la revisión ya la
  hacen Sencia e Interventoría). La firma queda en el recuadro de cada acta.
- Las actas normales siguen con firmas individuales.

- [x] **a)** Observaciones: `acta_data.js` agrega "Personal en sitio:" con
      nombre, cargo y cédula de lo capturado en el app (concesionario,
      profesional, delegado de interventoría). Probado en local.
- [ ] **b)** App: el acta madre del lote Movistar lleva propietario y los
      datos de los directores; cada zona los hereda (hoy solo hereda el
      encabezado del predio, ver `CAMPOS_CABECERA_LOTE`).
- [x] **c)** Backend + panel: link por lote (2026-09-29).
      Botón "Firmas del lote" en el acta madre → `POST
      /api/registros/:uuid/enviar-firma-lote` crea un token por acta que se
      pueda firmar, todos con el mismo `firma_tokens.lote` (migración
      `migrate_2026-09-firma-lote.sql`, agregada al deploy). La página de
      firma lista las actas (`GET /api/firma/lote`) y al firmar se guarda
      en cada una (`cargarFirmaLote`). Probado en local con el acta madre;
      falta probar un lote con varias zonas abiertas y el panel en el
      navegador.
- [x] Varias actas madre del mismo proyecto (inicio/seguimiento/cierre, o
      un lote nuevo al año): antes cada zona se ligaba a la madre MÁS
      RECIENTE del código de proyecto, así que con dos madres abiertas las
      zonas podían caer en la equivocada. Ahora el app manda
      `formulario.actaMadreUuid` (lo guarda el lote activo al enviar la
      madre) y `processor.py` (`buscar_acta_madre`) liga por ese UUID. Las
      zonas de versiones viejas del app siguen con la regla anterior.
- [x] Probado en local (2026-09-29) con un lote de prueba insertado a mano
      (`20260929PRUEBA*`): madre de inicio + 3 zonas, madre de seguimiento
      + 2 zonas, y una zona "vieja" sin UUID. Las zonas quedaron con su
      madre; los 4 links por lote firmaron las actas de inicio y no
      tocaron las de seguimiento; interventoría dejó fuera la zona sin
      confirmar y la firmó después con un link nuevo; las observaciones
      muestran el personal en sitio y los recuadros a los directores.
- [x] Un gestor no alterna entre lotes (decidido), pero varios gestores
      trabajan el mismo lote: antes el lote solo existía en el celular que
      subió la madre. Ahora en la sección Movistar Arena hay "Elegir acta
      madre" (`ElegirActaMadreModal`, `GET /api/lotes/madres?codigo=`): baja
      el encabezado de la madre elegida y la deja como lote del teléfono
      (`usarActaMadre`). La zona nueva toma el tipo de acta de su madre y el
      formulario muestra arriba "Relacionada con Acta madre N° …".
- [ ] Probar "Elegir acta madre" en el app (emulador o teléfono) contra el
      backend local: elegir la madre de seguimiento de prueba (25), crear
      una zona y ver que llegue ligada a la 25.
- [ ] Los cambios del app (UUID de la madre) necesitan un build nuevo.
- [x] Qué recuadro llena cada director: interventoría → Interventoría;
      Movistar → propietario; Sencia → concesionario; representante legal
      de la empresa que inspeccionó → profesional técnico. Si un director
      no firma, queda la firma de quien estuvo en sitio.
- [ ] Espacio: ~6000 actas × lo que pesen fotos y videos (el acta 17 local
      pesa 16 MB → ~100 GB). Revisar `df -h` en prod.

## Push

- [x] 2026-09-22: pusheados a `origin/master` los 3 commits que ya estaban
      listos (respaldo local, marca de agua, encabezado versionado) más el
      cableado del módulo nativo.
