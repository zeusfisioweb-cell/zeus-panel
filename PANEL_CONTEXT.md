# Zeus Panel - Contexto Operativo

## Estado Actual

Panel administrativo construido con Next.js App Router, React, TypeScript, Supabase, TanStack Query, Zod y CSS propio sobre Tailwind/PostCSS.

Registro operativo:

- 2026-04-16: sesion pausada por descanso del usuario.
- Estado al pausar: RBAC backend ajustado a `professionalId`, tests/lint/build en verde.
- 2026-04-17: migracion de owner unico aplicada en Supabase como `20260417085655_enforce_single_owner_profile`.
- 2026-04-17: hardening RLS aplicado en Supabase para cerrar patients/professionals/professional_services/schedule_exceptions; el SQL local historico fue eliminado el 2026-04-25.
- 2026-04-17: validacion cruzada owner/professional A/professional B completada (`17/17 checks OK`), con evidencia en `supabase/RLS_RUNTIME_EVIDENCE_2026-04-17.md`.
- 2026-04-17: validacion runtime `audit_logs` completada (RBAC + acciones create/update/delete/view + persistencia con cleanup), evidencia en `supabase/AUDIT_LOGS_RUNTIME_EVIDENCE_2026-04-17.md`.
- 2026-04-22: auditoria preproduccion detecta fallos funcionales en panel y deuda de runtime en Supabase; se corrige el lado panel y se identifica deuda de migraciones reproducibles.
- 2026-04-22 (sesion tarde): ronda de hardening con agentes `security-reviewer` + `typescript-reviewer`. Ver bloque "Ronda de hardening 2026-04-22" abajo para detalle de cambios y pendientes.
- 2026-04-25: rediseño visual completo del panel (sprints 0-7 + polish). Nuevo namespace `.zs-*`, Recharts + framer-motion, paleta canela con token `--brand-canela-text` para texto AA (7.4:1), 7 headers unificados (eyebrow + H1 + KPI strip + actions). A11y WCAG 2.2: charts con `role="img"`+`aria-label`+`<table class="zs-sr-only">`, focus ring sólido, drawer pacientes con `role="region"`+Escape, `aria-pressed` en segmented controls, `<tr onClick>` reemplazado por botón accesible. Build en verde. Ver bloque "Rediseño visual 2026-04-25" abajo.
- 2026-04-25: se eliminan todos los SQL locales de `supabase/migrations/` para reconstruir baseline.
- 2026-04-29: baseline activa de hardening (`20260425220459..20260429135253`) reconstruida y alineada con el ledger remoto (`supabase/MIGRATION_BASELINE_LOCK_2026-04-29.md`).
- 2026-04-25: hotfix local `supabase/migrations/20260425220459_security_rpc_contract.sql` preparado para cerrar RPC/RLS criticos. Revisado contra docs actuales de Supabase: `SECURITY DEFINER` con `search_path = ''`, default privileges cerradas y grants explicitos. Aplicado posteriormente en remoto el 2026-04-26.
- 2026-04-25: `@supabase/supabase-js` actualizado a 2.104.1. El panel hereda los retries automaticos de PostgREST para `GET/HEAD`; las mutaciones siguen sin retry automatico.
- 2026-04-25: fase de auditoria backend/booking. `ensurePatientAccess()` ahora rechaza pacientes soft-deleted antes de permitir detalles, citas, edicion o fichas; `POST /clinical-records` persiste el contenido canonizado por Zod; `web/js/booking.js` falla cerrado si no hay profesionales asociados al servicio o si no puede cargar disponibilidad. Se añade smoke publico `panel/e2e/public-booking.spec.ts` y se actualiza `smoke-auth` para copy con acentos.
- 2026-04-26: `20260425220459_security_rpc_contract.sql` aplicado en Supabase remoto como `20260425220459_security_rpc_contract`. El panel deja de depender de RPC sensibles con grants `PUBLIC`; `get_dashboard_stats` queda solo para `authenticated`; `create_booking/get_available_slots` siguen disponibles para booking publico como `anon`. Evidencia en `supabase/SECURITY_RPC_CONTRACT_EVIDENCE_2026-04-26.md`.
- 2026-04-26: control explicito de clientes aplicado. `patient_professionals` queda como mapa paciente-profesional con grants cerrados y policies optimizadas; `ensurePatientAccess()` y `getProfessionalPatientIds()` lo consultan primero, y `POST /api/admin/patients` crea asignacion manual para profesionales. Evidencia en `supabase/PATIENT_PROFESSIONAL_ASSIGNMENTS_EVIDENCE_2026-04-26.md`.
- 2026-04-26: 3ª pasada de polish visual. Tipografía H1 unificada a Cormorant Garamond en las 7 secciones; cards de profesionales y tiles de servicios elevados a blanco con top strip canela 3px; calendar grid lines restauradas con tinte canela; acento activo de sidebar subido a 4px; baseline global de inputs con fondo cream + borde canela. Ver bloque "Polish visual 2026-04-26" abajo.
- 2026-04-26: validacion runtime real posterior: `web/citas.html` carga disponibilidad real contra Supabase; `create_booking` funciona como `anon` y la reserva de prueba se limpia; RPC sensibles devuelven permission denied para `anon`. Evidencia en `supabase/RUNTIME_VALIDATION_2026-04-26.md`.
- 2026-04-28: hardening portal/admin (bloque seguridad). `POST /api/portal/complete-profile`, `POST/DELETE /api/portal/dependientes`, `POST /api/portal/booking/appointments`, `POST /api/portal/appointments/[id]/cancel` y `POST /api/portal/appointments/cancel-confirm` exigen `assertSameOriginMutation` y rate limiting. `cancel-confirm` deja de mutar en `GET`: ahora la página valida token y requiere confirmación explícita por `POST`.
- 2026-04-28: booking portal endurecido con validación estricta de duración (`end_time` debe coincidir con `start_time + services.duration_minutes`).
- 2026-04-28: `/api/admin/patients/growth` queda `ownerOnly`; `DELETE /api/admin/portal/patients` valida `patient_id` UUID, controla error de `auth.admin.deleteUser` y registra auditoría con `writeAuditLog` fail-closed.
- 2026-04-28: migraciones Supabase aplicadas en remoto para este bloque:
  - `20260428202347_harden_patient_professional_assignment_privileges`
  - `20260428202444_revoke_anon_execute_on_internal_security_definer`
  Advisors de seguridad: ya solo quedan como `anon SECURITY DEFINER` las RPC públicas de booking (`create_booking`, `get_available_slots`), que son intencionales.
- 2026-04-28: estructura RLS portal/panel consolidada en remoto:
  - `20260428203447_optimize_portal_rls_policies`
  - `20260428203628_consolidate_portal_and_panel_select_policies`
  Advisors de performance: sin `auth_rls_initplan` ni `multiple_permissive_policies`; quedan solo `unused_index` informativos.
- 2026-04-28: matriz runtime por rol ejecutada con script `panel/scripts/runtime-rbac-matrix.mjs` y cleanup automático; evidencia en `supabase/RLS_RUNTIME_EVIDENCE_2026-04-28.md`.
- 2026-04-28: tests de integración portal añadidos para hardening (`cancel-confirm`, `booking` duración inválida, `dependientes` rate-limit/origin). Suite en `191/191` verde.
- 2026-04-28: `eslint` del panel excluye `chrome-devtools-mcp/**` al ser superficie externa/no producto; `npm run lint` vuelve a verde.
- 2026-04-28: build estabilizado en local cambiando script `build` a `next build --webpack` y excluyendo `chrome-devtools-mcp` del `tsconfig`; `npm run build` vuelve a verde.
- 2026-04-29: acceso al portal del paciente expuesto desde web pública mediante navegación explícita a `/portal/login`.
- 2026-04-29: UX de entrada al portal refinada en web pública: icono de acceso en navbar desktop, CTA con icono en menú móvil y accesos destacados dentro de `web/citas.html` (incluyendo entrada visible en primer pantallazo móvil).
- 2026-04-29: separación técnica portal/panel completada en repositorio: el portal vive ahora en `../portal` como proyecto Next.js independiente y el panel queda dedicado a superficie admin.
- 2026-04-29: bloque de remediación production-readiness implementado en local:
  - nueva migración `20260429135253_harden_appointments_update_and_atomic_admin_writes.sql` para cerrar `UPDATE` directo de portal sobre `appointments` y añadir RPC atómicas de reemplazo;
  - `PUT /api/admin/professionals/[id]/schedule`, `PATCH /api/admin/services` y `PATCH /api/admin/professionals` pasan a RPC atómica (`replace_*`);
  - auditoría obligatoria en `POST /api/portal/complete-profile`, `POST /api/portal/dependientes` y `DELETE /api/portal/dependientes/[id]`;
  - rate limiting añadido en todas las mutaciones admin que quedaban sin `checkRateLimit`.
