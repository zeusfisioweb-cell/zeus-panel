# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Zeus Admin Panel — a clinical appointment management system for physiotherapy and psychology practices. UI is entirely in **Spanish**. Built with Next.js 16 App Router, React 19, TypeScript, Supabase, and custom CSS with Tailwind available but not used for component styling.

## Commands

```bash
npm run dev      # Dev server at localhost:3000
npm run build    # Production build
npm run start    # Run production build
npm run lint     # ESLint v9 flat config (core-web-vitals + typescript)
```

No test framework is configured.

## Architecture

### Provider Stack

Root layout (`src/app/layout.tsx`) wraps the app in:
1. `<AuthProvider>` — client context for user/profile/session state
2. `<Providers>` (`src/app/providers.tsx`) — `QueryClientProvider` from TanStack Query (60s staleTime, no refetch on window focus)

### Auth Flow

1. **Middleware** (`src/middleware.ts`) → calls `updateSession()` to refresh Supabase auth cookies on every request
2. **AuthProvider** (`src/lib/auth-context.tsx`) → manages `user`, `profile`, `session` state; listens to `onAuthStateChange`; fetches profile from `profiles` table with 30min caching + deduplication
3. **Admin layout** (`src/app/(admin)/layout.tsx`) → client-side guard: requires `user` + `profile.role` in `['owner', 'professional']`

### Supabase Clients

- **Browser**: `src/lib/supabase/client.ts` — `createBrowserClient()` singleton with custom lock workaround
- **Server**: `src/lib/supabase/server.ts` — `createServerClient()` using `cookies()`
- **Middleware**: `src/lib/supabase/proxy.ts` — `updateSession()` for session refresh

### Data Fetching Pattern

All admin pages are `'use client'` components. Data fetching uses TanStack Query v5 via shared hooks:
- `src/hooks/useCitas.ts` — appointments (useQuery + useMutation)
- `src/hooks/usePacientes.ts` — patients
- `src/hooks/useProfesionales.ts` — professionals
- `src/hooks/useServicios.ts` — services
- `src/hooks/useSettings.ts` — booking settings

These hooks call the Supabase browser client directly. No server actions are used for data fetching.

### Routing

All admin pages live under `src/app/(admin)/` route group:
- `/` — Dashboard (stats, today's appointments, activity chart via recharts)
- `/citas` — Appointments CRUD with status filters, day/week views
- `/pacientes` — Patient records + GDPR consent tracking + clinical records
- `/profesionales` — Therapist/doctor management
- `/servicios` — Service + category catalog
- `/horarios` — Weekly schedule slots + exceptions per professional
- `/configuracion` — Global booking settings (owner only)

Login: `src/app/login/page.tsx` with its own layout.

Single API route: `src/app/api/admin/create-professional/route.ts` (uses SERVICE_ROLE_KEY for admin user creation).

### Feature Component Organization

Larger pages have co-located `components/` and `hooks/` subdirectories:
```
src/app/(admin)/citas/
├── page.tsx
├── components/    # 9 feature components (tables, modals, filters)
└── hooks/         # useCitasDragDrop.ts
src/app/(admin)/pacientes/components/   # 4 components
src/app/(admin)/profesionales/components/  # 3 components
src/app/(admin)/servicios/components/   # 4 components
src/app/(admin)/components/             # 3 dashboard components (Stats, Charts, Agenda)
```

### Key Files

- `src/lib/types.ts` — All TypeScript interfaces (Profile, Patient, Professional, Service, Appointment, ScheduleSlot, BookingSettings, ConsentRecord, ClinicalRecord, etc.) + enums + day-of-week utilities
- `src/lib/schemas.ts` — Zod validation schemas (Patient, ServiceCategory, Service, ProfessionalProfile, Appointment) + `validateData()` helper
- `src/lib/panel-navigation.ts` — Nav items array, role-based visibility checks (`canRenderNavItem`), professional restrictions
- `src/lib/audit.ts` — `logAuditEvent()` for mutation logging
- `src/lib/utils.ts` — Avatar colors, initials, date helpers
- `src/components/Icon.tsx` — Custom SVG icon system with 50+ icons (add new icons to `paths` object)

### Shared UI Components (`src/components/ui/`)

- `Button.tsx` — Variants: primary, secondary, danger, ghost; sizes: sm, md, lg; isLoading spinner
- `Modal.tsx` — Portal-based with maxWidth variants + backdrop
- `Card.tsx`, `Input.tsx`, `Badge.tsx`

Also: `src/components/ConfirmModal.tsx`, `Sidebar.tsx`, `Header.tsx`

### Roles

- `owner` — Full access to all pages
- `professional` — Cannot access: profesionales, servicios, horarios, configuracion
- `client` — Redirected away from admin panel

## Styling

Custom CSS design system — Tailwind is imported in `globals.css` but component styling uses custom classes exclusively.

**Entry point**: `src/app/globals.css` imports 8+ theme files from `src/styles/theme/`:
- `tokens.css` — CSS variables (colors, spacing, typography)
- `base.css` — Resets
- `layout.css` — Page layout classes
- `components.css` — Buttons, forms, modals, badges
- `calendar.css`, `dashboard.css`, `citas.css` — Page-specific styles
- `professional-refresh.css`, `professional-rich.css`

**Design tokens**:
- Brand color: `--canela: #AD7332` (warm cinnamon brown)
- Background: `--bg-base: #F5F3F0` (off-white)
- Dark sidebar: `#1A1714`

**Class naming**: BEM-like (`.sidebar__logo-text`, `.card__header`). Button variants: `.btn--primary`, `.btn--secondary`, `.btn--ghost`. Forms: `.form-input`, `.form-select`. Modals: `.modal` + `.modal-overlay`.

## Key Dependencies

- `@tanstack/react-query` v5 — data fetching + caching
- `react-hook-form` + `@hookform/resolvers` — form state management
- `zod` — schema validation (server + client)
- `recharts` — dashboard charts
- `sonner` — toast notifications
- `date-fns` v4 — date manipulation (use this for all new code)

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL         # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY    # Supabase anon key (safe for browser)
SUPABASE_SERVICE_ROLE_KEY        # Server-only admin key (NEVER expose)
```

## Build Config Notes

- **React Compiler** enabled in `next.config.ts` (`reactCompiler: true`)
- **ESLint**: `react-hooks/set-state-in-effect` disabled due to React Compiler false positive ([facebook/react#34905](https://github.com/facebook/react/issues/34905))
- **Path alias**: `@/*` maps to `./src/*`
- **TypeScript**: `strict: true`, target `ES2017`

## Known Technical Debt

- `useProfesionales` hook calls `auth.admin.createUser()` from browser (requires SERVICE_ROLE_KEY, always fails) — should use `/api/admin/create-professional` route instead
- `day_of_week` values inconsistent between horarios page (0-4) and profesionales page (1-5)
- Patient deletion uses 4 separate non-transactional operations

## Conventions

- All UI text in **Spanish**
- Commit format: `feat:`, `fix:`, `chore:`, `refactor:`
- Modal pattern: state triplet (`showModal` + `formData` + `saving`), overlay + `.modal` container
- New pages: create `src/app/(admin)/[feature]/page.tsx` with `'use client'` directive
- New icons: add SVG path to `paths` object in `src/components/Icon.tsx`
- Feature components: co-locate in `src/app/(admin)/[feature]/components/`
- Reusable UI: place in `src/components/ui/`
- Data hooks: create in `src/hooks/` using TanStack Query pattern from existing hooks
- Validation: add Zod schemas to `src/lib/schemas.ts`
