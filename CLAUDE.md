# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Zeus Admin Panel** — a clinical appointment management system for physiotherapy and psychology practices. Built for a real clinic called "Zeus Fisioterapia". The UI is entirely in **Spanish**. This is the admin/backoffice panel; a separate public-facing web exists in the `../web/` directory.

**Stack**: Next.js 16 (App Router) · React 19 · TypeScript (strict) · Supabase (Postgres + Auth + Realtime) · TanStack Query v5 · Zod · Custom CSS design system · Tailwind v4 imported but not used for component styling.

---

## Commands

```bash
npm run dev          # Dev server at localhost:3000 (Turbopack)
npm run build        # Production build
npm run start        # Serve production build
npm run lint         # ESLint v9 flat config (core-web-vitals + typescript)
npx vitest run       # Run unit tests (Vitest v4, environment: node)
```

---

## Architecture

### Provider Stack

Root layout (`src/app/layout.tsx`) wraps the app in:
1. `<Providers>` (`src/app/providers.tsx`) — `QueryClientProvider` from TanStack Query (60s staleTime, no refetch on window focus). ReactQueryDevtools available via `NEXT_PUBLIC_SHOW_DEVTOOLS=true`.
2. `<AuthProvider>` (`src/lib/auth-context.tsx`) — client context for user/profile/session state.

### Auth Flow

1. **Middleware** (`src/proxy.ts` → `src/lib/supabase/proxy.ts`) — calls `updateSession()` to refresh Supabase auth cookies on every request. Redirects unauthenticated users to `/login` (except `/login` and `/auth` paths).
2. **AuthProvider** (`src/lib/auth-context.tsx`) — manages `user`, `profile`, `session`, `loading`, `profileError` state. Listens to `onAuthStateChange`. Fetches profile from `profiles` table with **30min localStorage caching** + request deduplication. Includes timeout protection (1.8s for getSession, 4.5s for profile fetch, 12s for signIn).
3. **Admin layout** (`src/app/(admin)/layout.tsx`) — client-side guard: requires `user` + `profile.role` in `['owner', 'professional']`. Includes stuck-loading detection at 7s (profile) and 12s (global), with retry/logout fallback UI. Renders the `admin-shell` layout with Sidebar, topbar, and content area.

### Supabase Clients

| Client | File | Usage |
|--------|------|-------|
| **Browser** | `src/lib/supabase/client.ts` | `createBrowserClient()` singleton via module-level caching |
| **Server** | `src/lib/supabase/server.ts` | `createServerClient()` using `cookies()` — used in API routes and Server Actions |
| **Middleware** | `src/lib/supabase/proxy.ts` | `updateSession()` for cookie-based session refresh |
| **Admin (SERVICE_ROLE)** | `src/app/api/admin/create-professional/route.ts` | Direct `createClient()` from `@supabase/supabase-js` with `SUPABASE_SERVICE_ROLE_KEY` — bypasses RLS |

### Data Fetching Pattern

**Frontend hooks** (`src/hooks/`) use TanStack Query v5 with `useQuery` + `useMutation`. All hooks call internal API routes via `fetch('/api/admin/...')` — they do **NOT** call Supabase directly from the browser. Mutations include optimistic updates (appointments) and cache invalidation.

**API routes** (`src/app/api/admin/`) handle all DB operations through the server-side Supabase client. Every route uses `requirePanelAccess()` for auth + role checks and `handleApiError()` for consistent error responses. Zod schemas validate all request bodies.

**Dashboard** uses a Server Action (`src/app/(admin)/actions.ts` → `getDashboardData()`) that calls Supabase RPC `get_dashboard_stats` for aggregated stats.

**Realtime**: The `useCitas` hook subscribes to `postgres_changes` on the `appointments` table and invalidates the query cache when changes are detected.

### Routing

All admin pages live under `src/app/(admin)/` route group:

| Route | Page | Description |
|-------|------|-------------|
| `/` | Dashboard | Stats (bento grid), today's agenda, activity charts (recharts), session breakdown |
| `/citas` | Appointments | CRUD with status filters, day/week timeline views, drag-and-drop rescheduling, FullCalendar integration |
| `/pacientes` | Patients | Records + GDPR consent tracking + clinical records (anamnesis, exploration, evolution, report) |
| `/profesionales` | Professionals | Therapist/doctor management with service associations and schedule setup |
| `/servicios` | Services | Service + category catalog with color-coded categories |
| `/horarios` | Schedules | Weekly schedule slots + date-based exceptions per professional |
| `/configuracion` | Settings | Global booking settings, clinic info, GDPR texts (owner only) |