- 2026-04-29: verificación local posterior al bloque: `36/36` archivos de test (`196/196`), `lint` verde y `build` verde.
- 2026-04-29: migración aplicada en remoto como `20260429135253_harden_appointments_update_and_atomic_admin_writes` y evidencia post-apply (policy `appointments UPDATE`, ACL de RPC atómicas, matriz RBAC y probe de bypass) documentada en `supabase/SECURITY_HARDENING_EVIDENCE_2026-04-29.md`.
- 2026-04-30: inicio de fase 1 para unificación de identidad web/portal (local): migración `supabase/migrations/20260430143000_identity_contract_phase1.sql` con normalización de `patients.document_id`/`patients.phone`, tabla `patient_identity_duplicate_review` y actualización de `create_booking` para normalizar DNI de entrada. Pendiente de apply remoto.
- 2026-04-30: fase 2 local de booking público server-side: nueva ruta `portal/src/app/api/public/booking/appointments/route.ts` (same-origin + rate limit + validación de conflicto/duración/ventana) y `web/js/booking.js` actualizado para usar `POST /api/public/booking/appointments` en lugar de RPC `create_booking` directa.
- 2026-05-02: ajuste de UX/hardening en portal: booking público deriva a login con `portal_required` para completar reserva autenticada; rate-limit en rutas portal usa llaves estables (`user.id` autenticado, `ip + document_id` normalizado en público), mensaje 429 unificado y fallback en memoria cuando no hay Upstash para evitar bloqueo total por configuración.
- 2026-05-02: normalización de identidad reforzada en portal (`document_id`, `phone`, `first_name/last_name`) y `complete-profile` devuelve `identity_mismatch` (409) con copy guiado cuando los datos no cuadran con clínica tras normalización.
- 2026-05-03: integración WhatsApp vía Meta Cloud API para notificaciones de citas. Nuevo `src/lib/whatsapp.ts` (fire-and-forget, modo dev sin token, normalización de teléfono, fechas en español). Modificados `POST/PATCH /api/admin/appointments` y `POST /api/portal/booking/appointments` para enviar WhatsApp al confirmar o reagendar. Ver bloque "Integración WhatsApp 2026-05-03" abajo para detalle completo.
- 2026-05-04: hardening WhatsApp en `PATCH /api/admin/appointments`: lectura explícita de estado previo también para confirmaciones y bloqueo de duplicados en `confirmed -> confirmed`; tests ampliados en panel y portal para cubrir transición y no-regresión.
- 2026-05-04: fix de RBAC profesional — desbloqueados 3 endpoints (`professionals/[id]/schedule`, `professionals/[id]/exceptions`, `audit`) que usaban `ownerOnly: true`. Tests: 282 → 293 (44 archivos, 13 archivos ampliados/creados). Ver `../production-readiness/2026-05-04/errores_para_arreglar.md` para detalle completo.
- 2026-05-04: hardening post-revisión global de código (8 issues corregidos):
  - CRITICAL: CI roto (`panel-ci.yml` tenia `cd name:` en vez de `name:`), API key de Supabase hardcodeada en `web/js/booking.js` eliminada (ahora exige `ZEUS_BOOKING_CONFIG` sin fallback), `logAuditEvent()` no fail-closed eliminado junto con endpoint `POST /api/admin/audit` sin uso.
  - HIGH: credenciales GCP en `scripts/check_favicon_index.js`, `get_gsc_data.js` y `request_indexing.js` migradas de ruta hardcodeada a `GOOGLE_APPLICATION_CREDENTIALS`.
  - MEDIUM: `style-src 'unsafe-inline'` restringido a dev en `proxy.ts` (panel + portal), nonce CSP corregido con `Buffer.from(bytes).toString('base64')`, cancelación de citas futuras al eliminar profesional (`status: 'cancelled'` + `cancellation_reason`) en vez de `professional_id: null`.
  - Verificación: 290/290 tests, lint 0 errors, build OK.
- 2026-05-04: notificaciones de citas en panel elevadas a listener global en layout admin. Nuevo `src/components/AppointmentRealtimeNotifications.tsx` suscrito a `appointments` vía realtime; dispara toast en reservas nuevas (`INSERT`) y en cancelaciones (`UPDATE` con transición a `cancelled`) para cualquier vista del panel.
- 2026-05-04: helper aislado `src/lib/appointment-notifications.ts` para parseo robusto de payload realtime (source/status válidos, formato fecha Europe/Madrid, deduplicación de cancelado->cancelado) + tests unitarios `src/lib/appointment-notifications.test.ts`.
- 2026-05-04: se elimina listener duplicado de dashboard (`src/app/(admin)/page.tsx`) para evitar toasts repetidos al coexistir con el listener global.
- 2026-05-04: verificación post-cambio: `npm run test` = 44 archivos / 294 tests OK, `npm run build` OK.
- 2026-05-04: notificaciones push móvil añadidas al panel (PWA). Componentes nuevos: `src/app/manifest.ts`, `public/push-sw.js`, `src/components/PushNotificationsBootstrap.tsx`, `src/app/api/admin/push-subscriptions/route.ts` y helper `src/lib/push-notifications.ts`.
- 2026-05-04: la activación push en iPhone requiere instalar el panel en pantalla de inicio (standalone); el bootstrap muestra aviso guiado cuando detecta iOS fuera de standalone.
- 2026-05-04: `POST/PATCH /api/admin/appointments` ahora dispara push de "Nueva cita" y "Cita cancelada" a suscriptores activos. Cobertura portal añadida para eventos externos: `portal/src/app/api/portal/booking/appointments/route.ts` y `portal/src/app/api/portal/appointments/cancel-confirm/route.ts`.
- 2026-05-04: ficha clínica visible para pacientes desde portal (`/portal/mi-ficha`). Solo lectura. Migración RLS `20260504180000_portal_clinical_records_select` aplicada en Supabase. Panel no requiere cambios — ya usa `service_role` para clinical_records.
- 2026-05-04: migración `supabase/migrations/20260504170000_add_push_subscriptions.sql` aplicada en Supabase remoto. Tabla `push_subscriptions` operativa con RLS por `auth.uid()`.
- 2026-05-04: verificación bloque push: `panel` (`npm run test`, `npm run lint`, `npm run build`) y `portal` (`npm run test`, `npm run build`) en verde.
- 2026-05-04: rediseño portal (logo Zeus real, cards premium, calendario con flechas SVG, fix reprogramar). Suite e2e portal: 6 archivos, 44 tests. E2E panel: 9 archivos, 35 tests (3 fallos preexistentes en booking público).
- 2026-05-03: eliminado el limite de antelacion maxima para reservas (`booking_advance_days`). Se quito validacion `maxStartMs` en `POST /api/portal/booking/appointments` (panel), `POST /api/portal/booking/appointments` (portal) y `POST /api/public/booking/appointments` (portal). Se quito restriccion `maxDate` en calendarios cliente de `web/js/booking.js` y `portal/src/app/portal/reservar/ReservarClient.tsx`. La navegacion de meses ya no tiene tope hacia adelante.
- 2026-05-04: deduplicacion definitiva. Eliminados `panel/src/app/portal/**`, `panel/src/app/api/portal/**` y `panel/src/app/auth/**`. El portal vive exclusivamente en `../portal/`. Proxy y auth-context limpios de referencias a portal. **Regla: panel = solo admin, portal = solo portal.**
- 2026-05-04: hardening ronda 2 — `readApiError` extraído a `src/lib/api-helpers.ts` desde 11 archivos duplicados (hooks `use{Profesionales,Citas,Horarios,Settings,Pacientes,Servicios}`, páginas admin `{profesionales,pacientes,servicios,configuracion}/page.tsx`). Refactorizados todos los call sites.
- 2026-05-04: `ErrorBoundary` (`src/components/ErrorBoundary.tsx`) creado e integrado en `(admin)/layout.tsx` para contención de errores en página admin completa.
- 2026-05-04: arreglado test `cancel/route.test.ts` (preexistente) — la ruta se modificó para cancelación directa pero el test mockeaba `signCancelToken` y `sendCancellationRequestEmail` que ya no se usan. Scope de `callCount` corregido en mocks de `adminClient.from`.
- 2026-05-04: hardening ronda 6 — limpieza final. Lint panel: 0 warnings (variable `currentStatus` sin usar en e2e eliminada). Lint portal: 0 warnings (6 `<img>` → `next/Image` con `width={0} height={0} sizes`). E2E public-booking: 3 tests obsoletos marcados `.skip` — `web/citas.html` ya no carga `booking.js` tras migración a portal. npm audit: `resend` 6.12.2→6.1.3 en panel y portal (elimina dependencia `svix→uuid<14.0.0`). API usada (`new Resend()`, `emails.send()`) estable desde v1, sin riesgo de breaking. 0 vulnerabilidades en ambos proyectos.
- 2026-05-04: fix PATCH appointments — re-confirmar cita cancelada ahora ejecuta `findConflict`. Nueva variable `isReconfirmingCancelled = isConfirming && currentAppt.status === 'cancelled'`. Tests: `reject re-confirming a cancelled appointment when another confirmed appointment occupies the same slot` (422) + `allow re-confirming a cancelled appointment when the slot is free` (200).
- 2026-05-04: verificación final: panel 246/246 tests (34 archivos), lint 0 errors 0 warnings, build OK, audit 0 vulnerabilities. Portal 61/61 tests (14 archivos), lint 0 errors 0 warnings, build OK, audit 0 vulnerabilities.
- 2026-05-05: remediación directa de issues E2E:
  - `POST/DELETE/GET /api/admin/push-subscriptions` ahora degradan de forma controlada cuando falta infraestructura (`push_subscriptions` no existe o schema cache incompleta), evitando 500 globales en preview.
  - `QRModal` deja de usar `/citas.html`; ahora genera QR a `/portal/reservar` usando `NEXT_PUBLIC_PORTAL_URL` y fallback por inferencia de host `panel -> portal`.
  - `PatientsGrowthChart` añade `minWidth={0}` en `ResponsiveContainer` para reducir warnings de dimensiones intermitentes.
  - nueva migración local `supabase/migrations/20260505190000_booking_settings_update_owner_policy.sql` para habilitar `UPDATE` owner en `booking_settings` vía RLS (sin bypass `service_role` en ruta), aplicada en remoto el 2026-05-05 junto con reconciliación de ledger.
  - verificación local posterior: `panel` (`npm run test`, `npm run lint`, `npm run build`) en verde (249 tests).
