# TODO — jacaero-platform

Última actualización: 2026-09-22. Para el detalle día a día, ver el historial de commits de `develop`/`main`.

## Estado actual: en producción

**https://plataforma.caero.group** — dominio propio, TLS válido (Let's Encrypt, renovación automática vía systemd timer de certbot), corriendo en el NAS (`~/Projects/jacaero-platform`), auto-deploy funcionando de punta a punta (push a `main` → GitHub Actions → SSH por Tailscale → `git pull` + `docker compose up --build`).

La plataforma vieja (`platform-api`/`platform-frontend`) está apagada; `jacaero-platform` heredó su dominio, puertos (`4000`/`8080`) y el nginx del sistema del NAS.

## Completado

- **Infra de despliegue**: Docker Compose + healthchecks, migraciones automáticas al arrancar el contenedor (`docker-entrypoint.sh`), CI (lint/test/build en cada push) y CD (auto-deploy en push a `main`) en GitHub Actions, todo verificado end-to-end con commits reales.
- **Dominio + TLS**: `plataforma.caero.group`, nginx del sistema como reverse proxy (`/api/` → backend, `/` → frontend), certificado con renovación automática.
- **Documentos**: `DOCS_ROOT_PATH` apunta a un bind mount local del NAS (`/volume1/@home/jose/J.A. CAERO S.L` → `/docs` en el contenedor) — no hizo falta CIFS, los documentos ya vivían en el propio NAS.
- **Seguridad**: `helmet`, rate-limit en `/auth/login`, logger con timestamp, y **`trust proxy` corregido** (2026-08-24 — el rate-limiter no confiaba en el `X-Forwarded-For` de nginx, arreglado).
- **Notificaciones**: push web (VAPID) con service worker. Eventos conectados: pedido nuevo (email → `ORDERS:MANAGE`), invitación enviada, alguien se une al equipo (`USERS:MANAGE`), y horas registradas (`TIME:VIEW_ALL`). Cada suscripción se guarda por dispositivo — al hacer una acción, el propio dispositivo que la hizo no recibe su propia notificación (el resto de tus dispositivos y los de otros admins sí). Silenciar solo la notificación de horas sin quitar `TIME:VIEW_ALL` (y por tanto sin perder la vista de equipo): checkbox "Notificar horas registradas" en el editar-usuario de Equipo → campo `User.notifyTimeEntries` (default `true`).
- **App instalable (PWA)**: `manifest.json` + service worker registrado siempre (sin caché offline). Pantalla "Acerca de" (menú de ajustes) con la versión desplegada (hash corto de `git`) y un changelog corto. La app comprueba la versión al cambiar de pantalla y se recarga sola si detecta un despliegue nuevo.
- **Vinculación manual de documentos**: pantalla nueva `/papeleo/pedidos/:id/reconcile` — preview del pedido a la izquierda, lista de documentos candidatos + preview a la derecha, vincula presupuesto/albarán/factura con un clic. Matching automático mejorado: un único candidato por número se vincula sin exigir que el importe coincida exacto (antes bloqueaba casos legítimos como presupuestos "paraguas" repartidos en varios pedidos, u horas donde el cliente solo factura una parte).
- **Invitaciones multi-idioma**: se elige el idioma al invitar (por defecto el tuyo), se guarda en la invitación, el correo (asunto, cuerpo, botón, pie) sale en ese idioma. Logo del correo arreglado (era `data:` URI, la mayoría de clientes de correo lo bloquean — ahora va como adjunto `cid:`).
- **Roles con nombre en inglés** (`nameEn`, opcional) — se usa en el correo de invitación cuando el idioma es inglés; si no se rellena, usa el nombre normal.
- **Time Tracker — vista "Todos" editable**: como admin, al hacer clic en un día en la vista de equipo, se ven las horas de *todo el mundo* ese día (con nombre), y se pueden editar/borrar si tienes `TIME:EDIT_ALL` (permiso que existía en el seed pero no se usaba en ningún sitio hasta ahora).
- **Time Tracker — fotos**: al registrar/editar horas se pueden adjuntar imágenes (hasta 6, 8MB c/u). Guardadas en disco bajo `./uploads` (bind mount, mismo patrón que `local-docs`/`DOCS_HOST_PATH` — en el NAS cae dentro de `~/Projects/jacaero-platform/uploads`, no en un volumen Docker anónimo, para que quede cubierto por el backup del NAS). Servidas por endpoint autenticado (`GET /time-entries/:id/photos/:filename`), no estáticas ni públicas. Se borran del disco al borrar la foto o la propia entrada.
- **Gestión de usuarios con iconos**: editar / activar-desactivar / eliminar directamente en la fila, sin abrir un formulario. "Eliminar" es un borrado físico real y en cascada (horas, notas, eventos de calendario, tokens, suscripciones push, perfil) — sin bloqueo, solo un aviso de confirmación explicando que es irreversible. "Desactivar" sigue siendo el borrado lógico/reversible para gente con historial real.
- **Favicon**: SVG del logo de la empresa, recortado para que se vea bien de pequeño (antes tenía demasiado margen).
- **Loading skeletons**: Documentos y Pedidos de clientes muestran un shimmer mientras cargan, en vez de "Cargando..." o nada.
- **Backup diario de Postgres**: cron de `root` a las 3am, `pg_dump` comprimido a `/home/Leo/backups/jacaero-platform/` (fuera del repo, no lo toca un deploy), rota a 30 días.
- **Clients & Contracts**: módulo backend completo + `ClientsPage`/`ClientDetailPage` en el frontend — alta/edición de cliente, ubicaciones, contactos y contratos (todo con edición, no solo alta/baja). `README.md` actualizado para reflejar el estado real de la plataforma (estaba desactualizado desde antes de todo el trabajo reciente).
- **Pedidos por email en tiempo real**: se reemplazó el polling (`setInterval` cada `ORDERS_POLL_MINUTES`) por un listener IMAP IDLE persistente — la lista se actualiza al instante al llegar un correo, sin sondear.
- **Compartir documentos (2026-09-22)**: en Documentos (presupuesto/albarán/factura/pedido de material), botón "Compartir" junto a cada PDF — genera un enlace a la propia app (misma ruta + `?open=1&number=&ext=&year=`) y lo pasa por `navigator.share()` (o lo copia al portapapeles si el navegador no soporta Web Share API). Antes solo se podía "Ver" el PDF, que abría un `blob:` local al navegador — imposible de reenviar a nadie (un compañero intentó compartir uno así y no abría). El enlace sigue exigiendo login: si quien lo abre no tiene sesión, `ProtectedRoute` lo manda a `/login` y vuelve automáticamente a por el documento tras iniciar sesión (primer intento fue un token público sin login — descartado por ser datos sensibles sin forma de revocar por destinatario).
- **Previsualizar pedidos (2026-09-23)**: en `/papeleo/pedidos`, botón de ojo en cada tarjeta y "Ver PDF" en el detalle abren el PDF con `window.open(blob)`, igual que Documentos (el sistema lo abre en su visor). Se probó primero un modal con `<iframe>`, pero en móvil/PWA no renderiza PDFs — no volver a esa vía.
- **FACTURAR OK automático (2026-09-23)**: `syncFacturarOk()` (al arrancar + cada hora) busca en Enviados de Gmail los adjuntos `NNN ALBARÁN ...` y guarda en `EmailOrder.albaranSentAt` la fecha de envío del albarán vinculado (primer envío posterior a la llegada del pedido). A las 48h, si no hay factura, pone la etiqueta Gmail `FACTURAR OK` al correo del pedido (búsqueda `from:remitente subject:<nº pedido>` en Todos) y guarda `facturarOkAt`; al vincularse la factura (`invoicedAt`) pone `Factura` y quita `Albarán` + `FACTURAR OK` (`facturaLabelAt`). OJO: ImapFlow ya entrecomilla solo los nombres de etiqueta — pre-entrecomillarlos creó una etiqueta basura `"FACTURAR OK"` (con comillas) en el primer despliegue. La app muestra la fecha de envío en el detalle y un badge FACTURAR OK en la tarjeta. Solo funciona si el albarán ya está vinculado al pedido (Vincular / manual).
- **Incidente DNS resuelto (2026-09-02)**: la IP pública del NAS cambió y el DNS (en Squarespace) se quedó apuntando a la vieja — la plataforma estuvo caída desde fuera mientras todo lo interno (containers, nginx) seguía sano. Se migró la gestión DNS de `caero.group` de Squarespace a **Cloudflare** (nameservers cambiados, todos los registros de correo — MX/SPF/DKIM de Google Workspace y Resend — verificados e intactos). El registro A de `plataforma.caero.group` ahora lo mantiene actualizado el **DDNS nativo de UGOS** (Panel de Control → Acceso Remoto → DDNS, proveedor Cloudflare, token con alcance limitado a esa zona) — ya no depende de nadie tocando DNS a mano cuando cambie la IP.
- **Calendario con notas (2026-09-24)**: `/calendar` (`CalendarPage`) + módulo backend `calendar` sobre `CalendarEvent`. Cualquiera con `CALENDAR:VIEW` crea notas (título, detalles, desde/hasta para ausencias de varios días vía `endDate`, color) con 3 visibilidades: **Solo yo** (`PERSONAL` sin asignados), **Algunas personas** (`PERSONAL` + `CalendarEventAssignee` = "compartida con") y **Toda la empresa** (`COMPANY`). Solo el autor edita/borra; quien la tiene compartida solo la ve. **Decisión del usuario: el admin (`CALENDAR:MANAGE`) ve y edita TODO, incluidas las "solo yo" de cada trabajador.** `GET /calendar/people` da la lista mínima de usuarios activos para compartir (porque `/users` exige `USERS:MANAGE`). Sin recordatorios todavía (`reminderDaysBefore` existe pero no se usa).

