# Zeus Panel — Bugs, Limitaciones y Deuda Técnica

> Auditoría completa del código. Fecha: 2026-03-07

---

## BUGS CONFIRMADOS

### BUG-001: Creación de profesional hace signUp y cierra la sesión del owner

**Archivo:** `src/app/(admin)/profesionales/page.tsx:154`
**Severidad:** CRÍTICA

```tsx
const { data: authData, error: authError } = await supabase.auth.signUp({
    email: data.email,
    password: tempPassword,
    ...
});
```

`supabase.auth.signUp()` desde el browser client **puede cerrar la sesión actual del owner** porque Supabase cambia el usuario activo al nuevo usuario creado. Existe una API route dedicada en `src/app/api/admin/create-professional/route.ts` que usa `SERVICE_ROLE_KEY` correctamente, pero **la página no la usa** — hace signUp directamente desde el cliente.

**Impacto:** El owner pierde su sesión al crear un profesional. El panel se redirige a login.

---

### BUG-002: `createClient()` en module scope — instancia compartida entre renders

**Archivos:** `src/app/(admin)/page.tsx:19`, `src/app/(admin)/pacientes/page.tsx:16`, `src/app/(admin)/profesionales/page.tsx:15`, `src/app/(admin)/servicios/page.tsx:21`, `src/app/(admin)/horarios/page.tsx:8`, `src/app/(admin)/configuracion/page.tsx:9`, `src/components/Sidebar.tsx:10`, `src/hooks/useSettings.ts:5`
**Severidad:** MEDIA

```tsx
const supabase = createClient(); // FUERA del componente
```

El cliente Supabase se crea a nivel de módulo. Si bien `createBrowserClient` de `@supabase/ssr` internamente usa un singleton, esta práctica es inconsistente: algunos hooks lo crean dentro de la función (correcto), mientras que estas páginas lo crean fuera. En SSR/edge, compartir instancias entre requests puede causar fugas de estado.

---

### BUG-003: Horarios — `day_of_week` inconsistente entre páginas

**Archivos:** `src/app/(admin)/horarios/page.tsx:115` vs `src/app/(admin)/profesionales/page.tsx:41`
**Severidad:** ALTA

En `horarios/page.tsx`, el horario por defecto usa días **0-4** (Lunes=0):
```tsx
for (let day = 0; day <= 4; day++) {
    defaultSlots.push(
        { ..., day_of_week: day, start_time: '09:30', end_time: '14:00' },
```

En `profesionales/page.tsx`, el horario por defecto usa días **1-5** (Lunes=1):
```tsx
[1, 2, 3, 4, 5, 6, 0].forEach(day => {
    defaultMap[day] = {
        active: day >= 1 && day <= 5,
```

Y `DAY_NAMES` en `types.ts` mapea índice 0 = "Lunes". **No hay convención clara** de si 0=Lunes o 0=Domingo. Esto causa que los horarios se asignen a días equivocados según desde qué página se creen.

---

### BUG-004: Eliminación de paciente — cascade manual incompleta

**Archivo:** `src/app/(admin)/pacientes/page.tsx:103-108`
**Severidad:** MEDIA

```tsx
await supabase.from('clinical_records').delete().eq('patient_id', id);
await supabase.from('consent_records').delete().eq('patient_id', id);
await supabase.from('appointments').update({ patient_id: null }).eq('patient_id', id);
await deletePaciente.mutateAsync(id);
```

La cascada se ejecuta en 4 operaciones separadas sin transacción. Si falla la 2ª o 3ª, queda en estado inconsistente: registros clínicos eliminados pero el paciente sigue existiendo. Esto debería ser un RPC/función en Supabase o al menos usar una transacción.

---

### BUG-005: `useCreateProfesional` hook llama `auth.admin.createUser` desde el browser

**Archivo:** `src/hooks/useProfesionales.ts:55`
**Severidad:** ALTA

```tsx
const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: payload.profile.email,
    password: payload.profile.password,
    email_confirm: true
});
```

`auth.admin.createUser()` requiere `SERVICE_ROLE_KEY`. Desde el browser client con `ANON_KEY`, esta llamada **siempre falla** con error de permisos. El hook está roto y no se puede usar.

---

### BUG-006: Doble lógica de creación de profesionales (hook vs page)

**Archivos:** `src/hooks/useProfesionales.ts:48-93` y `src/app/(admin)/profesionales/page.tsx:145-218`
**Severidad:** MEDIA

