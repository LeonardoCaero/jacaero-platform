# TODO — jacaero-platform

Lista de trabajo derivada de la revisión completa del proyecto (2026-08-23). Ordenada por prioridad: primero lo que bloquea el despliegue en el NAS, luego dominio, seguridad, notificaciones, calidad, funcionalidades de producto y housekeeping.

## 0. Decisión tomada: apagar `platform-api`/`platform-frontend` y que `jacaero-platform` se quede con el dominio y los puertos principales

No hace falta convivencia con la plataforma vieja — se apaga y jacaero-platform hereda su sitio directamente. Orden: **primero apagar la vieja, luego levantar jacaero** (si se hace al revés, hay colisión de puertos).

- [ ] En el NAS: `cd <ruta-de-platform-api> && docker compose down` (para `caero_db`/`caero_api`/`caero_frontend`; no borra volúmenes, así que la BD vieja queda intacta por si acaso) — **requiere SSH al NAS, no lo tengo desde aquí**
- [ ] Quitar el server block de nginx viejo: `sudo rm /etc/nginx/server.d/plataforma-lcl.ddns.net.conf && sudo nginx -t && sudo systemctl reload nginx`
- [ ] (Opcional) decidir si se conserva o se borra el volumen `caero_pgdata` una vez confirmes que ya no necesitas esos datos

## 1. Despliegue en el NAS

- [x] Puertos host en `docker-compose.yml` en los valores por defecto: `4000` (backend), `8080` (frontend) — ya no hay colisión porque la plataforma vieja se apaga primero
- [x] `.env.example` raíz con `VITE_API_URL=http://localhost:4000`
- [x] `docker-entrypoint.sh` en el backend: corre `prisma migrate deploy` automáticamente al arrancar el contenedor (igual que `platform-api`) — antes no se aplicaban migraciones nunca en producción
- [x] Healthcheck añadido a `backend` (`/health` vía `node -e`) y `frontend` (`wget --spider`) en `docker-compose.yml`
- [ ] Clonar el repo con `git clone` real en el NAS — **necesito la ruta real y acceso SSH al NAS, no lo tengo desde aquí**
- [ ] Montar el share SMB (`\\HAKO\personal_folder\J.A. CAERO S.L`) como CIFS en el propio NAS y pasarlo como bind mount al contenedor backend — **requiere acceso al NAS**
- [ ] Repuntar `DOCS_ROOT_PATH` en el `.env` del NAS a la ruta Linux del mount (ya no la UNC de Windows)
- [x] Crear `.github/workflows/deploy.yml` — un solo workflow (monorepo), patrón Tailscale → SSH (appleboy/ssh-action) → `git reset --hard` → `docker compose up -d --build --no-deps backend frontend`
- [ ] Añadir secrets en GitHub: `TS_OAUTH_CLIENT_ID`, `TS_OAUTH_SECRET`, `NAS_HOST`, `NAS_USER`, `NAS_SSH_KEY`, `NAS_SSH_PORT` (reusar valores de los otros proyectos) + `NAS_JACAERO_PATH` nuevo — **solo tú puedes añadirlos, yo no tengo acceso a los secrets del repo**
- [ ] Definir backup del volumen `jacaero_pgdata` (p.ej. `pg_dump` programado + rotación)

## 2. Dominio — jacaero-platform en el dominio principal (Squarespace, ex-Google Domains)

- [ ] **Dime el dominio exacto** (p.ej. `caero.group` u otro que hayas comprado) para dejar el nginx y el certbot ya escritos con el nombre real
- [ ] Registro DNS **A** en el panel de Squarespace apuntando el dominio (o `www`) a la IP pública del NAS — **acción en tu registrador, no puedo hacerla**
- [ ] Nuevo server block en el nginx del sistema del NAS para ese dominio → proxy a `127.0.0.1:8080` (frontend) y `127.0.0.1:4000/` (backend)
- [ ] `certbot certonly -d tudominio.com` (con webroot, no standalone, para no requerir parar nginx)
- [ ] Actualizar `CORS_ORIGIN` / `FRONTEND_URL` en el `.env` del backend al dominio definitivo

