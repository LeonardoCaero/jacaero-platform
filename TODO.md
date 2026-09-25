# TODO

Última actualización: 24/09/2026. El detalle del día a día está en el historial de commits.

## Estado actual

En producción en https://plataforma.caero.group, corriendo en el NAS (`~/Projects/jacaero-platform`). Cada push a `main` se despliega solo: GitHub Actions entra por SSH vía Tailscale, hace `git pull` y `docker compose up --build`.

La plataforma vieja (`platform-api`/`platform-frontend`) está apagada. Esta ocupa su dominio, sus puertos (`4000`/`8080`) y el nginx del NAS.

## Hecho

- **Despliegue**: Docker Compose con healthchecks, migraciones al arrancar (`docker-entrypoint.sh`), CI con lint/test/build en cada push y deploy automático en push a `main`.
- **Dominio y TLS**: nginx del sistema como proxy (`/api/` al backend, `/` al frontend). Certificado de Let's Encrypt con renovación automática.
- **DNS**: gestionado en Cloudflare desde el 02/09/2026, después de que cambiara la IP del NAS y la web se quedara caída desde fuera. El registro de `plataforma.caero.group` lo actualiza el DDNS de UGOS (Panel de Control > Acceso Remoto > DDNS). Los registros de correo (Google Workspace y Resend) se comprobaron tras la migración.
- **Documentos**: `DOCS_ROOT_PATH` apunta a un bind mount del NAS (`/volume1/@home/jose/J.A. CAERO S.L` montado en `/docs`). No hizo falta CIFS.
- **Seguridad**: `helmet`, rate limit en `/auth/login`, logs con timestamp y `trust proxy` activado para que el rate limit vea la IP real detrás de nginx.
- **Backup de Postgres**: cron de root a las 3:00, `pg_dump` comprimido en `/home/Leo/backups/jacaero-platform/`, se guardan 30 días.
- **Notificaciones push** (VAPID + service worker): pedido nuevo, invitación enviada, alguien entra al equipo y horas registradas. Van por dispositivo, así que el que hace la acción no se notifica a sí mismo. En Equipo se puede desactivar el aviso de horas por usuario (`User.notifyTimeEntries`) sin quitarle `TIME:VIEW_ALL`.
- **PWA**: instalable, sin caché offline. En "Acerca de" sale la versión desplegada y un changelog corto. La app se recarga sola cuando detecta un deploy nuevo.
- **Invitaciones**: se elige el idioma al invitar y el correo sale entero en ese idioma. Los roles pueden tener nombre en inglés (`nameEn`). El logo va como adjunto `cid:` porque los clientes de correo bloqueaban el `data:` URI.
- **Equipo**: editar, activar/desactivar y eliminar desde la propia fila. Eliminar borra al usuario y todo lo suyo en cascada, con aviso previo. Desactivar es lo reversible.
- **Clientes y contratos**: backend completo y pantallas `ClientsPage`/`ClientDetailPage` con clientes, ubicaciones, contactos y contratos.
- **Time Tracker**:
  - En la vista "Todos", al pulsar un día se ven las horas de todo el equipo y, con `TIME:EDIT_ALL`, se pueden editar.
  - Se pueden adjuntar hasta 6 fotos de 8 MB por entrada. Se guardan en `./uploads` (bind mount, así entran en el backup del NAS) y se sirven solo con sesión. Se borran del disco al quitar la foto o la entrada.
- **Pedidos por email**: el listener IMAP IDLE sustituye al polling, así que los pedidos aparecen al momento.
- **Vincular documentos a pedidos**: pantalla `/papeleo/pedidos/:id/reconcile` con el pedido a un lado y los candidatos al otro. El matching automático vincula un candidato único por número aunque el importe no cuadre exacto.
- **Ver pedidos**: el ojo de la tarjeta y "Ver PDF" abren el PDF con `window.open(blob)`, como en Documentos. Un `<iframe>` en un modal no funciona en móvil, así que no vale la pena volver a probarlo.
- **Compartir documentos**: el botón "Compartir" genera un enlace a la app y usa `navigator.share()` o, si no hay, lo copia. El enlace pide login y, tras entrar, vuelve al documento. Se descartó un enlace público con token porque son datos sensibles.
- **FACTURAR OK automático**: `syncFacturarOk()` se ejecuta al arrancar y cada hora. Busca en Enviados los albaranes (`NNN ALBARÁN ...`) y guarda la fecha de envío en `albaranSentAt`. A las 48 h sin factura pone la etiqueta `FACTURAR OK` al correo del pedido. Cuando se vincula la factura, pone `Factura` y quita `Albarán` y `FACTURAR OK`. Ojo: ImapFlow ya entrecomilla los nombres de etiqueta, así que no hay que añadir comillas. Solo funciona si el albarán ya está vinculado al pedido.
- **Calendario** (`/calendar`): notas con título, detalles, color y rango de fechas para ausencias. Hay tres visibilidades: solo yo, algunas personas (`CalendarEventAssignee`) y toda la empresa (`COMPANY`). Solo el autor edita. Con `CALENDAR:MANAGE` se ve y edita todo, también las notas privadas. `GET /calendar/people` da la lista de usuarios para compartir. Las notas admiten fotos igual que el fichaje. El código de subida está en `common/utils/photo-upload.ts` y las miniaturas en `components/Photos.tsx`. Con varias fotos la vista previa es una cuadrícula (`PhotoGallery`) y al pulsar una se abre a pantalla completa, con flechas y Esc. Al guardar se puede elegir a quién avisar (`notify`): les llega un push, pero solo si pueden ver la nota.
- **Detalles de interfaz**: favicon con el logo recortado y skeletons de carga en Documentos y Pedidos.

## Pendiente

- [ ] Decidir si hacen falta logs de acceso HTTP (`morgan` o parecido).
- [ ] Vincular a mano los pedidos que sigan pendientes en `/papeleo/pedidos` de meses que no sean agosto de 2026.

La rotación de `TS_OAUTH_SECRET` no tiene aviso, y es a propósito.

## Ideas para más adelante

- Recordatorios del calendario: un intervalo diario como el de `syncFacturarOk` que mire `reminderDaysBefore`, más un campo `reminderSentAt`.
- Avisos por email (Resend) para cosas importantes, como un contrato a punto de vencer.
- SSE para refrescar los contadores en pestañas abiertas.
- Albaranes mensuales automáticos a partir de `TimeEntry` y `ContractResourceRate`.
- Que `email-orders` pueda crear documentos en el NAS, no solo leerlos.
- Interfaz para Notas.
- Interfaz para el Audit Log (el modelo ya existe).