**Login**: `src/app/login/page.tsx` with its own layout (`src/app/login/layout.tsx`). Split-screen design with brand cover on the left and form on the right.

### API Routes

All routes under `src/app/api/admin/`:

| Route | Methods | Description |
|-------|---------|-------------|
| `_lib.ts` | — | Shared utilities: `requirePanelAccess()`, `handleApiError()`, `ApiRouteError` |
| `appointments/route.ts` | GET, POST, PATCH | CRUD + audit logging. Professional users only see their own appointments |
| `appointments/[id]/route.ts` | DELETE | Delete appointment by ID |
| `patients/route.ts` | GET, POST, PATCH | Search + pagination, create, update |
| `patients/[id]/route.ts` | GET, DELETE | Get details, soft-delete with cascade |
| `professionals/route.ts` | GET, PATCH, DELETE | List, update (with service links), deactivate |
| `professionals/[id]/schedule/` | GET, PUT | Get/replace schedule slots |
| `professionals/[id]/exceptions/` | GET, POST | Schedule exceptions |
| `create-professional/route.ts` | POST | Full professional creation flow (auth user + profile + professional + services + schedule) using SERVICE_ROLE_KEY |
| `services/route.ts` | GET, POST, PATCH, DELETE | Service CRUD |
| `service-categories/route.ts` | GET, POST, PATCH, DELETE | Category CRUD |
| `booking-settings/route.ts` | GET, PATCH | Clinic settings |
| `schedule-slots/route.ts` | POST | Create slot |
| `schedule-slots/[id]/route.ts` | DELETE | Delete slot |
| `schedule-exceptions/route.ts` | GET, POST | Query/create exceptions |
| `schedule-exceptions/[id]/route.ts` | DELETE | Delete exception |
| `clinical-records/route.ts` | GET, POST, PATCH, DELETE | Clinical record CRUD |
| `audit/route.ts` | POST | Write audit log entries |

### Authorization Model

**API-level** (`_lib.ts`):
- `requirePanelAccess()` verifies auth via `supabase.auth.getUser()`, fetches profile role, rejects non-owner/professional users
- `ownerOnly: true` option for owner-restricted endpoints
- Professional users are scoped to their own data in appointments API (`eq('professional_id', userId)`)

**Client-level** (`panel-navigation.ts`):
- `PROFESSIONAL_RESTRICTED_PATHS`: `/profesionales`, `/servicios`, `/horarios`, `/configuracion`
- `canRenderNavItem()` hides ownerOnly nav items for professionals
- Admin layout redirects professionals away from restricted pages

**Database-level**: RLS is enabled on all tables. Exact policies depend on Supabase configuration.

### Roles

| Role | Access |
|------|--------|
| `owner` | Full access to all pages and operations |
| `professional` | Dashboard, citas (own only), pacientes. Cannot access: profesionales, servicios, horarios, configuración |
| `client` | Redirected away from admin panel entirely |

---

## Database Schema (Supabase/Postgres)

### Custom Enums
- `user_role`: `owner`, `professional`, `client`
- `appointment_status`: `pending`, `confirmed`, `cancelled`, `completed`
- `record_type`: `anamnesis`, `exploration`, `evolution`, `report`

### Tables