- 2026-05-08: documentación clínico-legal por paciente (local). Se crea la migración `supabase/migrations/20260508124000_add_patient_documents.sql` y nuevas APIs admin:
  - `GET /api/admin/patients/[id]/documents` (materializa y devuelve 3 documentos base por paciente);
  - `PATCH /api/admin/patients/[id]/documents/[documentId]` (guarda formulario editable, estado y notas).
  En UI de `panel/src/app/(admin)/pacientes/`, la pestaña clínica pasa a “Documentos” y permite rellenar/editar/guardar/imprimir cada documento y abrir la plantilla PDF base desde `panel/public/consentimientos`.
- 2026-05-09: mejora de calidad de fichas. Se define contrato único de campos (`src/lib/patient-document-definitions.ts`) y se refactoriza UI/print para usar únicamente campos canónicos por tipo de documento (sin campos extra en generación). Plantillas PDF base regeneradas y saneadas sin PII con `scripts/generate_patient_document_templates.py`.
- 2026-05-09: impresión de fichas migrada a PDF base real (se elimina el render HTML para imprimir). Nuevo endpoint `POST /api/admin/patient-documents/render` y helper `src/lib/patient-document-pdf.ts` (pdf-lib) que rellena coordenadas sobre `panel/public/consentimientos/*.pdf`. Los modales de pacientes y generador ahora abren ese PDF rellenado en nueva pestaña.
- 2026-05-03: antelacion minima de reserva (`min_booking_notice_hours`) bajada de 2h a 1h por defecto en `configuracion/page.tsx` (admin form), `panel/portal/src/app/portal/reservar/ReservarClient.tsx` (fallback cliente) y valor en BD.
- 2026-05-03: hardening booking portal (local): `POST /api/portal/booking/appointments` valida disponibilidad real contra `get_available_slots` antes de insertar (devuelve `409 slot_taken` si el rango no existe en agenda efectiva) y `GET /api/portal/booking/services` filtra servicios sin profesionales activos asignados para evitar selección de servicios sin opciones de profesional.
- 2026-04-30: continuidad de sesión documentada en `production-readiness/2026-04-30/01-next-session-handoff.md` con checklist de deploy/smoke y cierre DB pendiente.
- 2026-04-29 (pre-separación de despliegues): smoke HTTP del deployment `zeus-panel-three.vercel.app` mostró `GET /login` OK, pero rutas de portal no reflejaban el estado esperado. Desde la separación técnica, la validación de `/portal/*` ya no corresponde a este despliegue sino al proyecto `portal`.
- 2026-04-30: validación manual de vista `professional` ejecutada en runtime local mediante Chrome MCP. Login correcto con cuenta profesional, acceso confirmado a `/` y `/citas`, y redirección automática confirmada desde rutas restringidas (`/profesionales`, `/analitica`) hacia `/`. Se creó una cuenta temporal de prueba para la validación y se eliminó completamente al cerrar la comprobación (`profiles`, `professionals` y `auth.users`).

Rutas principales:

- `/`: resumen operativo del centro.
- `/citas`: agenda, calendario/listado, detalle, alta, cambios de estado y cancelacion.
- `/pacientes`: pacientes, detalle, historia clinica y export RGPD.
- `/profesionales`: gestion de profesionales, servicios asociados y horarios.
- `/servicios`: categorias y servicios.
- `/horarios`: franjas semanales y excepciones.
- `/configuracion`: ajustes de clinica y textos legales.
- `/login`: acceso al panel.

Backend interno:

- `src/app/api/admin/**`: rutas API server-side para datos del panel.
- `src/app/(admin)/actions.ts`: server action del dashboard.
- `src/app/api/admin/_lib.ts`: auth/RBAC, errores, auditoria y helpers compartidos.
- `src/lib/supabase/server.ts`: cliente Supabase server-side.
- `src/lib/supabase/client.ts`: cliente browser para Supabase Auth y realtime.
- `src/lib/auth-context.tsx`: estado de sesion y perfil cargado desde `/api/admin/profile`.

## Reglas de Arquitectura

- App Router siempre; no usar Pages Router.
- Server Components por defecto; `"use client"` solo cuando hay estado, eventos o hooks cliente.
- Datos sensibles de Supabase solo desde API routes, server actions o server components.
- Supabase browser no debe consultar datos clinicos, pacientes, citas ni historiales directamente.
- Todo endpoint nuevo debe usar `requirePanelAccess()`.
- Todo input externo debe validarse con Zod.
- Toda mutacion sensible debe registrar auditoria con `writeAuditLog()`.
- Owner es admin total y debe existir solo uno en `profiles`.
- Professional solo puede operar sobre recursos propios o vinculados a su `professionals.id`.

## Cambios Ya Aplicados

- Eliminado fallback hardcodeado de `SUPABASE_SERVICE_ROLE_KEY` en `scripts/seed_dashboard.js`.
- Creacion de profesionales corregida para generar password solo en servidor.
- Auditoria centralizada con `writeAuditLog()` y `user_id`.
- Endpoint `/api/admin/profile` para cargar perfil desde servidor.
- Endpoint `/api/admin/appointments/pending-count` para contador del sidebar.
- RBAC de pacientes: owner ve todo; professional accede por asignacion explicita en `patient_professionals`, con fallback temporal a citas o fichas clinicas propias.
- RBAC de citas: professional no puede crear/modificar citas de otro professional ni reasignar paciente.
- RBAC de historias clinicas: professional solo borra registros propios.
- Pacientes soft-deleted quedan bloqueados por `ensurePatientAccess()` para operaciones posteriores de panel.
- `patient_professionals` sincroniza relaciones desde citas/fichas por trigger y desde altas manuales del panel.
- Fichas clinicas se validan y se guardan con contenido canonizado por tipo (`anamnesis`, `exploration`, `evolution`, `report`).
- Detalle de paciente filtra citas e historias clinicas por professional autenticado.
- `requirePanelAccess()` ahora resuelve `professionalId` desde `professionals.id` y bloquea professionals inactivos.
- Dashboard server action: professional solo recibe sus citas, sus servicios asignados y su fila de professional.
- `/api/admin/professionals` y `/api/admin/services` ahora devuelven solo contexto propio para professional.
- Etiqueta de rol `owner` unificada como `Admin` en sidebar y topbar.
- Migracion aplicada en Supabase como `20260417085655_enforce_single_owner_profile`.
- Hardening RLS aplicado en Supabase para cerrar fugas de lectura en tablas admin restantes; SQL local historico eliminado el 2026-04-25.
- Accesibilidad inicial en modal de confirmacion, formulario de citas, panel de paciente y timeline.
- Tests base con Vitest para schemas, helpers de fechas, errores, auditoria y RBAC.
- Tests de route handlers anadidos para `401`, `403`, owner-only y errores de Supabase en `audit`, `booking-settings`, `profile` y `appointments/pending-count`.
- CSP separada entre desarrollo y produccion en `next.config.ts`.
- Dependencias no usadas eliminadas del `package.json`.
- Migracion RLS aplicada en Supabase como `20260416212154_adapt_panel_rls_to_live_schema`.
- Playwright configurado en `playwright.config.ts` con smoke e2e base en `e2e/smoke-auth.spec.ts`.
- CI de panel agregado en `.github/workflows/panel-ci.yml` ejecutando `lint`, `test` y `build`.
- Export RGPD endurecido con headers anti-cache en `src/app/api/admin/patients/[id]/export/route.ts`.
- Superficie publica de booking endurecida en Supabase.
- Policies `authenticated` consolidadas por accion en Supabase (sin cambios funcionales de RBAC).
- `/api/admin/profile` ahora devuelve `professional_id` para usuarios `professional`; dashboard y `/citas` usan ese id real para filtrar y crear citas.
- `AppointmentFormModal` deja de depender de `profiles.id` y usa `currentProfessionalId`.
- `useProfesionales()` vuelve a preservar `professional_services` para no romper la edicion de servicios asociados.
- `PATCH /api/admin/professionals` resuelve primero `professionals.user_id` y actualiza `profiles` con ese `user_id`.
- `PATCH /api/admin/patients` bloquea estados resultantes sin email ni telefono.
- `POST/PATCH /api/admin/appointments` valida fechas invalidas y exige `end_time > start_time`.
- Export RGPD JSON de pacientes vuelve a resolver el nombre del professional via `professionals -> profiles(full_name)`.
- Tests de rutas ampliados para cubrir estos casos funcionales.