La página `profesionales` no usa `useCreateProfesional()` para la creación real — tiene su propia lógica inline con `supabase.auth.signUp()`. El hook `useCreateProfesional` usa `auth.admin.createUser` que no funciona desde el browser. Son dos implementaciones contradictorias.

---

### BUG-007: `useCancelCita` usa `any` type explícitamente

**Archivo:** `src/hooks/useCitas.ts:132`
**Severidad:** BAJA

```tsx
const updateData: any = { status: 'cancelled' };
```

Viola TypeScript strict mode y las convenciones del proyecto.

---

### BUG-008: Horarios — `confirm()` nativo bloqueante

**Archivo:** `src/app/(admin)/horarios/page.tsx:110`
**Severidad:** BAJA

```tsx
if (!confirm('¿Aplicar horario por defecto...?')) return;
```

Usa `window.confirm()` nativo en vez del `ConfirmModal` que usan el resto de páginas. Inconsistente con el patrón del proyecto y bloquea el hilo principal.

---

### BUG-009: Drag image no se limpia en caso de error

**Archivo:** `src/app/(admin)/citas/page.tsx:286-292`
**Severidad:** BAJA

```tsx
document.body.appendChild(el);
e.dataTransfer.setDragImage(el, 20, 20);
setTimeout(() => document.body.removeChild(el), 0);
```

Si `setDragImage` lanza error, el `setTimeout` no se ejecuta y el elemento clonado queda en el DOM. Debería usar `finally`.

---

### BUG-010: Dashboard `weekStart` calcula relativo a `today` pero usa `dateRange.start`

**Archivo:** `src/app/(admin)/page.tsx:44`
**Severidad:** MEDIA

```tsx
const weekStart = new Date(dateRange.start);
weekStart.setDate(today.getDate() - today.getDay() + 1); // ← usa `today`, no `dateRange.start`
```

Mezcla `today.getDate()` con `dateRange.start`. Cuando el usuario navega a una fecha que no es hoy, `weekCount` calcula la semana relativa a hoy, no a la fecha seleccionada.

---

### BUG-011: Sidebar excluye sección "Gestión" para profesionales incorrectamente

**Archivo:** `src/components/Sidebar.tsx:78`
**Severidad:** BAJA

```tsx
if ('section' in item && item.section === 'Gestión') return null;
```

Oculta la sección **completa** "Gestión" para profesionales, pero `/pacientes` debería ser accesible para profesionales (no está en `restrictedPaths` del layout). El profesional no ve el enlace a pacientes en el sidebar.

---

### BUG-012: Configuración — texto duplicado "inicio inicio"

**Archivo:** `src/app/(admin)/configuracion/page.tsx:193`
**Severidad:** BAJA (cosmético)

```tsx
<span>Hora de inicio inicio de agenda</span>
```

Texto duplicado: "inicio inicio".

---

## LIMITACIONES DE ARQUITECTURA

### LIM-001: Todo el data fetching es client-side

Todas las páginas admin son `'use client'` y fetch desde el browser. Esto significa:
- **Sin SSR/SSG**: Cada visita carga un spinner antes de mostrar datos
- **Exposición de queries**: Las queries Supabase son visibles en Network tab
- **Sin cache entre usuarios**: Cada usuario ejecuta las mismas queries
- **Bundle más grande**: Todo el código de fetching se envía al browser

**Recomendación:** Migrar a Server Components con Server Actions para mutaciones.

---

### LIM-002: Sin validación de inputs (zod)

No existe validación ni en cliente ni en servidor. Los datos de formularios van directamente a Supabase:
- Sin validación de email format
- Sin validación de teléfono
- Sin límites de longitud en campos de texto (bio, notes, etc.)
- Sin sanitización contra XSS en campos como `notes`, `reason`, `bio`
- Precios y duraciones aceptan cualquier número (negativos incluidos)

**Impacto:** Datos inválidos en la base de datos. Potencial XSS si RLS no filtra correctamente.

---

### LIM-003: Sin Error Boundaries

No hay `error.tsx` ni componentes Error Boundary en ninguna ruta. Un error de JavaScript en cualquier componente hace crash de toda la página sin fallback.

---

### LIM-004: Sin tests

No hay framework de tests configurado (ni Vitest, ni Jest, ni Playwright). Zero coverage.

