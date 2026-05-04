# Plan de Implementación
## Citas con Cuenta + Google + WhatsApp Automático

Fecha: 2026-04-30  
Estado: listo para ejecutar en próxima sesión

## 1) Objetivo

Implementar este flujo:

1. Reserva solo con cuenta de portal (no reserva anónima final).
2. Login portal con Google como vía principal.
3. Protección ante cuenta Google equivocada (confirmación de identidad + cambiar cuenta).
4. WhatsApp automático solo en:
   - cita confirmada
   - cita movida/reprogramada

## 2) Alcance y reglas de producto

1. `web/` se usa para captación y entrada al flujo.
2. `portal/` es la única superficie para reserva de paciente autenticado.
3. `panel/` solo admin y operación clínica.
4. No enviar mensajes de WhatsApp con datos clínicos sensibles.
5. No usar consentimiento de marketing como sustituto de consentimiento transaccional WhatsApp.

## 3) Decisiones bloqueantes (resolver al inicio de la próxima sesión)

1. Login:
   - Opción A: Google-only.
   - Opción B: Google principal + email/password secundario.
2. `web/citas.html`:
   - Opción A: solo CTA a login portal.
   - Opción B: mantiene selección de slot y traspasa contexto al login.
3. Política de fallo de WhatsApp:
   - Recomendado: best-effort con outbox y reintentos (no bloquear operación admin).
4. Proveedor WhatsApp:
   - Meta Cloud API directo.
   - Twilio.

## 4) Fases de implementación

### Fase 0 — Contrato canónico (0.5-1 día)

Objetivo:
1. Congelar ownership técnico: `portal` auth/reserva, `panel` admin, `web` captación.

Tareas:
1. Alinear documentación de contexto:
   - `README.md` (raíz)
   - `PROJECT_CONTEXT.md`
   - `panel/PANEL_CONTEXT.md`
   - `supabase/README.md`

Criterio de salida:
1. Sin ambigüedad de ownership.
2. Sin nuevos cambios funcionales en rutas legacy del panel relacionadas con portal.

---

### Fase 1 — Contrato de identidad y consentimiento WhatsApp (1.5-2 días)

Objetivo:
1. Dejar identidad y consentimiento listos para notificación transaccional segura.

Tareas:
1. Aplicar migración pendiente:
   - `supabase/migrations/20260430143000_identity_contract_phase1.sql`
2. Crear migración nueva para:
   - consentimiento WhatsApp transaccional
   - tabla outbox de notificaciones
   - deduplicación por evento de cita
3. Ajustar validaciones de identidad y normalización (`portal` + `panel`).

Criterio de salida:
1. Estado de identidad consistente.
2. Consentimiento transaccional por canal auditable.
3. Sin ruptura de RLS actual.

---

### Fase 2 — Bloquear reserva anónima final (1.5-2 días)

Objetivo:
1. Ningún usuario anónimo crea citas.

Tareas:
1. Cambiar `portal/src/app/api/public/booking/appointments/route.ts` para actuar como guardrail.
2. Cambiar `web/citas.html` + `web/js/booking.js` para derivar a portal login.
3. Mantener creación real solo en:
   - `portal/src/app/api/portal/booking/appointments/route.ts`

Criterio de salida:
1. Cero inserts en `appointments` desde `anon`.
2. Flujo web conserva contexto mínimo (servicio/profesional/slot) si se decidió en Fase 0.

---

### Fase 3 — Login unificado + cuenta Google equivocada (2-3 días)

Objetivo:
1. Evitar reservas con cuenta Google incorrecta.

Tareas:
1. Endurecer callback OAuth:
   - `portal/src/app/auth/callback/route.ts`
2. Añadir pantalla de confirmación de identidad (o refactor `completar-perfil`).
3. Añadir acción explícita “Cambiar cuenta”.
4. Bloquear acceso a `mis-citas` y `reservar` si cuenta no verificada.