```
profiles            — User profiles (1:1 with auth.users)
  id (uuid PK → auth.users.id), email (unique), role (user_role, default 'client'), full_name, created_at

professionals       — Professional/therapist records
  id (uuid PK), user_id (→ profiles.id), specialty, license_number, bio, color_code (default '#3B82F6'),
  is_active, first_name, last_name, email, phone, photo_url, created_at

services            — Treatment/service catalog
  id (uuid PK), name, description, duration_minutes, price (numeric), requires_medical_history,
  is_active, category_id (→ service_categories.id), created_at

service_categories  — Service groupings
  id (uuid PK), name (unique), slug (unique), description, icon, color (default '#C4956A'),
  display_order, is_active, created_at

professional_services — M:N junction table
  professional_id (→ professionals.id), service_id (→ services.id)  [composite PK]

patients            — Patient records
  id (uuid PK), first_name, last_name, document_id (unique), phone, email, birth_date,
  address, gdpr_consent, marketing_consent, created_at, updated_at, deleted_at (soft-delete)

appointments        — Appointment bookings
  id (uuid PK), patient_id (→ patients.id, nullable), professional_id (→ professionals.id, nullable),
  service_id (→ services.id, nullable), start_time (timestamptz), end_time (timestamptz),
  status (appointment_status, default 'pending'), notes, patient_name, patient_phone, patient_email,
  source (CHECK: 'web'|'admin'|'phone', default 'web'), cancellation_reason, created_at, updated_at

schedule_slots      — Recurring weekly availability
  id (uuid PK), professional_id (→ professionals.id), day_of_week (smallint, CHECK: 1-7,
  1=Lunes/Monday ISO), start_time (time), end_time (time), is_active, created_at

schedule_exceptions — Date-specific overrides
  id (uuid PK), professional_id (→ professionals.id), exception_date (date),
  is_available (default false), start_time (time), end_time (time), reason, created_at

booking_settings    — Global clinic configuration (single row)
  id (uuid PK), clinic_name, phone, email, address, booking_advance_days (30),
  min_booking_notice_hours (2), cancellation_hours (24), slot_interval_minutes (30),
  buffer_minutes (10), gdpr_text, informed_consent_text, privacy_policy_url, terms_url,
  opening_hour (time, default '07:00'), closing_hour (time, default '20:00'), updated_at

clinical_records    — Patient clinical documentation
  id (uuid PK), patient_id (→ patients.id), professional_id (→ professionals.id),
  type (record_type), content (jsonb), attachments (text[]), created_at, updated_at

consent_records     — GDPR consent trail
  id (uuid PK), patient_id (→ patients.id), appointment_id (→ appointments.id, nullable),
  consent_type (CHECK: 'gdpr'|'informed'|'marketing'), consent_text, granted,
  ip_address, user_agent, granted_at, revoked_at

audit_logs          — Mutation audit trail
  id (uuid PK), user_id (→ auth.users.id), action, table_name, record_id (uuid),
  details (jsonb), ip_address, created_at
```

### Database RPC Functions
- `get_dashboard_stats(p_professional_id, p_week_start, p_week_end)` — returns aggregated dashboard data (totalPatients, weekCount, pendingCount, estimatedRevenue, sessionBreakdown, globalStatus)

---

## Key Files Reference

### Core Library (`src/lib/`)

| File | Purpose |
|------|---------|
| `types.ts` | All TypeScript interfaces + enums + constants (Profile, Patient, Professional, Service, Appointment, ScheduleSlot, BookingSettings, ConsentRecord, ClinicalRecord, DashboardData, etc.) + `DAY_NAMES`, `STATUS_LABELS`, `STATUS_COLORS`, `RECORD_TYPE_LABELS`, `toUiDayOfWeek()`, `toDbDayOfWeek()` |
| `schemas.ts` | Zod validation schemas (Patient, Service, ServiceCategory, Professional, Appointment form/insert/update, ScheduleException) + `validateData()` helper |
| `auth-context.tsx` | AuthProvider with profile caching, timeout protection, deduplication. Exports `useAuth()` hook |
| `panel-navigation.ts` | Nav items array, role-based visibility checks (`canRenderNavItem`), professional path restrictions, section title resolver |
| `audit.ts` | `logAuditEvent()` — client-side function that POSTs to `/api/admin/audit` for mutation logging |
| `utils.ts` | `getAvatarColor()`, `getInitials()`, `isSameDay()`, `formatTime()` |

### Data Hooks (`src/hooks/`)

| Hook | Query Key | Description |
|------|-----------|-------------|
| `useCitas.ts` | `['citas', start_date, end_date]` | Appointments + realtime subscription. Exports: `useCitas`, `useCreateCita`, `useUpdateCita`, `useUpdateCitaStatus`, `useCancelCita`, `useDeleteCita`, `useScheduleExceptions`, `useCreateException` |
| `usePacientes.ts` | `['pacientes', {searchTerm, page, pageSize}]` | Patients with search + pagination. Exports: `usePacientes`, `useCreatePaciente`, `useUpdatePaciente`, `useDeletePaciente` |
| `useProfesionales.ts` | `['profesionales']` | Professionals. Exports: `useProfesionales`, `useCreateProfesional`, `useUpdateProfesional`, `useDeleteProfesional` |
| `useServicios.ts` | `['servicios']` / `['categorias']` | Services + categories. Exports: `useServicios`, `useCategorias`, `useCreateServicio`, `useUpdateServicio`, `useDeleteServicio` |
| `useSettings.ts` | `['booking_settings']` | Booking settings (5min staleTime). Exports: `useSettings` |
| `useHorarios.ts` | `['horario', professionalId]` | Schedule slots + exceptions per professional. Exports: `useHorario`, `useCreateSlot`, `useDeleteSlot`, `useCreateException`, `useDeleteException`, `useApplyDefaultSchedule` |