---

### LIM-005: Sin RBAC en el backend / RLS insuficiente

La autorización de roles se hace **solo en el cliente** (useEffect + render guards en `layout.tsx`). Un usuario con rol `professional` puede:
1. Abrir DevTools y llamar directamente a Supabase con su token
2. Acceder a datos de otros profesionales si RLS no está configurado por `professional_id`

Las queries de pacientes (`usePacientes`) hacen `select('*')` sin filtro de profesional — **todos los profesionales ven todos los pacientes**.

---

### LIM-006: Sin paginación

Todas las queries cargan **todos los registros** (`select('*')`):
- `usePacientes`: Carga TODOS los pacientes
- `useServicios`: Carga TODOS los servicios
- `useCitas`: Carga todas las citas del rango (puede ser un mes completo)
- `useProfesionales`: Carga todos los profesionales

En una clínica con 5000+ pacientes, esto será un problema de rendimiento serio.

---

### LIM-007: Sin rate limiting ni protección de login

La página de login no tiene:
- Rate limiting para intentos fallidos
- CAPTCHA
- Bloqueo temporal después de N intentos

Supabase tiene protección básica de auth, pero no hay protección adicional en el frontend.

---

### LIM-008: Sin headers de seguridad

`next.config.ts` no configura headers de seguridad:
```ts
const nextConfig: NextConfig = {
  reactCompiler: true,
  // Falta: headers() con CSP, HSTS, X-Frame-Options, X-Content-Type-Options
};
```

---

### LIM-009: `ignoreBuildErrors` activo (deuda técnica)

CLAUDE.md menciona `ignoreBuildErrors: true` en el config, pero el `next.config.ts` actual **no lo tiene**. Esto sugiere que o se quitó recientemente (bien) o se referencia en una config que no leí. Verificar con `npm run build` si realmente compila sin errores.

---

### LIM-010: Dependencias no utilizadas

| Paquete | Estado |
|---------|--------|
| `tailwindcss` (devDep) | Instalado. El CSS lo importa (`@import "tailwindcss"` en globals.css) pero el proyecto usa CSS custom como sistema principal. Genera conflicto de estilos. |
| `react-big-calendar` | Instalado + `@types/react-big-calendar`. No se usa en ninguna página actual (se reemplazó por calendario custom). |
| `framer-motion` | Instalado. Verificar si realmente se usa en algún componente. |

---

### LIM-011: Real-time solo en dashboard

Solo `src/app/(admin)/page.tsx` tiene subscripción real-time de Supabase. Las demás páginas (citas, pacientes, servicios, horarios) no se actualizan automáticamente cuando otro usuario hace cambios. Esto puede causar que dos usuarios vean estados distintos.

---

### LIM-012: Sin audit logging / GDPR compliance

Para un sistema clínico con datos de pacientes:
- No hay registro de quién accedió a qué datos
- No hay log de modificaciones de fichas clínicas
- No hay exportación de datos del paciente (derecho GDPR)
- No hay soft-delete para pacientes (se eliminan permanentemente)
- `consent_records` se eliminan al borrar paciente (pierde evidencia de consentimiento)

---

### LIM-013: Fichas clínicas sin firma digital

Los registros clínicos (`clinical_records`) se crean con `professional_id: user?.id` pero sin verificación de que el `user.id` corresponde realmente a un profesional activo. No hay firma digital ni timestamp verificable.

---

### LIM-014: Timezone handling ausente

Todas las fechas se manejan con `new Date()` del browser (timezone local) y se envían como ISO strings. No hay configuración de timezone de la clínica. Si un usuario accede desde otro huso horario, las horas de las citas se muestran incorrectamente.

---

## PROBLEMAS DE RENDIMIENTO

### PERF-001: Dashboard hace 7 queries en paralelo

**Archivo:** `src/app/(admin)/page.tsx:106-118`

Cada visita al dashboard dispara 7 queries a Supabase. Podrían consolidarse en un RPC/view del lado servidor.

---

### PERF-002: Mini calendario recalcula todo el mes en cada render

**Archivo:** `src/app/(admin)/citas/page.tsx:126-137`

`aptsByDay` itera sobre TODAS las citas del rango mensual en cada render para contar cuántas hay por día.

---

### PERF-003: Sidebar polling cada 60 segundos

**Archivo:** `src/components/Sidebar.tsx:38-42`