## Sesion analytics 2026-04-27

### Bugs corregidos (code review con datos reales de Supabase)

**HIGH — `totalToday` incluia canceladas** (`DashboardStats.tsx:71`)
`todayAppointments.length` → `todayAppointments.filter(a => a.status !== 'cancelled').length`. El denominador de `progressPct` ("% del dia completado") era incorrecto cuando existian canceladas en el dia. `stats.todayCount` del server action ya filtraba canceladas pero no se usaba; sigue sin usarse (dead code tolerable, el calculo local es equivalente).

**HIGH — "Tasa de exito" = formula incorrecta** (`DashboardCharts.tsx:40-41`)
El ring mostraba `(completedCount + confirmedCount) / globalTotalSessions` ≈ 93.5%. Incluia citas futuras confirmadas en el numerador, lo que un clinico lee como "todas las reservas se cumplieron". Corregido a `completedCount / globalTotalSessions` ≈ 36.7%. Label cambiado a "Completadas"; subcopy a `{completedCount} de {globalTotalSessions} sesiones activas`.

**HIGH — Revenue invisible** (`page.tsx` → `DashboardStats.tsx`)
El RPC `get_dashboard_stats` calculaba `estimatedRevenue` (€6,269 en BD) pero ningun componente lo mostraba. Para `owner`, la tarjeta KPI "Proxima cita" (menos util para un gestor) es reemplazada por "Ingresos completados" mostrando el revenue formateado como `€X.XXX` con el conteo de pacientes como hint. Para `professional`, la tarjeta original se preserva.

**MEDIUM — Hero de PatientsGrowthChart = 0 con 1 punto** (`PatientsGrowthChart.tsx:69-88`)
Guard `points.length < 2` devolia `currentValue: 0` aunque el punto existiera. Refactorizado con flag `hasDelta` para mostrar el valor real del ultimo punto incluso sin anterior; el badge comparativo solo aparece si hay al menos 2 puntos.

**LOW — Realtime channel sin guard de sesion** (`page.tsx:118`)
`useEffect` suscribia el canal de Supabase Realtime antes de que `profile` estuviera disponible. Anadido `if (!profile) return` y `profile` como dependencia del effect.

**LOW — `toast icon: ''` eliminado** (`page.tsx:127`)
Cadena vacia en prop `icon` de Sonner sustituida por ausencia del prop (usa el icono por defecto).

### BD auditada (Supabase MCP, 2026-04-27)

- 573 citas totales: confirmed 323 (56.4%), completed 209 (36.5%), pending 37 (6.5%), cancelled 4 (0.7%).
- Servicios: Fisioterapia General 510/573 (89%) — donut muestra distribucion muy sesgada, es dato real.
- 7 pacientes activos; solo 6 con `created_at` significativo (1/mes, no contiguos).
- Revenue completado: €269 (abr-26) + €5.280 (mar-26) + €720 (feb-26) = €6.269. Meses futuros tienen citas sin completar.
- `clinical_records`: 0 registros aun.
- RPC `get_dashboard_stats`: logica correcta; `totalGlobalAppointments` excluye canceladas; `estimatedRevenue` suma solo completadas.

### Sesion analytics continuacion 2026-04-27

**RBAC — `/analitica` no estaba en `PROFESSIONAL_RESTRICTED_PATHS`** (`panel-navigation.ts`)
Ruta anadida. Layout ya redirige profesionales con `isRestrictedForProfessional`. `GET /api/admin/analytics` actualizado a `requirePanelAccess({ ownerOnly: true })`.

**`bookingSources.phone` ausente en response** (`analytics/route.ts`)
El campo existia en `AnalyticsResponse` pero no se incluia en el `NextResponse.json`. Anadido `phone: sourceCount.phone`.

**Peak hours y day breakdown en UTC** (`analytics/route.ts`)
`getHours()` y `getDay()` en servidor = UTC. Creados helpers `tzHour()` y `tzDayOfWeek()` con `Europe/Madrid`. Sustituidos en secciones 4 y 9.

**Analytics API cargaba toda la tabla sin filtro** (`analytics/route.ts`)
Fetch sin limite → toda `appointments` en memoria. Anadido `dbLowerBound` = earliest(startDate, 6-months-ago, startOfMonth, weekStart) y `gte('start_time', dbLowerBound)` en la query. `all_time` tambien incluye el bound de 6 meses para la tendencia.

**Tests para analytics route** (`analytics/route.test.ts`)
Nuevo archivo. 6 tests: 403 non-owner, 500 DB error, shape completa, phone count, adherencia oneTime/twoThree/loyal, cancellationRate vacío.

**Verificacion:** 30 test files, 185 tests en verde. `tsc --noEmit` limpio.

### Pendiente de esta sesion

- Responsive visual pendiente (390px, 768px, 1366px, 1920px) de sesiones anteriores.
- E2E smoke cubre solo login/redirect — cero cobertura de rutas del panel.
- Ocupacion: capacidad = 35h/semana hardcoded — deberia venir de `schedule_slots`.
- Mojibake copy: `clinica`, `sesion`, `contrasena` sin tildes en algunos strings de UI.

## Sesion bugfixes 2026-04-28

Continuacion directa de la sesion analytics. Todos los items del "Pendiente" anteriores corregidos excepto responsive visual y E2E.

**`schedule-slots/route.ts` — null guard** (`route.ts:30`)
`supabase.insert().select().single()` puede devolver `data: null` sin error si la BD retorna cero rows. Anadido `if (!data) throw new Error('insert returned no data')` entre el check de error y el acceso a `data.id`.

**Mojibake — 3 strings de UI**
- `configuracion/page.tsx`: "Direccion" → "Dirección", placeholder "Calle, numero, ciudad" → "Calle, número, ciudad"
- `AppointmentFormModal.tsx:203`: "datos basicos" → "datos básicos"
- `CitasTable.tsx:303`: "Sin documento/telefono" → "Sin documento/teléfono"

**Ocupacion con capacidad real** (`analytics/route.ts`)
Sustituido el hardcode `(prosCount || 1) * 35 * 60` por query a `schedule_slots`: suma de `(end_time - start_time)` en minutos por cada franja activa. Variable `weeklyCapacityMinutes` usada como base para mensual (`× 4.33`), semanal (× 1) y custom (`× daysInSpan/7`). Fallback al hardcode si la tabla esta vacia.

**`calendar-timeline.css` — breakpoint 768px** (`calendar-timeline.css`)
Anadido bloque entre 960px y 640px: padding reducido (12px 14px 10px), font-size 16px, `.zc-vcal__eyebrow` oculto. Cubre tablets portrait sin saltar directo a mobile.

**Verificacion:** 185 tests en verde, `tsc --noEmit` limpio.

## Verificacion Actual

Ultima verificacion local ejecutada el 2026-05-04 (fix RBAC profesional):
- `npx vitest run` → 293 tests en verde (44 archivos).
- `npx tsc --noEmit` → 0 errores.
- `npm run lint` → 0 errors, 5 warnings preexistentes.
- `npm run build` → limpio.

Ultima verificacion local ejecutada el 2026-04-26 (sesion producto/UX):

- Suite 29 archivos, 179 tests en verde (lint 0 errores).
- Sesion 2026-04-26 (tarde): quick wins frontend + asignacion cruzada servicios↔profesionales implementados. Ver bloque "Sesion producto/UX 2026-04-26" abajo.

---

## Sesion producto/UX 2026-04-26

### Entregado

**Quick wins frontend:**
- Busqueda de pacientes por telefono: `patients/route.ts` amplia el OR de busqueda con `phone.ilike.%term%`. Placeholder de `PacientesTable` actualizado.
- Hover quick-actions en el timeline de citas: `CitasTimeline.tsx` acepta `onUpdateStatus` y `onInitiateCancel`. `AppointmentCard` muestra botones ✓ (confirmar) y ✕ (cancelar) al hacer hover, solo para estados accionables y solo en tarjetas con altura suficiente. CSS en `calendar-timeline.css`.
- Confirmacion masiva de citas: `CitasTable.tsx` tiene checkboxes por fila `pending` + barra verde "Confirmar X" que hace `Promise.all` sobre el endpoint existente. Solo visible para `owner` (no para `professional`). CSS en `citas.css`.
- `citas/page.tsx` anade `handleQuickUpdateStatus` y `handleBulkConfirm` y los pasa a los dos componentes.