### Shared UI Components

**`src/components/`**:
- `Icon.tsx` — Custom SVG icon system (35+ icons). Add new icons to the `paths` Record object. Props: `name`, `size` (default 20), `className`, `style`. Icons: dashboard, calendar, doctor, spa, users, activity, bell, briefcase, folder, lock, clock, settings, logout, chart, hourglass, clipboard, search, edit, trash, globe, phone, user, building, scale, save, warning, check, close, plus, menu, alert-triangle, info, eye, filter, mail, list, chevron-left/right/down, x, alert-circle, refresh-cw.
- `Sidebar.tsx` — Collapsible left navigation. Role-aware item visibility. Shows pending appointment badge.
- `ConfirmModal.tsx` — Reusable confirmation dialog with custom message.

**`src/components/ui/`**:
- `Button.tsx` — Variants: primary, secondary, danger, ghost. Sizes: sm, md, lg. `isLoading` spinner, `leftIcon`/`rightIcon` slots. Uses `forwardRef`.
- `Modal.tsx` — Portal-based modal with focus trapping, Esc to close, backdrop click handling. `maxWidth` variants: sm, md, lg, xl, 2xl, 3xl, 4xl, 5xl, full. ARIA compliant (`role="dialog"`, `aria-modal`, `aria-labelledby`).
- `Card.tsx` — Section wrapper with optional header.
- `Input.tsx` — Form input wrapper with label and error display.
- `Badge.tsx` — Status/category badges.

### Feature Components

```
src/app/(admin)/citas/components/
├── AppointmentDetailPanel.tsx    # Detail view for selected appointment
├── AppointmentExceptionModal.tsx # Create day-off/exception from citas view
├── AppointmentFormModal.tsx      # Create/edit appointment form (15.7KB)
├── CancelCitaModal.tsx           # Cancellation with reason
├── CitasFilters.tsx              # Status + professional + search filters
├── CitasHeader.tsx               # Date navigation + view toggle + new button
├── CitasTable.tsx                # Table view of appointments
└── CitasTimeline.tsx             # Timeline/calendar view (24KB)

src/app/(admin)/pacientes/components/
├── ClinicalRecordFormModal.tsx   # Create/edit clinical records (anamnesis, etc.)
├── PacientesHeader.tsx           # Search + new patient button
├── PacientesTable.tsx            # Patient list table
├── PatientDetailsPanel.tsx       # Full patient detail view with tabs
└── PatientFormModal.tsx          # Create/edit patient form

src/app/(admin)/profesionales/components/
├── ProfesionalesHeader.tsx       # New professional button
├── ProfesionalesTable.tsx        # Professional cards/list
└── ProfessionalFormModal.tsx     # Full professional form (18KB)

src/app/(admin)/servicios/components/
├── CategoryFormModal.tsx         # Category create/edit
├── ServiceFormModal.tsx          # Service create/edit
├── ServiciosHeader.tsx           # New service/category buttons
└── ServiciosTable.tsx            # Services grouped by category

src/app/(admin)/components/       # Dashboard components
├── DashboardStats.tsx            # Bento grid stat cards
├── DashboardCharts.tsx           # Recharts activity/revenue charts
└── DashboardAgenda.tsx           # Today's agenda list
```

---

## Styling

### System

Custom CSS design system — **Tailwind v4 is imported** in `globals.css` (`@import "tailwindcss"`) and available, but component styling uses **custom CSS classes exclusively**. Never add Tailwind utility classes to components.

### CSS Architecture

