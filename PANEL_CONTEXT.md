# Zeus Panel - Contexto Operativo

## Estado Actual

Panel administrativo construido con Next.js App Router, React, TypeScript, Supabase, TanStack Query, Zod y CSS propio sobre Tailwind/PostCSS.

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
- Owner puede gestionar todo; professional solo debe operar sobre recursos propios o vinculados.

## Cambios Ya Aplicados

- Eliminado fallback hardcodeado de `SUPABASE_SERVICE_ROLE_KEY` en `scripts/seed_dashboard.js`.
- Creacion de profesionales corregida para generar password solo en servidor.
- Auditoria centralizada con `writeAuditLog()` y `user_id`.
- Endpoint `/api/admin/profile` para cargar perfil desde servidor.
- Endpoint `/api/admin/appointments/pending-count` para contador del sidebar.
- RBAC de pacientes: owner ve todo; professional solo accede a pacientes vinculados por citas o fichas clinicas propias.
- RBAC de citas: professional no puede crear/modificar citas de otro professional ni reasignar paciente.
- RBAC de historias clinicas: professional solo borra registros propios.
- Detalle de paciente filtra citas e historias clinicas por professional autenticado.
- Accesibilidad inicial en modal de confirmacion, formulario de citas, panel de paciente y timeline.
- Tests base con Vitest para schemas, helpers de fechas, errores, auditoria y RBAC.
- Tests de route handlers anadidos para `401`, `403`, owner-only y errores de Supabase en `audit`, `booking-settings`, `profile` y `appointments/pending-count`.
- CSP separada entre desarrollo y produccion en `next.config.ts`.
- Dependencias no usadas eliminadas del `package.json`.
- Migracion RLS aplicada en Supabase como `20260416212154_adapt_panel_rls_to_live_schema`.

## Verificacion Actual

Ultima verificacion local ejecutada:

```bash
npm run test
npm run lint
npm run build
```

Resultado: pasa.

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
2. Probar en runtime con tres usuarios reales: owner, professional A y professional B.
3. Confirmar que professional A no ve ni modifica pacientes, citas o fichas de professional B.
4. Confirmar que `audit_logs` recibe filas reales al crear, editar, borrar y exportar.
5. Extender tests de route handlers al resto de endpoints admin no cubiertos.
6. Configurar Playwright para smoke e2e de login, dashboard, citas, pacientes, profesionales, servicios, horarios y configuracion.
7. Corregir mojibake/copy pendiente: acentos, `clinica`, `sesion`, `contrasena`, textos largos y estados vacios.
8. Revisar visualmente responsive en 390px, 768px, 1366px y 1920px.

## Criterio Para Reestructurar

1. No mover componentes si rompe rutas App Router o imports `@/`.
2. No unir hooks cliente con logica server-side.
3. No exponer service role ni queries clinicas en cliente.
4. Separar cambios de seguridad, cambios visuales y limpieza de archivos.
5. Ejecutar test, lint y build antes de cerrar cualquier bloque.
