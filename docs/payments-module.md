# Módulo de Facturación — Fase 1 (Caja + Recibos internos)

> Estado: implementado, pendiente de aplicar migración y probar en producción.
> Fecha: 2026-05-20.

## Alcance

Registro de cobros presenciales en la clínica + generación de recibos PDF internos. **No** es facturación legal con AEAT/Verifactu. Si el paciente pide factura formal, se hará en Fase 2 (ver `plans/que-podriamos-hacer-para-quizzical-perlis.md`).

### Decisiones fijas
- Cobro **solo presencial**: efectivo, tarjeta (TPV físico), Bizum manual, transferencia. Sin pagos online.
- Sin bonos / paquetes de sesiones.
- El recibo PDF lleva la leyenda *"Este documento es un recibo interno emitido por la clínica. NO tiene validez como factura a efectos fiscales"* (Art. 6 RD 1619/2012).

## Modelo de datos

Migración: `supabase/migrations/20260520120000_payments_module.sql`.

### Tabla `payments`
| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | |
| `appointment_id` | `uuid` FK → `appointments.id` | `ON DELETE CASCADE` |
| `patient_id` | `uuid` FK → `patients.id` | Copiado de la cita al crear |
| `amount` | `numeric(10,2)` | `> 0` y `≤ 99 999` |
| `method` | `payment_method` enum | `cash` / `card` / `bizum` / `transfer` / `other` |
| `paid_at` | `timestamptz` | Default `now()` |
| `notes` | `text` | Opcional, máx 500 caracteres validados en Zod |
| `receipt_number` | `text` UNIQUE | Default `next_receipt_number()` → `R-2026-0001` |
| `created_by` | `uuid` FK → `auth.users.id` | Usuario que registró el cobro |
| `created_at` | `timestamptz` | |

### Funciones auxiliares
- `receipt_seq` — `sequence` para correlativo anual.
- `next_receipt_number()` — devuelve `R-YYYY-NNNN`.

### RLS (defensa en profundidad)
- `SELECT` y `INSERT`: usuarios con `profiles.role IN ('owner', 'professional')`.
- `DELETE`: solo `owner`.
- **No UPDATE**: para mantener auditoría limpia se borra y se crea uno nuevo.

> El gating real se hace en la API con `requirePanelAccess` + `ensurePatientAccess`. RLS es defensa adicional.

## Endpoints

Todos bajo `/api/admin/payments/`. Auth: `requirePanelAccess()` (cookie-based, igual que el resto del panel).

### `GET /api/admin/payments`
Lista cobros con filtros. Query params:
- `from`, `to` — ISO datetime
- `method` — uno de los valores del enum
- `appointment_id`, `patient_id` — UUID

Profesional: filtra automáticamente por `appointment.professional_id == su_id`.

### `POST /api/admin/payments`
Body Zod:
```json
{
  "appointment_id": "uuid",
  "amount": 40,
  "method": "cash",
  "paid_at": "2026-05-20T10:30:00.000Z",
  "notes": "opcional"
}
```
Validaciones:
- Cita existe y tiene `patient_id`.
- Usuario tiene acceso al paciente (`ensurePatientAccess`).

Side effects:
- Genera `receipt_number` automáticamente.
- Escribe en `audit_logs` (`action: CREATE`).

### `DELETE /api/admin/payments/[id]`
**Solo `owner`**. Borra cobro + audit log (`action: DELETE` con receipt_number/amount).

### `GET /api/admin/payments/receipt/[id]`
Devuelve PDF inline. Audit log `action: VIEW` con `kind: receipt_pdf`.

### `GET /api/admin/payments/export?from=&to=`
Devuelve CSV (con BOM UTF-8 para Excel) con cabeceras:
`Recibo, Fecha cobro, Importe, Método, Paciente, DNI/NIF, Servicio, Fecha cita, Notas`.

Filename: `cobros-YYYY-MM-DD.csv`.

## PDF del recibo

Archivo: `src/lib/receipt-pdf.ts`. Función: `renderReceiptPdf(input: ReceiptInput): Promise<Uint8Array>`.