```tsx
const interval = setInterval(loadPending, 60_000);
```

Query innecesaria cada minuto. Debería usar real-time subscription o invalidar desde las mutaciones de citas.

---

### PERF-004: `console.log` de performance en producción

**Archivo:** `src/app/(admin)/page.tsx:105,119`

```tsx
console.log('Fetching dashboard data...');
console.log(`Dashboard data fetched in ${performance.now() - startTimeMs}ms`);
```

Métricas de debug que no deberían estar en producción.

---

## PROBLEMAS DE TIPO / TYPESCRIPT

### TS-001: Uso de `any` en varios puntos

| Archivo | Línea | Código |
|---------|-------|--------|
| `hooks/useCitas.ts` | 48 | `data.map((apt: any) => ...)` |
| `hooks/useCitas.ts` | 132 | `const updateData: any = { status: 'cancelled' }` |
| `hooks/useCitas.ts` | 206 | `async (newException: any) =>` |
| `hooks/useProfesionales.ts` | 53 | `async (payload: { profile: any, professional: any })` |
| `hooks/useProfesionales.ts` | 100 | `{ id: string, profile?: any }` |
| `servicios/page.tsx` | 58 | `createService.mutateAsync(data as any)` |
| `pacientes/page.tsx` | 75,93,115,135,155 | `catch (error: any)` |
| `profesionales/page.tsx` | 145,221 | `async (data: any, scheduleMap: ScheduleMap)` |

---

### TS-002: Type assertions sin validación

```tsx
// Múltiples archivos
setPatientAppointments(appointmentsRes.data as Appointment[] || []);
setClinicalRecords(recordsRes.data as unknown as ClinicalRecord[] || []);
setProfessionals((data as unknown as ProfessionalOption[]) || []);
```

Fuerzan el tipo sin verificar la estructura real de los datos.

---

## INCONSISTENCIAS DE CÓDIGO

### INC-001: Patrón mixto de data fetching

- **Dashboard, Horarios, Configuración**: `useCallback` + `useEffect` + Supabase directo
- **Citas, Pacientes, Profesionales, Servicios**: React Query hooks (`useCitas`, `usePacientes`, etc.)

Dos patrones distintos para el mismo propósito.

---

### INC-002: Modales — patrón inconsistente

- **Pacientes/Profesionales/Servicios**: Componentes `FormModal` separados
- **Configuración**: Form inline sin modal
- **Horarios**: Forms inline directamente en la página

---

### INC-003: Manejo de errores inconsistente

- Algunas páginas: `toast.error('Error: ' + error.message)` (muestra el mensaje raw)
- Otras: `toast.error('Error al crear la cita')` (mensaje genérico)
- Algunas: re-throw (`throw error`) después del toast
- Otras: solo toast sin re-throw

---

### INC-004: Estilos mixtos

- Custom CSS classes: `.card`, `.btn--primary`, `.form-input`
- Tailwind utilities: `flex`, `gap-2.5`, `p-7`, `grid-cols-1`
- Inline styles: `style={{ padding: '32px 24px', display: 'flex' }}`

Tres sistemas de estilos coexistiendo sin regla clara.

---

## RESUMEN DE PRIORIDADES

| Prioridad | ID | Descripción |
|-----------|----|-------------|
| **CRÍTICA** | BUG-001 | signUp cierra sesión del owner |
| **CRÍTICA** | BUG-005 | Hook `useCreateProfesional` usa admin API desde browser (roto) |
| **ALTA** | BUG-003 | `day_of_week` inconsistente entre páginas |
| **ALTA** | LIM-002 | Sin validación de inputs |
| **ALTA** | LIM-005 | RBAC solo en cliente, sin protección backend real |
| **MEDIA** | BUG-004 | Cascade manual sin transacción |
| **MEDIA** | BUG-010 | Dashboard weekStart usa `today` en vez de `dateRange` |
| **MEDIA** | LIM-001 | Todo client-side fetching |
| **MEDIA** | LIM-006 | Sin paginación |
| **MEDIA** | LIM-012 | Sin audit logging para datos clínicos |
| **MEDIA** | LIM-014 | Sin manejo de timezone |
| **BAJA** | BUG-008, BUG-012 | UX: confirm nativo, texto duplicado |
| **BAJA** | LIM-010 | Dependencias no usadas |
| **BAJA** | PERF-004 | console.log en producción |
