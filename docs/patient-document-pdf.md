# Generación de PDFs de documentos del paciente

Documentación completa del pipeline de PDFs clínico-legales (Historia clínica
fisioterapéutica, Consentimiento intervención, Consentimiento LOPD/RGPD) y de
los dos bugs corregidos el 2026-05-18.

---

## 1. Arquitectura

### Archivos

| Archivo | Rol |
|---|---|
| `public/consentimientos/*_original.pdf` | PDF legal original (con datos de muestra). Fuente de verdad. |
| `public/consentimientos/*_template.pdf` | Plantilla rellenable generada (datos de muestra eliminados + AcroForm). |
| `scripts/build-pdf-templates.ts` | Construye los `*_template.pdf` desde los `*_original.pdf`. Ejecución manual. |
| `src/lib/patient-document-templates.ts` | Coordenadas de slots, fuentes de cada campo, anclas de historia. |
| `src/lib/patient-document-definitions.ts` | Definición de campos por tipo de documento, `templateFileName`. |
| `src/lib/patient-document-pdf.ts` | Render en runtime: carga plantilla, rellena campos, devuelve bytes. |
| `src/app/api/admin/patient-documents/render/route.ts` | Endpoint POST. Auth + booking_settings + llama al render. |
| `src/app/(admin)/pacientes/components/document-fields.ts` | `printDocument()`: fetch al endpoint, abre blob en pestaña. |

### Flujo

1. Admin abre un documento en el modal y pulsa **"Generar PDF base"**.
2. `printDocument()` → `POST /api/admin/patient-documents/render` con
   `document_type`, `patient_name`, `patient_document_id`, `visit_date`,
   `form_data`.
3. El endpoint consulta `booking_settings` (clinic_name, address) y llama a
   `renderPatientDocumentPdf()`.
4. `renderPatientDocumentPdf()` → `fillTemplate()`:
   - Carga el `*_template.pdf`.
   - Por cada campo AcroForm: resuelve su valor, lo escribe, lo deja
     `read-only`.
   - `form.updateFieldAppearances()` (hornea apariencias).
   - **NO** `form.flatten()` (ver §3).
   - `pdfDoc.save()` → bytes.
5. El navegador abre el PDF en una pestaña (`URL.createObjectURL`).

### Construcción de plantillas (`build-pdf-templates.ts`)

Modos:

- **slots** (LOPD, intervención): el documento tiene huecos inline en la prosa
  legal. El script detecta el "sample font" (subconjunto que no decodifica con
  la heurística `+29`), borra esas operaciones de show-text del content stream,
  y añade campos AcroForm de texto en las coordenadas exactas del hueco
  (`TemplateSlot`: `x0,x1,baseline,sampleSize`).
- **historia** (clinical_history): layout label/valor que fluye. Detecta líneas
  estáticas vs valores por geometría (tamaño de fuente, sangrado, headers/
  footers), borra los valores de muestra, y crea campos inline o de bloque
  (multilínea) anclados al texto estático normalizado.

Resolución de valores (`resolveFieldValue`):

- `config`: `clinic_name`/`address`/`city` desde `booking_settings`.
- `date`: `dia`/`mes`/`anio` desde `documentIso()` (form `fecha_consentimiento`
  → `visit_date` → hoy). `dateParts(null)` siempre devuelve la fecha de hoy.
- `patient`: `name_first`/`name_rest`/`document_id` partiendo `patientName`.
- `form`: valor directo de `form_data`. Fallback: `nombre_firmante` →
  `patientName`, `dni_firmante` → `patientDocumentId`.

---

## 2. Bug 1 — Letras superpuestas (fuente fija)

**Síntoma:** valores largos (nombre clínica, dirección, nombre completo)
desbordaban la caja del slot y se solapaban con la prosa legal.

**Causa:** los slots se dimensionan al ancho del hueco original (corto). El
script fija un tamaño de fuente (`slotRect`: `sampleSize*0.62`, ≈9.67pt). Un
valor real más largo que el placeholder, a tamaño fijo, no cabe → desborda.

**Fix:** en `fillTemplate`, para campos de una sola línea
`textField.setFontSize(0)` (auto-size de pdf-lib) → el valor se encoge para
caber en la caja. Los bloques multilínea (historia) mantienen tamaño fijo (9pt)
para que el texto envuelto siga legible.

Efecto: valores largos quedan pequeños pero **visibles y dentro de la caja**;
nunca se solapan con la prosa.

---

## 3. Bug 2 — Campos en blanco (corrupción de `form.flatten()`)

