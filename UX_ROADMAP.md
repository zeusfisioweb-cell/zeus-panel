# Zeus Panel - UX & Visual Roadmap

Este documento detalla las propuestas y el roadmap para implementar mejoras visuales y funcionales (UX/Workflows) en el panel administrativo, con el objetivo de elevar la interfaz a un estándar de producto SaaS Premium y eliminar la fricción operativa.

## A. Flujos de Trabajo y Reducción de Fricción (Functional UX)

Esta sección se centra en la "UX Funcional": permitir que el usuario complete tareas sin cambiar de pantalla, conectando entidades del sistema desde donde las necesita.

### 1. Creación Inline (Entidades Cruzadas) 🔄
- **Paciente desde Cita:** Al estar creando una cita, si el paciente no existe, incluir un botón `+ Nuevo Paciente` en el mismo selector. Al pulsarlo, abre un sub-modal rápido (nombre, teléfono), crea el paciente en segundo plano y lo deja seleccionado para la cita. ¡Cero cambios de página!
- **Servicio desde Profesional:** (Y viceversa). Si estás dando de alta un especialista y trae un servicio nuevo a la clínica, permitir darle a `+ Nuevo Servicio` directamente en su lista de *checkboxes* de servicios habilitados.

### 2. Gestión de Horarios desde Perfil 📅
- En lugar de obligar al usuario a ir a la sección `/horarios` para asignarle disponibilidad a un profesional, incluir una pestaña "Horario" directamente dentro del `ProfessionalDrawer` o el modal de edición del profesional. Donde gestionas quién es, gestionas cuándo trabaja.

### 3. Fichas Clínicas Contextuales 📝
- En la vista del calendario o línea de tiempo, añadir una acción rápida en la tarjeta de la cita: `+ Añadir Nota Clínica`. Al pulsarlo, abre el editor de la ficha ya pre-vinculado a ese Paciente y a ese Profesional. Ahorra tener que buscar al paciente, abrir su historial y crear la nota manualmente.

### 4. Acciones Rápidas de Comunicación 💬
- En el modal del paciente o en la tarjeta de su próxima cita, incluir botones de "Un Clic" hacia `wa.me/numerotelefono` o `mailto:email` para enviar recordatorios rápidos o notas, sin tener que copiar y pegar el número de teléfono en otra app.

### 5. Reprogramación "Drag & Drop" ✋
- En la vista de agenda diaria/semanal, permitir arrastrar y soltar la tarjeta de una cita a otra franja horaria. Al soltarla, un modal pide confirmación rápida y se actualiza en base de datos al instante.

---

## B. Estética y Micro-Interacciones (Visual UX)

### 6. Paleta de Comandos (Cmd+K / Omnibar) ⚡
- **Descripción:** Una barra de búsqueda global flotante (estilo Spotlight de Mac) que se abre con `Cmd+K`.
- **Beneficio:** Permite al profesional buscar rápidamente el nombre de un paciente, escribir "Nueva cita", o "Ir a configuración", sin usar el ratón.

### 7. Skeletons y Animaciones en Cascada (Staggered Animations) 🌊
- **Descripción:** Reemplazo de spinners nativos por "Skeletons" (esqueletos de carga) con efecto de brillo (*shimmer*) en tono crema/canela.
- **Beneficio:** Mejora la carga percibida. Las listas (ej. Pacientes) hacen *fade-in* en cascada usando `framer-motion`.

### 8. Notificaciones Toast "Premium" (Estilo Sonner) 🍞
- **Descripción:** Sistema de notificaciones flotantes y animadas para mensajes de éxito/error (ej. guardado de historial).
- **Beneficio:** Reemplaza saltos bruscos por notificaciones elegantes con opciones de "Deshacer" integradas.

### 9. Popovers de Vista Previa (Hover Cards) 🔍
- **Descripción:** Tarjetas flotantes que aparecen al pasar el ratón (hover) sobre nombres de pacientes en las tablas.
- **Beneficio:** Ahorra la necesidad de abrir el panel lateral para ver la próxima cita o notas rápidas. Uso de Radix UI `HoverCard`.

### 10. Animación "Dibujo de Línea" en Timeline de Pacientes 📉
- **Descripción:** Al abrir el historial de un paciente, la línea vertical canela se "dibuja" de arriba hacia abajo y los nodos aparecen uno a uno.
- **Beneficio:** Crea un efecto "Wow" que refuerza visualmente la línea temporal cronológica.
