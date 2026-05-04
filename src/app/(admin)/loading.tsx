export default function AdminLoading() {
    return (
        <div className="page-header opacity-50 animate-pulse">
            <div>
                <div className="w-[250px] h-8 bg-[var(--border-color)] rounded-lg mb-2" />
                <div className="w-[400px] h-5 bg-[var(--border-color)] rounded-lg" />
            </div>

            <div className="mt-10 grid grid-cols-4 gap-5">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="card h-[120px]">
                        <div className="w-10 h-10 bg-[var(--border-color)] rounded-lg mb-4" />
                        <div className="w-[80%] h-6 bg-[var(--border-color)] rounded-lg" />
                    </div>
                ))}
            </div>
        </div>
    );
}