**Síntoma:** en LOPD e intervención, los campos de la mitad inferior de la
página (línea de fecha "En __ el __ de __ de __", "D/Dña __ con DNI __") salían
**vacíos** en cualquier visor, mientras los campos superiores (clinic_name,
dirección) y los de otra página (tutor) sí se rellenaban.

**Diagnóstico (proceso):**

1. La resolución server-side era correcta (instrumentación temporal confirmó
   todos los valores no vacíos: lugar, dia, mes, anio, firmante…).
2. Las posiciones de los slots eran correctas (los valores caían exactamente en
   los huecos: análisis de matrices de texto).
3. Rasterizando con mupdf: `format error: cannot find object in xref (NNN 0 R)`
   + `premature end of data in flate filter`. El PDF guardado estaba
   **estructuralmente corrupto**.
4. Aislamiento:
   - `load + save` (sin tocar nada) → **OK**.
   - `fill` sin `flatten()` → **OK**, todos los campos visibles.
   - `fill` + `flatten()` → **CORRUPTO**, campos inferiores perdidos.
   - Reconstruir plantillas, `save({useObjectStreams:false})`, reload+resave,
     draw manual + `removeField` → **todos fallaron igual**.

**Causa raíz:** `form.flatten()` de pdf-lib genera una tabla xref inconsistente
sobre estas plantillas (construidas con cirugía manual de content streams en
`build-pdf-templates.ts`: registro de objetos + reemplazo de `Contents`). Los
streams de apariencia aplanados de algunos objetos quedan con offsets xref
incorrectos / datos flate truncados → los lectores no pueden cargarlos → en
blanco. Es un bug de pdf-lib disparado por la estructura de la plantilla, no del
código de relleno. La corrupción es determinista e irrecuperable (reload+resave
no la repara).

**Fix:** **eliminar `form.flatten()`**. En su lugar:

- `textField.enableReadOnly()` en **todos** los campos (incluso vacíos) → el
  documento renderizado no es editable en un visor (equivalente legal al
  flatten).
- `form.updateFieldAppearances()` → hornea las apariencias de los valores.
- `pdfDoc.save()` sin aplanar.

El render es visualmente idéntico a un flatten correcto pero el PDF queda
estructuralmente válido. Verificado rasterizando los 3 tipos (mupdf) — todos
los campos rellenan, sin errores xref.

**Nota:** el test asserta ahora "campos presentes y todos read-only" en vez de
"0 campos" (ya no se aplana).

---

## 4. Hardening adicional

- **Guard `instanceof PDFTextField`**: `form.getFields()` devuelve todos los
  tipos (checkbox, dropdown…). `getTextField()` lanza si el nombre no es text
  field. Se salta campos no-texto en vez de reventar toda la generación si una
  plantilla futura añade un checkbox.

---

## 5. Riesgos / futuro

- **NO reintroducir `form.flatten()`** sobre estas plantillas. Si se necesita un
  PDF aplanado de verdad: o se rehace `build-pdf-templates.ts` para producir
  plantillas estructuralmente limpias que pdf-lib pueda aplanar, o se dibuja el
  texto directamente sobre el `*_original.pdf` por coordenadas (sin AcroForm),
  o se hornea con otra librería (mupdf/qpdf) fuera de pdf-lib.
- Campos read-only se pueden desbloquear editando el PDF; aceptable para el caso
  de uso (documento generado para imprimir/firmar), no es protección
  criptográfica.
- `dateParts(null)` cae a **hoy** — un documento sin `fecha_consentimiento` ni
  `visit_date` saldrá fechado hoy, nunca vacío.
- Si se regeneran las plantillas (`tsx scripts/build-pdf-templates.ts`),
  reverificar rasterizando los 3 tipos antes de desplegar.

---

## 6. Cómo verificar visualmente (sin tooling de sistema)

No hay `pdftoppm`/`mutool`/`gs` en el entorno. Para rasterizar en una sesión de
debug se usó `mupdf` (npm) **temporalmente** y se eliminó después (no es
dependencia de producción):

```bash
npm i -D mupdf
# render a /tmp/x.pdf con renderPatientDocumentPdf (tsx)
# luego node+mjs (mupdf necesita top-level await, tsx/cjs no):
#   const d = mupdf.Document.openDocument(new Uint8Array(buf),'application/pdf')
#   d.loadPage(0).toPixmap(mupdf.Matrix.scale(2,2),mupdf.ColorSpace.DeviceRGB,false).asPNG()
npm rm mupdf
```

Vigilar en stderr de mupdf `cannot find object in xref` / `premature end of
data in flate filter` → señal de PDF corrupto.