## Pendiente

- [ ] `morgan` (o equivalente) para logs de acceso HTTP — valorar si hace falta.
- [ ] Vincular a mano los pedidos de años/meses distintos a agosto 2026 que sigan pendientes en `/papeleo/pedidos` (ya tienes la pantalla para hacerlo).

No se están vigilando (decisión consciente): rotar `TS_OAUTH_SECRET`.

## Notificaciones — lo que falta si se quiere ampliar

- Recordatorios push del calendario: el módulo ya existe — bastaría un `setInterval` diario (como `syncFacturarOk`) que mire `reminderDaysBefore` + un campo `reminderSentAt`, sin node-cron.
- Notificación por email (Resend) para eventos clave (contrato por vencer, etc.) — depende de que exista el módulo Clients/Contracts.
- (Opcional) SSE para refrescar contadores en pestañas abiertas sin recargar.

## Roadmap de producto (decisiones tuyas, sin empezar)

- [ ] Generación automática de albaranes mensuales (`MonthlyAlbaran`/`-Line` desde `TimeEntry` + `ContractResourceRate`)
- [ ] Enlazar `email-orders` con `nas-documents.service` para *crear* documentos (hoy solo hay lectura/numeración)
- [ ] Notes — UI real
- [ ] Audit Log — UI real (el modelo ya existe)