**Asignacion cruzada Servicios ↔ Profesionales (direccion inversa):**
- La direccion Profesional → Servicios ya existia en `ProfessionalFormModal`.
- `types.ts`: `Service.professional_services?: Array<{ professional_id: string }>` anadido.
- `services/route.ts`: GET incluye `professional_services(professional_id)` en el join; POST/PATCH aceptan `professional_ids?: string[]` y sincronizan `professional_services` (delete + re-insert en PATCH).
- `ServiceFormModal.tsx`: nueva seccion "Profesionales habilitados" con checkboxes, inicializada desde `editing.professional_services`.
- `servicios/page.tsx`: carga `useProfesionales()` y lo pasa al modal.
- CSS: `.service-form__prof-*` en `components.css`.

**Roadmap documentado:**
- `panel/UX_ROADMAP.md` reescrito con lo entregado y la arquitectura detallada del Portal del Paciente (fase 1-4).

### Pendiente de esta sesion

- Portal del Paciente: arquitectura documentada en `UX_ROADMAP.md`. Siguiente paso: columna `auth_user_id` en `patients`, RLS del portal y ruta `/portal`.
- Tests para los nuevos comportamientos: `services/route.test.ts` no cubre el sync de `professional_ids`; no hay test para hover quick-actions ni bulk confirm (son UI).
- Mojibake en copys del panel (pendiente de sesiones anteriores).
- Responsive visual en 390px, 768px, 1366px, 1920px.

---

## Verificacion anterior (2026-04-26 manana):

```bash
npm run test
npm run lint
npm run build
npm run test:e2e
```

Resultado: pasa.

Estado actual de esta sesion:

- Suite completa de unit/integration local en verde: 29 archivos, 179 tests.
- Tests de panel ampliados el 2026-04-26:
  - `patients/route.test.ts`: rate limit `429` en alta de pacientes, sanitizacion de busqueda contra wildcards `%`, `_`, parentesis y comas, y bloqueo de updates cuyo estado resultante dejaria al paciente sin email ni telefono.
  - `clinical-records/route.test.ts`: rate limit `429`, contenido clinico invalido `422`, owner creando fichas solo con `professional_id` activo y rechazo de profesional inactivo.
  - `services/route.test.ts`: servicios vinculados a professional filtran nulos/inactivos y se ordenan por nombre.
  - `professionals/route.test.ts`: baja de professional con citas futuras desacopla esas citas, desactiva el professional y audita el contador.
- Lint en verde.
- Build en verde fuera del sandbox en esta sesion: `npm run build` compilo correctamente 24 paginas estaticas y 31 rutas App Router con Next.js 16.2.4.
- E2E autenticado completo en verde fuera del sandbox: `npm run test:e2e` con `PANEL_E2E_EMAIL`/`PANEL_E2E_PASSWORD`, 8 passed. Se ajustaron los smokes para esperar el heading actual `Resumen del centro` y readiness de rutas privadas hasta 15s.
- Tests focalizados de acceso paciente-profesional tambien en verde: `npm run test -- src/app/api/admin/_lib.test.ts src/app/api/admin/patients/route.test.ts`.
- Hay baseline activa de migraciones en `supabase/migrations/` alineada con remoto para la ventana de hardening; puede extenderse el histórico anterior en una fase aparte.
- Validacion runtime real de booking publico y RPC Supabase en verde; ver `supabase/RUNTIME_VALIDATION_2026-04-26.md`.
- Preparacion de produccion documentada en `../production-readiness/2026-04-26/`; continuar por `06-next-handoff.md`.

## Estructura Esperada

```text
panel/
  public/                 assets publicos necesarios del panel
  scripts/                scripts operativos puntuales
  src/
    app/                  rutas App Router y API routes
    components/           UI compartida
    hooks/                hooks de datos cliente
    lib/                  Supabase, schemas, tipos, auth y utilidades
    styles/               CSS del sistema visual
  PANEL_CONTEXT.md        contexto operativo del panel
```

## Archivos Que No Deben Volver

- `panel/.claude/`: configuracion local de herramienta.
- `panel/CLAUDE.md`: sustituido por este contexto.
- `panel/BUGS_Y_LIMITACIONES.md`: sustituido por pendientes vivos en este contexto.
- `panel/.next/`: salida generada.
- `panel/next-env.d.ts`: generado por Next y cubierto por `.gitignore`.

## Pendiente Imprescindible

1. Rotar en Supabase la `SUPABASE_SERVICE_ROLE_KEY` que estuvo versionada antes de la limpieza.
2. Seguir subiendo cobertura de branches en endpoints y flujos no cubiertos; esta sesion amplio `patients`, `services`, `professionals` y `clinical-records`, pero quedan ramas secundarias y E2E autenticado.
3. Extender Playwright smoke actual a dashboard, citas, pacientes, profesionales, servicios, horarios y configuracion.
4. Corregir mojibake/copy pendiente: acentos, `clinica`, `sesion`, `contrasena`, textos largos y estados vacios.
5. Revisar visualmente responsive en 390px, 768px, 1366px y 1920px.
6. Extender histórico de baseline Supabase previo a `20260425220459` si se decide conservar también todo el pasado en Git.

## Criterio Para Reestructurar

1. No mover componentes si rompe rutas App Router o imports `@/`.
2. No unir hooks cliente con logica server-side.
3. No exponer service role ni queries clinicas en cliente.
4. Separar cambios de seguridad, cambios visuales y limpieza de archivos.
5. Ejecutar test, lint y build antes de cerrar cualquier bloque.

## Ronda de Hardening 2026-04-22 (Detalle)

Auditoria previa a salida a produccion. Triggered por agentes `security-reviewer` y `typescript-reviewer`. Repositorio es privado, por lo que se bajo prioridad de la rotacion de `SUPABASE_SERVICE_ROLE_KEY` (sigue pendiente pero no bloqueante).

### Fixes Aplicados en Codigo

Runtime / funcionales:
- `appointments/route.ts`: conflict queries en POST y PATCH ahora filtran por ventana `[start - buffer, end + buffer]` via `.gt('end_time')/.lt('start_time')`. Antes traian TODO el historial del profesional → timeout garantizado en produccion.
- `src/middleware.ts` creado con `export async function middleware`. Antes existia `src/proxy.ts` con `export async function proxy` y Next.js lo ignoraba completamente (auth redirect + refresh de sesion NO se ejecutaban en paginas `/(admin)/*`).
- `next.config.ts`: retirada CSP estatica del header config; ahora se genera por request con nonce en middleware.
- `src/app/layout.tsx`: lee `x-nonce` via `headers()` y lo pasa a `Providers` para que Next.js lo aplique a sus inline scripts. Layout convertido a async server component.
- `src/app/(admin)/actions.ts`: `.single()` → `.maybeSingle()` en lookup de profile. Firma cambiada de `todayStr, endStr` a `dayStartIso, dayEndIso` (ISO completos en UTC). Timezone bug corregido.
- `src/app/(admin)/page.tsx` (dashboard):
  - Timezone: los limites del dia ahora se calculan con Luxon en `Europe/Madrid` y se convierten a UTC antes de mandarlos a Supabase. Antes el string `"2026-04-22T00:00:00"` se interpretaba como UTC y perdia citas entre 00:00-02:00 local.
  - `handleCreateAppointment` lanza `throw` en overlap/error en vez de `return` silencioso, para que el modal no se cierre y el usuario no pierda los datos del formulario.
  - `todayIso/tomorrowIso` envueltos en `useMemo` para no regenerar queryKey de `useCitas` cada render.
- `api/admin/booking-settings/route.ts`: `.single()` → `.maybeSingle()` con 404 explicito, regex `HH:MM` para opening/closing, refine `closing > opening`.
- `api/admin/_lib.ts`:
  - `assertSameOriginMutation`: si existe `NEXT_PUBLIC_APP_URL` se usa como origen esperado; en produccion es obligatorio cuando llega header `Origin`.
  - `getBookingSettings`: `.single()` → `.maybeSingle()`.
- `api/admin/professionals/route.ts`: `if (full_name)` → `if (full_name !== undefined)` para permitir limpiar via empty string si aplicara. `serviceIds` con `.max(100)`.
- `api/admin/create-professional/route.ts`: los `error.message` de Supabase ya no se devuelven al cliente; se mapean a mensajes genericos (plus 409 para email duplicado detectado por keyword).
- `api/admin/patients/[id]/export/route.ts`: quitado `ip_address` del export RGPD.
- `api/admin/patients/route.ts`: sanitizador de busqueda ahora tambien filtra `_` (wildcard LIKE). Evita DoS por enumeracion.
- `api/admin/profile/route.ts`: `select('*')` → columnas explicitas (`id, email, role, full_name, created_at`).
- `api/admin/professionals/route.ts` GET: retirado `user_id` de `professionalSelect` (GDPR minimization, los profesionales no deben ver el auth uid de sus compañeros).

