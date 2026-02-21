'use client';

import { useState } from 'react';
import Icon from '@/components/Icon';

export default function LegalPage() {
    // Mock data for the boss to see
    const [stats] = useState({
        totalConsents: 142,
        pendingConsents: 3,
        deletionRequests: 1,
    });

    const pendingPatients = [
        { id: 1, name: 'María López', date: '2026-02-21', phone: '612345678' },
        { id: 2, name: 'Carlos Fernández', date: '2026-02-20', phone: '698765432' },
        { id: 3, name: 'Ana Gómez', date: '2026-02-18', phone: '655555555' },
    ];

    const auditLogs = [
        { id: 101, user: 'Dr. Martínez', action: 'Accedió a historial completo', patient: 'Juan Pérez', time: '10:45 AM - Hoy', level: 'info' },
        { id: 102, user: 'Recepción', action: 'Exportó datos RGPD', patient: 'Lucía Díaz', time: '16:20 PM - Ayer', level: 'warning' },
        { id: 103, user: 'Admin (Tú)', action: 'Eliminó registro (Derecho al olvido)', patient: 'Carlos Ruiz', time: '09:10 AM - 18 Feb', level: 'danger' },
        { id: 104, user: 'Dra. Silva', action: 'Modificó notas clínicas', patient: 'Elena Torres', time: '11:30 AM - 17 Feb', level: 'info' },
    ];

    return (
        <>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Legal y Cumplimiento</h1>
                    <p className="page-subtitle">Gestión de RGPD, Consentimientos y Auditoría de Datos</p>
                </div>
                <button className="btn btn--secondary">
                    <Icon name="download" size={16} /> Exportar Registro de Actividad
                </button>
            </div>

            <div className="stats-grid">
                <div className="stat-card" style={{ borderLeft: '3px solid var(--success)' }}>
                    <div className="stat-card__icon stat-card__icon--success"><Icon name="check" /></div>
                    <div>
                        <div className="stat-card__value">{stats.totalConsents}</div>
                        <div className="stat-card__label">Consentimientos Firmados</div>
                    </div>
                </div>
                <div className="stat-card" style={{ borderLeft: '3px solid var(--warning)' }}>
                    <div className="stat-card__icon stat-card__icon--warning"><Icon name="warning" /></div>
                    <div>
                        <div className="stat-card__value">{stats.pendingConsents}</div>
                        <div className="stat-card__label">Pendientes de Firma</div>
                    </div>
                </div>
                <div className="stat-card" style={{ borderLeft: '3px solid var(--danger)' }}>
                    <div className="stat-card__icon" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>
                        <Icon name="users" />
                    </div>
                    <div>
                        <div className="stat-card__value">{stats.deletionRequests}</div>
                        <div className="stat-card__label">Peticiones de Borrado</div>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 24 }}>
                <div className="card">
                    <div className="card__header">
                        <h2 className="card__title">Atención Requerida</h2>
                    </div>
                    <div className="card__body" style={{ padding: 0 }}>
                        <div style={{ padding: '16px 24px', background: 'var(--danger-bg)', borderBottom: '1px solid var(--border-color)' }}>
                            <div style={{ fontWeight: 600, color: 'var(--danger)', fontSize: 13, marginBottom: 4 }}>Solicitud de Borrado (Derecho al Olvido)</div>
                            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>El paciente <strong>Pedro Sánchez</strong> ha solicitado la eliminación de todos sus datos personales físicos y digitales.</div>
                            <button className="btn btn--sm btn--danger" style={{ width: '100%' }}>Proceder a borrar datos</button>
                        </div>

                        <div style={{ padding: '16px 24px' }}>
                            <h3 style={{ fontSize: 12, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 16 }}>Pacientes sin Consentimiento</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {pendingPatients.map(p => (
                                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottom: '1px solid var(--border-color)' }}>
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: 500 }}>{p.name}</div>
                                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.phone}</div>
                                        </div>
                                        <button className="btn btn--sm btn--secondary">Enviar Link</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="card">
                    <div className="card__header">
                        <h2 className="card__title">Auditoría de Accesos (Activity Logs)</h2>
                        <span className="badge badge-default" style={{ fontSize: 11 }}>Últimos 7 días</span>
                    </div>
                    <div className="card__body" style={{ padding: 0 }}>
                        <div className="table-wrapper">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Usuario</th>
                                        <th>Acción Realizada</th>
                                        <th>Paciente / Entidad</th>
                                        <th>Fecha y Hora</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {auditLogs.map(log => (
                                        <tr key={log.id}>
                                            <td style={{ fontWeight: 500 }}>{log.user}</td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <span className={`badge badge--${log.level === 'warning' ? 'pending' : (log.level === 'danger' ? 'cancelled' : 'completed')}`}>
                                                        {log.action}
                                                    </span>
                                                </div>
                                            </td>
                                            <td>{log.patient}</td>
                                            <td style={{ color: 'var(--text-muted)' }}>{log.time}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