Criterio de salida:
1. Nunca autolink por email.
2. Usuario puede corregir cuenta sin soporte manual.
3. Cobertura de casos: cuenta correcta/equivocada/no vinculada.

---

### Fase 4 — WhatsApp automático (confirmada + movida) (3-4 días + lead time proveedor)

Objetivo:
1. Envío automático, idempotente y trazable.

Reglas de envío:
1. `appointment_confirmed` si `previous.status != confirmed` y `next.status == confirmed`.
2. `appointment_moved` si cambia `start_time`, `end_time`, `professional_id` o `service_id` en cita activa no cancelada.
3. No enviar en create pending, cancel, complete, ni cambios irrelevantes.

Tareas:
1. Trigger lógico desde PATCH admin de citas:
   - `panel/src/app/api/admin/appointments/route.ts`
2. Implementar outbox + worker + delivery log.
3. Implementar adaptador proveedor WhatsApp con plantillas.
4. Eliminar dependencia de links manuales `wa.me` para operación automática.

Criterio de salida:
1. Solo 2 eventos envían.
2. Sin duplicados.
3. Trazabilidad completa por cita/evento/estado proveedor.

---

### Fase 5 — Hardening, pruebas y rollout (1.5-2 días)

Objetivo:
1. Cerrar seguridad/compliance y desplegar con evidencia.

Tareas:
1. Convertir puntos `best-effort` sensibles a estrategia aprobada (fail-closed o controlada).
2. Revisar minimización de contenido en mensajes.
3. Ejecutar suite completa + smoke multi-superficie.

Criterio de salida:
1. Checklist seguridad verde.
2. Smoke `web`, `portal`, `panel` verde.
3. Contexto actualizado con evidencia.

## 5) Orden recomendado de PRs

1. PR1: contrato canónico + docs.
2. PR2: migraciones identidad/consentimiento/outbox.
3. PR3: bloqueo reserva anónima + redirección web.
4. PR4: login/confirmación/cambiar cuenta.
5. PR5: motor WhatsApp automático + triggers.
6. PR6: hardening final + e2e + smoke + actualización de contexto.

## 6) Estrategia de pruebas (TDD)

Unit:
1. Guard de identidad y estado de cuenta.
2. Detección de transición confirmada.
3. Detección de cita movida.
4. Idempotencia de eventos.

Integración:
1. `GET /auth/callback`
2. `POST /api/portal/complete-profile` (o endpoint equivalente)
3. `POST /api/portal/booking/appointments`
4. `POST /api/public/booking/appointments`
5. `PATCH /api/admin/appointments`

E2E:
1. Web anónima deriva a login.
2. Google cuenta equivocada -> confirmación -> cambiar cuenta.
3. Verificado reserva.
4. Admin confirma cita -> evento WhatsApp.
5. Admin mueve cita -> evento WhatsApp.
6. Cancelación no dispara evento de este alcance.

## 7) Riesgos principales y mitigación

1. Split-brain entre superficies legacy portal en `panel` y proyecto `portal`.
   - Mitigación: congelar uso y documentar canónico.
2. Pérdida de conversión al quitar reserva anónima.
   - Mitigación: UX clara y traspaso de contexto al login.
3. Duplicidad de mensajes por reintentos.
   - Mitigación: outbox idempotente + claves únicas por evento.
4. Riesgo legal por consentimiento mal modelado.
   - Mitigación: consentimiento transaccional separado y auditable.

## 8) Checklist de arranque para próxima sesión

1. Confirmar 4 decisiones bloqueantes (sección 3).
2. Ver estado de migración `20260430143000_identity_contract_phase1.sql` en remoto.
3. Elegir proveedor WhatsApp y disponibilidad de plantillas.
4. Crear branch de trabajo y PR1.
5. Ejecutar plan por PRs en orden.

## 9) Estimación global

1. Ingeniería: 10-14 días laborables.
2. Dependencia externa WhatsApp Business: +3-10 días.