**Entry point**: `src/app/globals.css` imports in order:
1. `tailwindcss` (reset/utilities baseline)
2. `../styles/legacy-base.css` — Legacy styles (login, old components)
3. `../styles/theme/tokens.css` — CSS custom properties
4. `../styles/theme/base.css` — Resets, typography, scrollbars
5. `../styles/theme/layout.css` — Page shell, sidebar, topbar, admin grid
6. `../styles/theme/components.css` — Buttons, forms, modals, badges, cards
7. `../styles/theme/calendar.css` — FullCalendar overrides
8. `../styles/theme/citas.css` — Citas page specific styles (35KB)
9. `../styles/theme/summary-v5.css` — Dashboard summary cards
10. `../styles/theme/bento.css` — Dashboard bento grid layout (63KB)
11. `../styles/theme/panel-v6.css` — Panel v6 refined styles (51KB)
12. `../styles/theme/professional-refresh.css` — Professional page styles

### Design Tokens (`tokens.css`)

```css
/* Brand */
--brand-canela: #AD7332;        /* Primary warm brown */
--brand-canela-light: #C9954D;
--brand-canela-dark: #8B5A26;
--brand-dark: #0A0A0A;

/* Typography */
--text-main: #111827;
--text-muted: #6B7280;
--text-inverse: #FFFFFF;

/* Backgrounds */
--bg-body: #F4F4F5;             /* Zinc-100 */
--bg-surface: #FFFFFF;           /* Cards */
--bg-sidebar: #0A0A0B;          /* Deep dark sidebar */

/* Status Colors */
--success-main: #059669;
--warning-main: #D97706;
--danger-main: #DC2626;
--info-main: #2563EB;

/* Shadows (Apple-like clean) */
--shadow-sm/md/lg/card-hover

/* Border Radii */
--radius-sm: 8px  --radius-md: 12px  --radius-lg: 16px  --radius-xl: 24px

/* Transitions */
--transition-fast: 0.15s  --transition-short: 0.2s  --transition-bounce: 0.3s
```

### Fonts (loaded via `next/font/google` in root layout)

| Variable | Font | Usage |
|----------|------|-------|
| `--font-body` | Manrope | Body text, UI elements |
| `--font-zeus-sans` | Montserrat | Headings, nav |
| `--font-zeus-display` | Cormorant Garamond | Display/branding |

### Class Naming Convention

- **BEM-like**: `.sidebar__logo-text`, `.card__header`, `.modal__title`, `.panel-topbar__date`
- **Buttons**: `.btn`, `.btn--primary`, `.btn--secondary`, `.btn--danger`, `.btn--ghost`, `.btn--sm`, `.btn--lg`
- **Forms**: `.form-input`, `.form-select`, `.form-label`, `.form-group`
- **Modals**: `.modal`, `.modal-overlay`, `.modal-backdrop`, `.modal--sm|md|lg|xl|2xl|3xl|4xl|5xl|full`, `.modal__header`, `.modal__body`, `.modal__close`
- **Layout**: `.admin-shell`, `.main-content`, `.panel-topbar`, `.loading-page`, `.spinner`
- **Status**: Use status color constants from `types.ts` inline style (STATUS_COLORS)

---

## Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | 16.1.6 | Framework (App Router, Turbopack) |
| `react` / `react-dom` | 19.2.3 | UI library |
| `@supabase/ssr` | ^0.8.0 | Supabase SSR client |
| `@supabase/supabase-js` | ^2.97.0 | Supabase JS client |
| `@tanstack/react-query` | ^5.90.21 | Data fetching + caching |
| `react-hook-form` + `@hookform/resolvers` | ^7.71.2 / ^5.2.2 | Form state management |
| `zod` | ^3.25.76 | Schema validation |
| `recharts` | ^3.7.0 | Dashboard charts |
| `sonner` | ^2.0.7 | Toast notifications |
| `date-fns` | ^4.1.0 | Date manipulation (**use this for all new code**) |
| `luxon` | ^3.7.2 | Used by FullCalendar adapter |
| `@fullcalendar/*` | ^6.1.20 | Calendar timeline views (core, react, timegrid, resource-timegrid, interaction, luxon3, scrollgrid, resource) |
| `tailwindcss` | ^4.2.1 | CSS framework (imported but not used for component classes) |
| `vitest` | ^4.1.4 | Test framework |