Validacion mas estricta (entradas):
- `lib/schemas.ts`: `AppointmentInsertSchema` ahora exige `uuid()` en IDs y `datetime()` en timestamps. `ScheduleExceptionSchema` exige `uuid()` + `YYYY-MM-DD`. `ServiceSchema.category_id` exige `uuid()`. `color_code` en schemas y en `updateProfessionalSchema` con regex hex `#[0-9A-Fa-f]{3,8}`.
- UUID validation en TODOS los `paramsSchema` de rutas `[id]/route.ts` (appointments, patients, patients/details, patients/export, schedule-slots, schedule-exceptions, clinical-records, professionals/schedule, professionals/exceptions).
- UUID validation en TODOS los body IDs de endpoints (appointments, patients, professionals, services, clinical-records).
- HH:MM regex + refine `end > start` en `schedule-slots` POST y `professionals/[id]/schedule`.
- YYYY-MM-DD regex en `professionals/[id]/exceptions` y `schedule-exceptions` query params.
- ISO 8601 en query params de `appointments` GET.

Frontend:
- `AppointmentFormModal.tsx`: imports duplicados de `@/lib/types` unificados. `patient_dni` ahora opcional (era required pero nunca se enviaba a la API, bloqueaba submit sin razon). Busqueda de pacientes con debounce 300ms + cleanup en unmount (antes disparaba fetch por tecla → posible out-of-order).
- `lib/types.ts`: `Patient` ahora incluye `deleted_at?: string | null` (se accede en export route).
- `providers.tsx`: acepta prop `nonce?: string` para CSP nonce chain.

Tests:
- Todos los fixtures en `src/app/api/**/*.test.ts` convertidos a UUIDs validos (los originales `'patient-1'`, `'service-1'`, etc. rompian con las nuevas validaciones).

### Fixes Aplicados en Supabase

Via MCP (aplicados como migration inline `version_missing_runtime_objects_constraints_indexes`, NO versionada como archivo). Pre-check confirmo 0 citas solapadas antes de imponer el constraint.

- Constraint `appointments_end_after_start_chk`.
- Exclusion constraint `appointments_no_overlaps_per_professional` (gist con `tstzrange(start_time, end_time, '[)')` excluyendo cancelled/null). Cierra la race condition check-then-insert a nivel BD.
- Indices: `idx_appointments_professional_start_status`, `idx_appointments_patient_id`, `idx_clinical_records_patient_professional`, `idx_professional_services_professional_service`, `idx_schedule_slots_professional_day_active`, `idx_schedule_exceptions_professional_date`, `idx_audit_logs_table_record_created`, `idx_consent_records_patient_granted_at`, `idx_professionals_user_id`.

### Auditoria de Integridad de Datos (18 checks)

Todos verdes EXCEPTO:
- **1 paciente sin contacto**: `Test Patient` (`63029ad3-b3a8-40d5-bc8d-045b957d4fb1`). Sin email ni phone, sin `deleted_at`. Probablemente de seed. Accion: revisar si se puede eliminar o soft-delete.
- **1 profesional activo sin schedule_slots**: no podra recibir reservas publicas (bloquea `get_available_slots`). Accion: añadirle horario o pasarlo a `is_active = false`.

Sin problemas en: orphan appointments, inverted time, orphan FKs, bad color_code, invalid day_of_week, duplicate document_id, inactive services con citas activas, more than 1 owner, professionals sin profile, source null, email invalido, etc.

### Pendiente para Siguiente Sesion

1. **Configurar `NEXT_PUBLIC_APP_URL` en Vercel/entorno de produccion** con el dominio final del panel (ej `https://panel.zeus...`). Sin ella, las mutaciones con `Origin` fallan por configuracion incompleta.
2. **Activar Leaked Password Protection en Supabase** (Dashboard → Authentication → Password Security). Advisor la reporta WARN.
3. **Limpieza de datos**: decidir que hacer con `Test Patient` (sin email ni telefono, probablemente de seed) y con el profesional activo sin slots (no puede recibir reservas publicas).
4. **Upstash no se configura por decisión operativa (2026-05-09)**. Se acepta fallback local en memoria para rate limiting (menor robustez frente a abuso distribuido y reinicios de instancia en Vercel).
5. **Rotar `SUPABASE_SERVICE_ROLE_KEY`** (repositorio privado lo baja a P2, pero sigue en la lista).
6. **Revisar 3 `unused_index` reportados por advisor** despues de validar trafico real en produccion (es esperado con poca data).
7. **Subir cobertura de branches** en endpoints con deuda (`patients`, `services`, `professionals`, `clinical-records`).
8. **Extender Playwright smoke** a citas, pacientes, profesionales, servicios, horarios y configuracion.
9. **Corregir mojibake/copy**: acentos, `clinica`, `sesion`, `contrasena`, textos largos y estados vacios.
10. **Revisar visualmente responsive** en 390px, 768px, 1366px y 1920px.

---

## Rediseño visual 2026-04-25

Trabajo ejecutado en una sesión larga, en 7 sprints + una segunda pasada de polish a petición del usuario ("no has clavado el diseño, encima está mal colocado").

### Contexto

El panel ya funcionaba pero visualmente se sentía "SaaS plantilla": KPIs planos, listas de dots haciéndose pasar por charts, inconsistencias entre secciones (summary-v5, ops, bento, professional-refresh). El usuario pidió "algo más moderno, futurista, charts reales y quesos, manteniendo paleta canela".

### Decisiones técnicas

- **Charts**: Recharts (~50 kB gz). Wrappers en `src/components/charts/` (`DonutChart`, `BarChartH`, `SparkArea`, `RadialRing`) consumen tokens CSS, reciben solo data.
- **Motion**: framer-motion instalado, usado con moderación. Todo respeta `prefers-reduced-motion`.
- **Namespace CSS nuevo `.zs-*`** — convive con legacy (`.summary-v5-*`, `.ops-*`, `.citas-*`, `.bento-*`, `.module-header`). Nada se borra todavía.
- **Paleta canela conservada**: `#AD7332` sigue siendo brand. Se añade `--brand-canela-text: #6E481E` (contraste 7.4:1 sobre blanco — WCAG AA) para texto. El naranja se reserva para fills/iconos/rings/bordes (non-text, 3:1 suficiente).

### Headers unificados

Los 7 headers siguen el mismo contrato: eyebrow canela + H1 + meta + KPI strip (3-4 cards) + actions a la derecha.

| Sección | Clase raíz | KPIs |
|---------|------------|------|
| Resumen | `.zs-dash-header` | (la parrilla mantiene `.summary-v5__*` como esqueleto legacy; migrable) |
| Citas | `.zs-citas-kpi-strip` (inline en `CitasHeader`) | Total mes, Pendientes, Confirmadas, Completadas + ring completitud |
| Profesionales | `.zs-pros-header` | Activos, Especialidades, Servicios asignados, Servicios/profesional |
| Servicios | `.zs-svc-header` | Servicios totales, Categorías, Activos, Precio medio |
| Pacientes | `.zs-pac-header` | Total, RGPD aceptado, Consentimiento pendiente, Tasa consentimiento |
| Horarios | `.zs-hor-header` | Franjas semanales, Días activos, Excepciones |
| Configuración | `.zs-cfg-header` | Horario apertura, Ventana reserva, Aviso mínimo, Enlaces legales |

### Cambios por sección

- **Resumen**: KPI grid con iconos y tone variants, DonutChart top servicios, BarChartH estados de citas, RadialRing completitud, date picker compacto. Header rewrite — se quitó el bloque canela oscuro lateral que rompía el ritmo.
- **Citas**: KPI strip + RadialRing completitud, heat bar encima de cada día (`--day-heat` CSS var), dot-grid empty state.
- **Profesionales**: cards con avatar aurora ring (`conic-gradient(from 200deg, ...canela)`), pulsing dot badge activo/inactivo, service chips, segmented control.
- **Servicios**: editorial category headers con border-left canela, ServiceTile grid (precio en Cormorant 32px + clock icon + duration bar proporcional + dot estado en esquina).
- **Pacientes**: row-glow canela 4% en hover, consent pill con dot, fechas relativas ("hace 2 meses" con `date-fns/locale/es`), pill pagination, drawer con avatar canela-gradient + tabs (Datos/Citas/Fichas) + timeline citas con línea vertical canela + dots por estado.
- **Horarios**: coverage bar encima de cada día con % badge derivado de `(slot-minutes / 780) * 100`.
- **Configuración**: fix truncamiento `07:00 - 20:0…` → `07h–20h`, numbered section badges `01`/`02`/`03`.

### A11y (WCAG 2.2 AA) aplicado

