# App Vecindad

App Android (Expo / React Native) para levantar actas de vecindad en campo:
datos del predio, fotos, videos, documentos y firmas. Las actas se suben por
SFTP al servidor y se revisan en el panel web de `backend-vecindad`.

## Documentación

La documentación completa del sistema (app + backend) vive en el repo
**`backend-vecindad`**, carpeta `docs/`:

- `docs/SISTEMA.md` — cómo encajan app, SFTP, processor, API y panel; recorrido de un acta; revisión, firmas y lotes.
- `docs/APP.md` — esta app: estructura, pantallas, cola de subida, lote Predio Coliseo, configuración.
- `docs/OPERACION.md` — builds de EAS, updates por aire y desarrollo local.

Trabajo abierto de la app: `PENDIENTES.md`. (`replit.md` es de la plantilla
inicial y está desactualizado.)

## Arranque rápido

```bash
npm install
npx expo run:android
```

Para apuntar a un backend local, definir `EXPO_PUBLIC_API_BASE` y las
`EXPO_PUBLIC_SFTP_*` en `.env.local` (ver `docs/APP.md`).

Publicar un cambio solo de JavaScript sin APK nuevo:

```bash
eas update --channel production --message "descripción del cambio"
```