## 3. Seguridad y hardening del backend

- [x] Añadir `helmet`
- [x] Añadir `express-rate-limit` en `/auth/login` (10 intentos / 15 min por IP)
- [x] Logging con timestamp+nivel reemplazando `console.log`/`console.error` (`common/services/logger.ts`) — **simplificado respecto al plan original**: en vez de instalar winston, es un wrapper mínimo sobre `console`; Docker ya captura y timestampa stdout, así que winston (rotación de ficheros, transports) solo aporta valor si en algún momento quieres agregación de logs fuera de `docker logs`. Fácil de sustituir si hace falta.
- [ ] `morgan` (o equivalente) para logs de acceso HTTP — no añadido, valorar si hace falta más adelante

## 4. Notificaciones (portado el patrón de `platform-api`, alcance recortado a lo que ya tiene datos reales)

- [x] Modelo Prisma `PushSubscription` + migración aplicada (`20260823070104_push_subscriptions`)
- [x] Módulo `push-subscriptions` (subscribe/unsubscribe/vapid-public-key, autolimpieza de suscripciones caducadas con status 410)
- [x] Claves VAPID generadas y puestas en tu `.env` local + placeholders en `.env.example`
- [x] Frontend: service worker (`public/sw.js`) + `lib/push.ts` (permiso, subscribe/unsubscribe)
- [x] Frontend: toggle de notificaciones en `SettingsMenu` (ES/EN)
- [x] Primer disparo real conectado: `email-orders` notifica a los usuarios con `ORDERS:MANAGE` cuando `syncOrders()` crea pedidos nuevos
- [ ] Modelo `ReminderNotification` + `scheduler.ts` (node-cron) — **deliberadamente no añadido todavía**: en `platform-api` cuelga de `CalendarNote`, y Calendar no está construido aquí. Tiene sentido añadirlo cuando se construya el módulo Calendar (punto 6), no antes.
- [ ] Notificación por email (Resend) para eventos clave (contrato por vencer, etc.) — pendiente, depende de que existan Contracts (punto 6)
- [ ] (Opcional) SSE para refrescar el contador en pestañas abiertas sin recargar
- [ ] **Verificación manual pendiente**: el permiso de notificaciones del navegador y el flujo subscribe/unsubscribe no se pueden probar sin una sesión de navegador real — pruébalo tú desde Settings → Notificaciones.

## 5. Calidad / CI

- [x] `vitest` instalado en el backend + 7 tests sobre `po-parser.ts` (las funciones puras de parseo, lo único con lógica no trivial hoy) — todos pasan
- [x] Workflow de CI en GitHub Actions (`.github/workflows/ci.yml`): backend (test + build) y frontend (lint + build) en cada push/PR a `main`/`develop`
- [x] Arreglado el sync inicial de `email-orders`: `syncOrders()` se llama una vez al arrancar, ya no espera al primer intervalo de `ORDERS_POLL_MINUTES`

## 6. Funcionalidades pendientes (roadmap de producto) — sin tocar, son decisiones de producto, no las até sin confirmarlo contigo

- [ ] Generación automática de albaranes mensuales (`MonthlyAlbaran`/`-Line` desde `TimeEntry` + `ContractResourceRate`)
- [ ] Enlazar `email-orders` con `nas-documents.service` para crear documentos (hoy solo hay lectura/numeración)
- [ ] Calendar — UI real (hoy "coming soon")
- [ ] Notes — UI real
- [ ] Clients & Contracts — UI real
- [ ] Team management — UI real (las invitaciones ya funcionan)
- [ ] Audit Log — UI real (el modelo ya existe)

## 7. Housekeeping

- [ ] Actualizar `README.md` (desactualizado: dice que Time Tracker y otros módulos no están construidos, y ya lo están)
- [ ] Commitear o descartar el trabajo en curso (`Skeleton.tsx`, cambios en `DocumentsPage`/`EmailOrdersPage`) — sigue sin tocar, es tu trabajo en curso
- [x] Limpiada una línea suelta (`claude --resume ...`) que había quedado pegada al final de `apps/backend/.env` por accidente y podía romper el parseo del archivo
