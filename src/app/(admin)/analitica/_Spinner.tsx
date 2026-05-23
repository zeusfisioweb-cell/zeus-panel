export function Spinner() {
    return (
        <div className="flex items-center justify-center h-[200px]" role="status" aria-label="Cargando datos">
            <div className="spinner" />
        </div>
    );
}