---

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL         # Supabase project URL (public, safe for browser)
NEXT_PUBLIC_SUPABASE_ANON_KEY    # Supabase anon key (public, safe for browser)
SUPABASE_SERVICE_ROLE_KEY        # Server-only admin key (NEVER expose to client)
NEXT_PUBLIC_SHOW_DEVTOOLS        # Optional: 'true' to enable ReactQuery devtools in dev
```

---

## Build Config

- **React Compiler** enabled: `reactCompiler: true` in `next.config.ts`
- **Turbopack** configured with `root: process.cwd()`
- **Dev indicators** disabled: `devIndicators: false`
- **Security headers** configured in `next.config.ts`: X-Frame-Options (DENY), X-Content-Type-Options (nosniff), Referrer-Policy, Permissions-Policy, HSTS, CSP
- **ESLint v9** flat config: `core-web-vitals` + `typescript`. Rule `react-hooks/set-state-in-effect` disabled due to React Compiler false positive ([facebook/react#34905](https://github.com/facebook/react/issues/34905))
- **Path alias**: `@/*` maps to `./src/*`
- **TypeScript**: `strict: true`, target `ES2017`, JSX `react-jsx`, incremental builds
- **Vitest**: environment `node`, glob `src/**/*.test.{ts,tsx}`, globals enabled

---

## Day of Week Convention

**Canonical DB mapping**: `1=Lunes, 2=Martes, ..., 7=Domingo` (ISO 8601). Enforced by CHECK constraint on `schedule_slots.day_of_week`.

**UI index**: `0=Lunes, 1=Martes, ..., 6=Domingo`. Used by `DAY_NAMES` array in `types.ts`.

**Conversion functions** (in `types.ts`):
- `toUiDayOfWeek(dbValue)` — converts DB 1-7 to UI 0-6 (also handles legacy 0-6 values)
- `toDbDayOfWeek(uiIndex)` — converts UI 0-6 to DB 1-7

**Always use these functions** when converting between DB and UI day representations.

---

## Known Technical Debt

See `BUGS_Y_LIMITACIONES.md` for the full audit. Key items:

1. **Patient deletion uses non-transactional cascade** — clinical_records + consent_records deleted, then appointments nullified, then patient deleted in 4 separate operations. Should be an RPC/database function.
2. **Timezone handling** — All dates use browser `new Date()` timezone. No clinic timezone configuration. Users in different timezones see incorrect appointment times.
3. **No overbooking prevention** — Multiple appointments can be booked for the same professional at overlapping times.
4. **Sidebar polling** — Queries pending count every 60 seconds instead of using realtime subscription.
5. **Mixed styling** — Some adhoc inline styles and Tailwind utility classes mixed with custom CSS classes.

---

## Conventions

### General
- All UI text in **Spanish** (labels, toasts, errors, placeholders)
- Commit format: `feat:`, `fix:`, `chore:`, `refactor:`
- Use `date-fns` v4 for all date manipulation in new code
- Use `@/` path alias for all imports

### Components
- New pages: create `src/app/(admin)/[feature]/page.tsx` with `'use client'` directive
- Feature components: co-locate in `src/app/(admin)/[feature]/components/`
- Reusable UI: place in `src/components/ui/`
- New icons: add SVG path string to `paths` object in `src/components/Icon.tsx`
- Modal pattern: use `<Modal>` from `src/components/ui/Modal.tsx` with state pattern:
  ```tsx
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState<FormType | null>(null);
  const [saving, setSaving] = useState(false);
  ```

### Data Layer
- Data hooks: create in `src/hooks/` using TanStack Query pattern
- All DB operations through API routes (`/api/admin/...`)
- API routes use `requirePanelAccess()` guard + `handleApiError()` wrapper
- Validation: define Zod schemas in `src/lib/schemas.ts`
- Types: define interfaces in `src/lib/types.ts`
- Mutations: always `invalidateQueries` on success, use optimistic updates for appointments
- Export query keys as constants (e.g., `APPOINTMENTS_QUERY_KEY = ['citas']`)

### Styling
- Use custom CSS classes from the design system — never Tailwind utilities
- Follow BEM-like naming: `.component__element--modifier`
- Use CSS variables from `tokens.css` for colors, spacing, shadows
- Toast notifications via `sonner`: `toast.success()` / `toast.error()`

### API Routes
- Place under `src/app/api/admin/[resource]/route.ts`
- Use shared `_lib.ts` for `requirePanelAccess()`, `handleApiError()`, `ApiRouteError`
- Always validate request body with Zod
- Return `NextResponse.json()` with appropriate status codes
- Log audit events for data mutations via `insertAuditLog()` or `logAuditEvent()`
- Scope professional users to their own data where applicable