- Charts (`DonutChart`, `BarChartH`, `SparkArea`, `RadialRing`) tienen `role="img"` + `aria-label` descriptivo + `<table class="zs-sr-only">` paralela con los datos.
- Focus ring sólido `2px var(--brand-canela-text)` + halo 15% alpha. Reemplaza el alpha 0.4 anterior que no llegaba a 3:1 sobre blanco.
- Drawer `PatientDetailsPanel` con `role="region"` + `aria-labelledby` apuntando al heading + cierre con `Escape` + focus inicial en el drawer.
- `<tr onClick>` eliminado en `PacientesTable`; ahora solo el botón "Ver ficha" (con `aria-label` que incluye el nombre del paciente) dispara la navegación.
- Segmented controls con `aria-pressed="true|false"` + `role="group"` + label accesible.
- `<label>` sr-only añadido al search de profesionales.
- `SparkArea` usa `useId()` para que el `id` del `<linearGradient>` sea único — antes dos sparklines en la misma página se pisaban el gradiente.

### Pendiente (no bloquea)

1. **`SectionHero` primitive**: los 6 headers `zs-{pros,svc,pac,hor,cfg,dash}-header` tienen markup idéntico. Extraer a un componente reduciría ~5× la duplicación.
2. **Dashboard sigue con `.summary-v5__grid/aside/main` como esqueleto**. Cuando se migre totalmente a `.zs-dash-*`, se podrá borrar `summary-v5.css`.
3. `.ops-screen` sigue en wrappers de `horarios/page.tsx` y `configuracion/page.tsx` — controla padding y background todavía.
4. Recharts `animationDuration={800}` no respeta `prefers-reduced-motion`. Añadir hook `useReducedMotion` y pasar `isAnimationActive={false}` cuando toque (WCAG 2.3.3, AAA).
5. **Legacy CSS todavía vivo**: `.summary-v5-*`, `.ops-*`, `.module-header*`, `.citas-*` (antiguo), `.bento-*`, `.pacientes-table*`, `.schedule-*`. Barrer sección a sección.
6. Modal `PatientDetailsPanel`: falta focus trap y devolución de foco al botón que lo abrió. Si se quiere WCAG AA completo en modales, usar `@radix-ui/react-dialog` o `react-aria`.
7. El color `--chart-1..8` incluye colores con borde mutuo que no llegan a 3:1 (canela vs amber). Si se quiere SC 1.4.11 estricto, añadir separador blanco entre celdas (Recharts `strokeWidth`).

### Archivos críticos

- `src/styles/theme/tokens.css` — token `--brand-canela-text` + `--brand-canela-text-strong`, escalas canela 50-900, chart colors 1-8, glass, glow, easing.
- `src/styles/theme/professional-refresh.css` — bloque grande `.zs-*` (líneas ~870 a final). Es ahora el archivo CSS principal del panel.
- `src/components/charts/{DonutChart,BarChartH,SparkArea,RadialRing}.tsx` — wrappers Recharts con a11y.
- `src/app/(admin)/components/{DashboardStats,DashboardCharts,DashboardAgenda}.tsx` — dashboard KPIs + charts.
- `src/app/(admin)/citas/components/CitasHeader.tsx` + `CitasTimeline.tsx` — heat bar + KPI strip.
- `src/app/(admin)/profesionales/components/{ProfesionalesHeader,ProfesionalesTable}.tsx` — aurora avatar + segmented.
- `src/app/(admin)/servicios/components/{ServiciosHeader,ServiciosTable}.tsx` — ServiceTile grid.
- `src/app/(admin)/pacientes/components/{PacientesHeader,PacientesTable,PatientDetailsPanel}.tsx` — tabla + drawer a11y.
- `src/app/(admin)/horarios/page.tsx` + `src/app/(admin)/configuracion/page.tsx` — headers inline + mejoras visuales.

### Verificación

- `npx tsc --noEmit`: ✅ sin errores
- `npm run build`: ✅ 31 rutas compiladas
- Screenshots antes/después en `/tmp/zeus-audit/` (sprint0-7 + a11y-*).
- Reviews de `typescript-reviewer` y `a11y-architect` ejecutados en paralelo. Los issues críticos/altos se arreglaron; medios/bajos quedan listados arriba como pendientes.

---

## Polish visual 2026-04-26

3ª pasada de refinamiento visual, ejecutada sobre el resultado de los sprints 0-7 de la sesión anterior. Objetivo: eliminar la sensación "flat/plantilla" que aún tenían los cards de profesionales y servicios, y unificar la tipografía H1 y la experiencia de formularios.

### Cambios aplicados

| Área | Detalle | Archivo |
|------|---------|---------|
| **H1 tipografía** | Las 7 secciones (Citas, Resumen, Profesionales, Servicios, Pacientes, Horarios, Configuración) usan ahora `font-family: var(--font-zeus-display)` (Cormorant Garamond 700, `clamp(30px, 2.8vw, 46px)`, `letter-spacing: -0.01em`). Antes usaban Montserrat/Manrope. | `professional-refresh.css`, `citas.css` |
| **Eyebrows** | `font-weight: 600`, `letter-spacing: 0.18em` en todos los eyebrow de sección (antes 700 y 0.14em). | `professional-refresh.css`, `citas.css` |
| **Date title Citas** | "Domingo, 26 Abril" migrado también a Cormorant (`clamp(20px, 2vw, 30px)`, 700). | `calendar-timeline.css` |
| **`zs-pro-card`** | Fondo blanco `#ffffff` + borde `rgba(173,115,50,0.14)` + sombra `0 1px 4px … 0 8px 24px rgba(173,115,50,0.09)` + `::before` top strip de 3px gradiente canela + hover con `translateY(-4px)` y sombra profunda. | `professional-refresh.css` |
| **`zs-svc-tile`** | Mismo patrón que `zs-pro-card` (top strip 3px, borde canela sutil, sombra suave). | `professional-refresh.css` |
| **Override block** | Se eliminó `zs-pro-card` y `zs-svc-tile` del bloque `admin-shell--modern:not(.admin-shell--summary)` que los forzaba a `background: var(--zs-surface-flat)!important` y `box-shadow: none!important` — esa era la causa de la planitud. También se retiró el `::before { display: none }` que tapaba el top strip. | `professional-refresh.css` |
| **Section header** | `.zs-svc-section__head` en modo modern recibe `border-left: 3px solid var(--brand-canela)` + fondo canela 8% — sustituye el bloque opaco anterior. | `professional-refresh.css` |
| **Calendar grid lines** | `.zc-vcal__hline` restaurado con `border-top: 1px solid rgba(173,115,50,0.11)` (antes `display: none`). `.zc-vcal__hline--half` con dashed `rgba(173,115,50,0.05)`. | `calendar-timeline.css` |
| **Sidebar active accent** | `inset 2px` → `inset 4px 0 0 var(--zeus-sidebar-link-strip)` para que el indicador de sección activa sea más legible. | `panel-v6.css` |
| **Inputs baseline** | Todos los `input/select/textarea` dentro de `.admin-shell--modern` tienen fondo `#fffcf8`, borde `rgba(173,115,50,0.22)`, `border-radius: 10px`. Focus: borde `rgba(173,115,50,0.50)` + halo `rgba(173,115,50,0.14)`. Focus-visible global con outline canela 2px. | `professional-refresh.css` |

### Archivos modificados

- `src/styles/theme/professional-refresh.css` — cambios principales (H1s, eyebrows, override block, pro-card, svc-tile, section header, inputs)
- `src/styles/theme/citas.css` — `.zs-ch-title` y `.zs-ch-eyebrow` a Cormorant + nuevo tracking
- `src/styles/theme/calendar-timeline.css` — `.zc-vcal__date-title` a Cormorant, grid lines restauradas
- `src/styles/theme/panel-v6.css` — sidebar active accent 4px

### Estado visual verificado (screenshots en sesión)

- ✅ Citas — "Citas" en Cormorant, "Domingo, 26 Abril" en Cormorant, grid lines canela visibles
- ✅ Configuración — inputs con fondo cream y borde canela sutil en todos los campos
- ✅ Profesionales — cards blancos elevados con top strip canela, sidebar active 4px
- ✅ Servicios — tiles blancos con top strip, section header con left border canela
- ✅ Pacientes — inputs de búsqueda con warm styling, tabla limpia
- ✅ Horarios — day cards con top strip, date inputs con warm cream, section headers con left border
- ✅ Dashboard — "Resumen del centro" en Cormorant, KPIs y charts sin regresión

---

## Integración WhatsApp 2026-05-03

### Resumen

Notificaciones WhatsApp a pacientes vía Meta Cloud API al crear o reagendar citas, tanto desde panel admin como desde portal paciente. Sin token solo imprime en consola (`[whatsapp:dev]`). Fire-and-forget: no bloquea la operación de cita.

### Nuevo archivo: `src/lib/whatsapp.ts`

```
sendAppointmentWhatsApp(params: AppointmentWhatsAppParams): Promise<void>
```

