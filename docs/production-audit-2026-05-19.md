# Audit de producción — Panel Zeus (2026-05-19)

Auditoría completa pre-deploy: build, tipos, performance e i18n.

---

## Resultado general: APTO PARA DEPLOY

| Check | Estado |
|---|---|
| Build producción | ✅ LIMPIO (3.6s, 33 rutas) |
| TypeScript | ✅ 0 errores |
| ESLint | ⚠️ 2 warnings (no bloquean) |
| Mojibake | ✅ Ninguno |
| Fechas locale | ✅ `es-ES` consistente |

---

## 1. Build & Tipos

### Warnings de lint (no bloquean deploy)

**`src/lib/auth-context.tsx:214`** — `react-hooks/exhaustive-deps`
```
useCallback (fetchProfile) missing deps: 'clearCachedProfile', 'readCachedProfile'
```
Ambas son `useCallback([], [])` — estables en práctica. ESLint no puede verificarlo estáticamente. Fix: añadir al dep array o suprimir con comentario justificado.

**`gen_fresh_renders.mjs`** — variable sin usar. Script de dev, no va a producción.

### Archivos que superan límites

| Archivo | Líneas | Acción |
|---|---|---|
| `citas/components/CitasTimeline.tsx` | **827** | ❌ Supera 800 — refactor pendiente |
| `citas/page.tsx` | 536 | ⚠️ Vigilar |
| `pacientes/components/PatientDetailsPanel.tsx` | 523 | ⚠️ Vigilar |
| `analitica/page.tsx` | 472 | Vigilar |
| `horarios/page.tsx` | 447 | Vigilar |

---

## 2. Performance

### Fixes aplicados

**[HIGH] DashboardCharts cargado con `dynamic()` — `page.tsx`**

Recharts estaba importado estáticamente, añadiendo 388 KB al bundle inicial del dashboard.

```typescript
// ANTES
import { DashboardCharts } from './components/DashboardCharts';

// DESPUÉS
const DashboardCharts = dynamic(
  () => import('./components/DashboardCharts').then(m => ({ default: m.DashboardCharts })),
  { ssr: false }
);
```

**[MEDIUM] Promise.all en analytics route — `api/admin/analytics/route.ts`**

`profData` y `prosCount` se lanzaban secuencialmente después de procesar `allApts` en memoria. Ahora se lanzan en paralelo justo después de que `allApts` resuelve, mientras el CPU procesa los bucles.

```typescript
// Lanzar en paralelo
const profDataPromise = supabase.from('professionals').select('id, profile:profiles(full_name)').eq('is_active', true);
const prosCountPromise = supabase.from('professionals').select('id', { count: 'exact', head: true }).eq('is_active', true);

// ... CPU processing loops ...

// Esperar ambos
const [{ data: profData }, { count: prosCount }] = await Promise.all([profDataPromise, prosCountPromise]);
```

### Pendientes de performance (no aplicados)

- **Recharts en `/analitica`** — también estático. Menos crítico (ruta dedicada a analytics), pero candidato a `dynamic()`.
- **Sin virtualización** — `PacientesTable` y `CitasTimeline` renderizan DOM completo. Con >200 items, añadir `@tanstack/virtual`.
- **AuthContext value sin `useMemo`** — objeto inline se recrea en cada render; React Compiler activo mitiga esto.

### Nota: React Compiler activo

`next.config.ts` tiene `reactCompiler: true`. Gestiona memo/useMemo/useCallback automáticamente — ausencia de memoización explícita en componentes es esperada y correcta.

---

## 3. I18N / Localización

### Fixes aplicados

**[LOW] Formato moneda inconsistente — `DashboardStats.tsx:120`**

```typescript
// ANTES — manual, inconsistente con analitica/page.tsx
`€${globalStats.estimatedRevenue.toLocaleString('es-ES', { minimumFractionDigits: 0 })}`

// DESPUÉS — Intl nativo, consistente
globalStats.estimatedRevenue.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
```

### Sin problemas

- **Mojibake** — búsqueda de `Ã±`, `Ã³`, `â€`, `Ã¡`, `Â¿` en todo `/src`: 0 resultados.
- **Fechas** — `toLocaleDateString/toLocaleTimeString` usa `'es-ES'` en todos los puntos de display.
- **`'en-GB'` en analytics route** — es aritmética interna de timezone (parseo numérico de hora), no display al usuario. Correcto.
- **`DAY_NAMES` capitalizados** (`types.ts:227`) — son cabeceras de tabla de horario, no output de `toLocaleDateString`. Capitalización correcta para headers.

### Observaciones

- **`AppointmentExceptionModal.tsx:106,114`** — "Hora Inicio" / "Hora Fin" en title case vs. sentence case del resto de labels. Cosmético.
- **Sin framework i18n** — strings hardcodeados en español. Aceptable para app mono-idioma.

---

## Bundle chunks relevantes (gzipped)

| Chunk | Tamaño raw | Contenido |
|---|---|---|
| `1418-*.js` | 388 KB | recharts (ahora lazy en dashboard) |
| `9826-*.js` | 220 KB | |
| `4bd1b696-*.js` | 196 KB | |
| `framework-*.js` | 188 KB | React/Next.js |

---

## Resumen de cambios aplicados

| Archivo | Cambio |
|---|---|
| `src/app/(admin)/page.tsx` | `DashboardCharts` → `dynamic()`, corregido orden imports |
| `src/app/api/admin/analytics/route.ts` | `profData` + `prosCount` en `Promise.all` |
| `src/app/(admin)/components/DashboardStats.tsx` | Moneda con `style: 'currency'` |