### Bloques visuales
1. **Cabecera**: nombre clínica + dirección/NIF/contacto (izquierda); `RECIBO Nº R-YYYY-NNNN` + fecha (derecha).
2. **Datos del paciente**: nombre, DNI/NIF, dirección.
3. **Concepto**: servicio + fecha de la cita.
4. **Pago**: método + notas + caja resaltada con TOTAL en €.
5. **Pie legal**: leyenda de no validez fiscal.

### Por qué PDF programático y no AcroForm
Conocemos por `docs/patient-document-pdf.md` que `form.flatten()` de pdf-lib corrompe plantillas. El recibo lo dibujamos con `PDFDocument.create()` + `page.drawText` para evitar ese camino y mantener consistencia tipográfica.

## UI del panel

Ruta: `/facturacion`. Acceso: `ownerOnly: true` (en `panel-navigation.ts`).

### Componentes
- `src/app/(admin)/facturacion/page.tsx` — orquestador.
- `components/FacturacionHeader.tsx` — KPIs (caja hoy / semana / mes / # cobros) + botones Registrar/Exportar.
- `components/CajaTable.tsx` — tabla con descarga recibo + anular cobro.
- `components/PaymentModal.tsx` — formulario: selector de cita (últimos 30 días + 7 futuros), importe (autorelleno desde precio del servicio), método, notas.

### Hook
`src/hooks/usePayments.ts` — TanStack Query:
- `usePayments(filters)`
- `useCreatePayment()`
- `useDeletePayment()`
- `getReceiptDownloadUrl(id)`
- `getPaymentsExportUrl(filters)`

Invalida `['payments']` y `['citas']` tras mutaciones.

## Auditoría

Toda operación deja entrada en `audit_logs`:
- `CREATE` con `{ appointment_id, amount, method }`.
- `DELETE` con `{ receipt_number, amount, appointment_id }`.
- `VIEW` (descarga PDF) con `{ kind: 'receipt_pdf', receipt_number }`.

## Tests

### Unit (vitest)
- `src/lib/schemas.test.ts` — 8 tests de `PaymentSchema` (válido, coerción, límites, errores).
- `src/lib/receipt-pdf.test.ts` — 5 tests de `renderReceiptPdf` (PDF válido, metadata, métodos, decimales).

### E2E (Playwright)
- `e2e/facturacion.spec.ts` — 3 tests: carga de página, modal de cobro, filtros.

Requiere `PANEL_E2E_EMAIL` y `PANEL_E2E_PASSWORD` (igual que el resto de E2E del panel).

## Deploy checklist

1. Aplicar migración en Supabase remoto.
2. Verificar que existe `audit_logs` y que `profiles` tiene la columna `role` (ya existe).
3. Commit + push a `panel-deploy-branch`.
4. Smoke en producción: registrar un cobro de prueba, descargar PDF, exportar CSV, anular.

## Integración con citas

`AppointmentDetailPanel` (panel lateral al pulsar una cita) muestra:
- Fila **Cobro**: si ya hay pago → badge verde con importe, método y nº de recibo. Si no → badge "Pendiente" (o "No aplica" si la cita está cancelada).
- Botón **Registrar cobro** (si no hay pago y la cita no está cancelada) — abre el `PaymentModal` con `appointment_id` y `defaultAmount` precargados desde el precio del servicio.
- Botón **Descargar recibo** (si ya hay pago).

El `PaymentModal` es el mismo componente que en `/facturacion`, parametrizado con `appointmentId` para bloquear el selector de cita.

## Fuera de alcance (Fase 2 o más tarde)

- Facturas legales (numeración serie, NIF obligatorio, rectificativas).
- Verifactu / firma AEAT.
- Pagos online (Stripe, Redsys, Bizum desde portal).
- Bonos / paquetes de sesiones.
- Integración con asesoría externa (CSV ya cubre 80% del caso).
- Badge `payment_status` en la fila de la `CitasTable` (actualmente solo en el detalle).
