# Plan de Implementación: Mejoras Interfaz Calendario y Lista

Basado en la investigación de los estándares actuales de SaaS (2024-2025) y la arquitectura actual de tu proyecto (Next.js, UI "Canela" 100% custom, sin librerías externas rígidas), el **mejor enfoque no es instalar un mastodonte como FullCalendar** (que rompería tu diseño a medida), sino **evolucionar tu componente actual (`CitasTimeline.tsx` y `CitasTable.tsx`)** utilizando librerías "Headless" (sin estilos) que te permitan mantener tu pixel-perfect UI.

Aquí tienes el plan de acción táctico para ambas vistas:

---

## 1. Módulo de Calendario (`CitasTimeline.tsx`)

Actualmente tienes una vista diaria donde las citas se apilan. Para una clínica, el estándar de oro es la **Vista de Recursos** y la manipulación táctil.

### Funcionalidades a implementar:
1. **Vista Semanal (Días como columnas):**
   - **Qué es:** Dado que ya tienes un filtro perfecto por profesional, en lugar de dividir por doctores, la evolución natural es permitir cambiar entre "Vista de Día" (lo que tienes ahora) y "Vista de Semana".
   - **UX:** El operador puede ver la disponibilidad de un profesional filtrado a lo largo de toda la semana de un solo vistazo, con los días de la semana como columnas.
2. **Drag & Drop (Arrastrar y Soltar):**
   - **Librería:** `@dnd-kit/core` (el estándar actual en React, ligero y accesible).
   - **Qué es:** Agarrar una tarjeta de cita y arrastrarla a las 18:00h, o arrastrarla de la columna del Dr. A a la del Dr. B.
   - **UX:** Al soltar, un *toast* o modal rápido pide confirmación ("¿Mover cita de Carlos a las 18:00 con Dr. B?").
3. **Resizing (Cambio de duración interactivo):**
   - **Qué es:** Añadir un pequeño tirador (`handle`) en el borde inferior de la tarjeta de la cita. Arrastrarlo hacia abajo extiende la cita de 30 a 60 minutos.
4. **Mini-Calendario Completo (Mes a la vista):**
   - **Librería:** `react-day-picker` (estilizado con tus variables `--brand-canela`).
   - **Qué es:** Actualmente solo te mueves con flechas (`< >`) o la tira de 7 días. Implementaremos que al hacer clic en el título de la fecha (Ej: "Lunes, 14 de Octubre"), se despliegue un popover elegante con el mes completo.
   - **UX:** Permite saltar al día 28 directamente sin hacer clic 14 veces. Además, los días con muchas citas tendrán un fondo o un puntito canela (estilo Heatmap) para identificar los días saturados de un solo vistazo.

---

## 2. Módulo de Lista (`CitasTable.tsx`)

La vista de tabla suele ser más analítica. El objetivo aquí es la **velocidad de gestión masiva**.

### Funcionalidades a implementar:
1. **Edición *Inline* (Sin Modales):**
   - **Qué es:** En la columna "Estado" (Pendiente, Confirmada), al hacer clic sobre la "píldora" (Badge), se abre un pequeño menú desplegable ahí mismo para cambiar el estado al instante. Igual para reasignar Profesional.
   - **UX:** Ahorra tener que abrir el modal completo de la cita solo para cambiar su estado.
2. **Agrupación Semántica (Row Grouping):**
   - **Qué es:** En lugar de una lista plana, agrupar las filas visualmente por fechas relativas: "Hoy", "Mañana", "Lunes 14" mediante cabeceras separadoras dentro de la propia tabla.
3. **Barra Flotante de Acciones Masivas (Floating Action Bar):**
   - **Qué es:** Cuando el usuario selecciona los checkboxes de varias citas, aparece una barra flotante elegante en la parte inferior central de la pantalla (estilo Notion/Linear).
   - **Opciones:** "Confirmar X citas", "Cancelar X citas", "Asignar a...".
4. **Virtualización (Scroll Infinito sin lag):**
   - **Librería:** `@tanstack/react-virtual`
   - **Qué es:** Si tienes 500 citas en el mes, la tabla solo renderiza las 20 que estás viendo en pantalla. Hace que el panel vaya literalmente a la velocidad de la luz independientemente del volumen de datos.

---

## Estrategia de Ejecución (Fases)

Recomiendo atacar este plan en 3 *Sprints* o fases para no romper el panel actual:

- **Fase 1 (Quick Wins - UX Lista):** Implementar la **Edición Inline** de estados en la tabla y la **Barra Flotante de Acciones Masivas**. Esto da valor inmediato al recepcionista/operador.
- **Fase 2 (Calendario Avanzado - Layout):** Refactorizar `CitasTimeline.tsx` para soportar la **Vista Columnar por Profesional**, manteniendo la lógica matemática que ya tienes de minutos y píxeles.
- **Fase 3 (Interactividad):** Instalar `@dnd-kit/core` y mapear el Drag & Drop tanto en el calendario (reprogramar) como para el cambio de duración.