- **Parámetros**: `patientName`, `patientPhone`, `serviceName`, `professionalName`, `startTime` (ISO), `isReschedule`
- **Sin token (dev)**: `console.log('[whatsapp:dev]', action, { patient, phone, service, professional, date, portalUrl })`
- **Con token**: `POST https://graph.facebook.com/v22.0/{WHATSAPP_PHONE_NUMBER_ID}/messages` con `Authorization: Bearer {WHATSAPP_ACCESS_TOKEN}`
- **Payload WhatsApp**: `messaging_product: whatsapp`, `type: text`, `preview_url: false`, texto formateado en español
- **`formatPhone()`**: normaliza a `34XXXXXXXXX` (quita no-dígitos, antepone `34` a números españoles de 9 dígitos)
- **`formatDate()`**: ISO → "lunes 5 de mayo a las 17:00" (días y meses en español)
- **`escapeWaText()`**: escapa `_`, `*`, `~`, `` ` `` para WhatsApp
- **Fire-and-forget**: errores solo logueados (`console.error('[whatsapp] …')`), nunca lanzados

### Modificaciones en rutas

#### `POST /api/admin/appointments` (línea ~246)
```ts
const normalized = normalizeAppointmentRow(data);
void sendWhatsAppForAppointment(normalized, false);
```

#### `PATCH /api/admin/appointments` (líneas ~383-387)
```ts
const isConfirming = cleanPayload.status === 'confirmed';

if (isChangingTiming) {
    void sendWhatsAppForAppointment(updated, true);   // reagendamiento
} else if (isConfirming && currentAppt && currentAppt.status !== 'confirmed') {
    void sendWhatsAppForAppointment(updated, false);  // confirmación
}
```

#### Helper `sendWhatsAppForAppointment()` (línea ~110)
Resuelve datos desde las relaciones del join de Supabase:
- `patient_name` desde `appointment.patient.first_name + last_name` o `appointment.patient_name` (fallback)
- `patient_phone` desde `appointment.patient.phone`; si es null, no envía nada
- `service_name` desde `appointment.service.name`
- `professional_name` desde `appointment.professional.profile.full_name`

#### `POST /api/portal/booking/appointments` (panel y portal, ~línea 174)
Query de profesional ampliada con `profile:profiles(full_name)`. WhatsApp enviado tras insert exitoso si `patient.phone` existe.

### Mensajes

**Confirmación:**
```
Zeus Fisioterapia: Tu cita de {servicio} con {profesional} el {fecha} está confirmada.

Gestiona tus citas: {PORTAL_URL}
```

**Reagendamiento:**
```
Zeus Fisioterapia: Tu cita de {servicio} con {profesional} se ha movido al {fecha}.

Gestiona tus citas: {PORTAL_URL}
```

### Variables de entorno

| Variable | Default | Uso |
|---------|---------|-----|
| `WHATSAPP_ACCESS_TOKEN` | (vacío) | Bearer token para Graph API |
| `WHATSAPP_PHONE_NUMBER_ID` | (vacío) | ID del número WhatsApp en Meta |
| `PORTAL_URL` | `https://zeus-portal-testing.vercel.app/portal/mis-citas` | URL base del portal paciente |

### Verificación
- `npm run test`: 196/196 ✓
- `npm run lint`: 0 warnings ✓
- `npm run build`: limpio ✓
- `NEXT_PUBLIC_SITE_URL`: eliminada (no se usaba)

### Ajuste 2026-05-04 (anti-duplicado)
- `PATCH /api/admin/appointments`: `currentAppt` ahora también se consulta cuando `status='confirmed'` para evaluar transición real de estado.
- Se evita reenvío de confirmación WhatsApp en updates idempotentes (`confirmed -> confirmed`).
- Nuevos tests:
  - `panel/src/app/api/admin/appointments/route.test.ts`: confirma envío en `pending -> confirmed` y ausencia de envío en `confirmed -> confirmed`.
  - `portal/src/app/api/portal/booking/appointments/route.test.ts`: valida trigger de WhatsApp en alta exitosa con teléfono de paciente.

### Pendiente de activación
1. Crear Meta Business App + registrar número WhatsApp clínica
2. Configurar las 3 env vars en Vercel (`zeus-panel-three` y `zeus-portal-three`)
3. Smoke test: crear cita → WhatsApp recibido; reagendar → mensaje de reagendamiento

### Testing
- **Número de test del destinatario**: `682 80 78 45` → normalizado `34682807845`
- Las pruebas se harán con este número como receptor, asignado a un paciente de prueba. No se usarán pacientes reales.

---

## Push Notifications PWA (panel) 2026-05-04

### Resumen

Notificaciones push nativas en móviles del jefe y profesionales cuando entra o se cancela una cita. Usa Web Push API (PWA) — mismo comportamiento que una notificación de WhatsApp pero nativa del navegador. Sin apps externas.

### Archivos nuevos en panel

| Archivo | Propósito |
|---------|-----------|
| `src/app/manifest.ts` | PWA manifest: nombre "Zeus Panel", standalone, icono 192/512, theme canela |
| `public/push-sw.js` | Service Worker: recibe push → `showNotification()` → click navega a `/citas` |
| `src/components/PushNotificationsBootstrap.tsx` | UI de suscripción: registra SW, pide permiso Notification, guarda endpoint en BD. Muestra toast "Activa notificaciones" con botón. En iOS guía instalar en pantalla de inicio |
| `src/app/api/admin/push-subscriptions/route.ts` | API CRUD: POST (upsert por endpoint), DELETE (soft-disable), GET (verifica si hay activas). Same-origin + Zod + auditoría |
| `src/lib/push-notifications.ts` | `sendPanelAppointmentPush()` → consulta profiles owner/professional → busca suscripciones activas → `webpush.sendNotification()` a cada una. `Promise.allSettled` fire-and-forget. Deshabilita suscripciones 404/410. Marca `last_success_at` en entregas exitosas |
| `src/components/AppointmentRealtimeNotifications.tsx` | Listener Supabase Realtime global en layout admin: INSERT → "Nueva cita/reserva", UPDATE a cancelled → "Cita cancelada" |
| `src/lib/appointment-notifications.ts` | Helper puro: parsea source/status, formatea fecha Europe/Madrid, deduplica cancelado→cancelado |
| `src/lib/appointment-notifications.test.ts` | 4 tests: web insert, cancel transition, cancel dedup, non-cancel update |

### Archivos modificados en panel

| Archivo | Cambio |
|---------|--------|
| `src/app/(admin)/layout.tsx` | Importa y renderiza `<AppointmentRealtimeNotifications />` + `<PushNotificationsBootstrap />` + `<Toaster />` |
| `src/app/api/admin/appointments/route.ts` | POST: `void sendPanelAppointmentPush({ kind: 'created' })`. PATCH: `void sendPanelAppointmentPush({ kind: 'cancelled' })` cuando hay transición real a cancelled |
| `src/app/(admin)/page.tsx` | Eliminado listener realtime duplicado (ahora solo en layout) |

### Réplica en portal

`portal/src/lib/push-notifications.ts` contiene `sendPanelAppointmentPush()` con su propio `getAdminSupabase()` inline (crea cliente service_role directo de env vars). Disparado desde:
- `portal/src/app/api/portal/booking/appointments/route.ts` → created
- `portal/src/app/api/portal/appointments/cancel-confirm/route.ts` → cancelled

### VAPID keys (2026-05-04)

```
Public:  BAboAULapjCAfolPxJl71VJCMRlElt2B8apHnNfSIn1aMgSA3Io_gPCB2bQ8Ty7CRWI6TSX60jSYWCBN1LeghvY
Private: 2YUcrLh9U01tQPVRWxgdG4rJ39KezFl2DzoUrtNRILw
```

### Variables de entorno en Vercel

```
NEXT_PUBLIC_PUSH_VAPID_PUBLIC_KEY=BAboAULapjCAfolPxJl71VJCMRlElt2B8apHnNfSIn1aMgSA3Io_gPCB2bQ8Ty7CRWI6TSX60jSYWCBN1LeghvY
PUSH_VAPID_PRIVATE_KEY=2YUcrLh9U01tQPVRWxgdG4rJ39KezFl2DzoUrtNRILw
PUSH_VAPID_SUBJECT=mailto:admin@zeusfisioterapia.com
```

Deben configurarse en ambos proyectos Vercel: `zeus-panel-three` y `zeus-portal-three`.

### BD

Migración `20260504170000_add_push_subscriptions` aplicada en Supabase remoto. Tabla `push_subscriptions` con:
- `endpoint` UNIQUE, `p256dh`, `auth` (claves de suscripción Web Push)
- `user_id` FK → `auth.users`, CASCADE on delete
- `last_success_at`, `disabled_at` para gestión de ciclo de vida
- RLS: solo `auth.uid() = user_id`
- Índices: `user_id` y `(user_id, disabled_at)`

### Verificación

- Panel: 244/244 tests, lint 0 errors, build OK
- Portal: 61/61 tests, build OK
