export default function AdminLoading() {
    return (
        <div className="page-header" style={{ opacity: 0.5, animation: 'pulse 2s infinite' }}>
            <div>
                <div style={{ width: 250, height: 32, background: 'var(--border-color)', borderRadius: 8, marginBottom: 8 }} />
                <div style={{ width: 400, height: 20, background: 'var(--border-color)', borderRadius: 8 }} />
            </div>

            <div style={{ marginTop: 40, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 20 }}>
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="card" style={{ height: 120 }}>
                        <div style={{ width: 40, height: 40, background: 'var(--border-color)', borderRadius: 8, marginBottom: 16 }} />
                        <div style={{ width: '80%', height: 24, background: 'var(--border-color)', borderRadius: 8 }} />
                    </div>
                ))}
            </div>
        </div>
    );
}
