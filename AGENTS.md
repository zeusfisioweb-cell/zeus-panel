# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

Zeus Admin Panel — a clinical appointment management system for physiotherapy and psychology practices. UI is entirely in Spanish. Built with Next.js 16 App Router, React 19, TypeScript, Supabase, and custom CSS (no Tailwind, no shadcn/ui).

## Commands

```bash
npm run dev      # Dev server at localhost:3000
npm run build    # Production build (TS errors currently ignored via ignoreBuildErrors)
npm run start    # Run production build
npm run lint     # ESLint (eslint-config-next + React Compiler rules)
```

No test framework is configured.

## Architecture

### Auth Flow
1. **Middleware** (`src/middleware.ts`) → calls `updateSession()` to refresh Supabase auth cookies on every request
2. **Root layout** (`src/app/layout.tsx`) → wraps app in `<AuthProvider>` (client context)
3. **AuthProvider** (`src/lib/auth-context.tsx`) → manages `user`, `profile`, `session` state; listens to `onAuthStateChange`; fetches profile from `profiles` table
4. **Admin layout** (`src/app/(admin)/layout.tsx`) → client-side guard: requires `user` + `profile.role` in `['owner', 'professional']`; renders Sidebar + Header + content

### Supabase Clients
- **Browser**: `src/lib/supabase/client.ts` — `createBrowserClient()` with custom lock workaround for dev
- **Server**: `src/lib/supabase/server.ts` — `createServerClient()` using `cookies()`
- **Middleware proxy**: `src/lib/supabase/proxy.ts` — session refresh in middleware

### Data Fetching Pattern
All admin pages are `'use client'` components that fetch data via `createClient()` (browser client) inside `useCallback` + `useEffect`. No server actions are currently used for data fetching.

### Routing
All admin pages live under `src/app/(admin)/` route group:
- `/` — Dashboard (stats, today's appointments, activity chart)
- `/citas` — Appointments CRUD with status filters
- `/calendario` — Calendar view (react-big-calendar)
- `/pacientes` — Patient records + GDPR consent tracking
- `/profesionales` — Therapist/doctor management
- `/servicios` — Service/treatment catalog
- `/horarios` — Weekly schedule slots + exceptions per professional
- `/configuracion` — Global booking settings (owner only)
- `/legal` — GDPR compliance dashboard

Login lives at `src/app/login/page.tsx` with its own layout.

Single API route: `src/app/api/admin/create-professional/route.ts` (uses SERVICE_ROLE_KEY).

### Key Files
- `src/lib/types.ts` — All TypeScript interfaces and type unions (Profile, Patient, Professional, Service, Appointment, ClinicalRecord, ScheduleSlot, BookingSettings, ConsentRecord, etc.)
- `src/components/Icon.tsx` — Custom SVG icon system with 50+ icons
- `src/components/Sidebar.tsx` — Left nav, collapsible, role-aware visibility
- `src/components/Header.tsx` — Top bar with greeting
- `src/app/globals.css` — Entire design system: CSS variables, component classes, layout

### Roles
- `owner` — Full access to all pages
- `professional` — Cannot access configuracion; limited writes
- `client` — Redirected away from admin panel

## Styling

Custom CSS only — no Tailwind, no component library. Design tokens defined as CSS variables in `globals.css`:
- Brand color: `--canela: #AD7332` (warm cinnamon brown)
- Background: `--bg-base: #F5F3F0` (off-white)
- Dark sidebar: `#1A1714`
- BEM-like class naming: `.sidebar__logo-text`, `.card__header`
- Button variants: `.btn--primary`, `.btn--secondary`, `.btn--ghost`
- Form elements: `.form-input`, `.form-select`, `.form-label`
- Modals: `.modal` + `.modal-overlay`

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL         # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY    # Supabase anon key (safe for browser)
SUPABASE_SERVICE_ROLE_KEY        # Server-only admin key (NEVER expose)
```

## Build Config Notes

- **React Compiler** enabled in `next.config.ts` (`reactCompiler: true`)
- **`ignoreBuildErrors: true`** for TypeScript — technical debt, should be removed
- **ESLint**: `react-hooks/set-state-in-effect` disabled due to React Compiler false positive (facebook/react#34905)
- **Dual date libraries**: both `moment` and `date-fns` are installed; prefer `date-fns` for new code

## Conventions

- All UI text is in **Spanish**
- Commit format: `feat:`, `fix:`, `chore:`, `refactor:`
- Modal pattern: state triplet `showModal` + `formData` + `saving`, overlay + `.modal` container
- New pages: create `src/app/(admin)/[feature]/page.tsx` with `'use client'` directive
- New icons: add SVG path to the `paths` object in `src/components/Icon.tsx`
