'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { DonutChart } from '@/components/charts/DonutChart';
import { BarChartH } from '@/components/charts/BarChartH';
import { RadialRing } from '@/components/charts/RadialRing';
import { useAnalytics, AnalyticsPeriod } from '@/hooks/useAnalytics';
import Icon from '@/components/Icon';

// Palette mirrors dashboard pieColors exactly
const PIE_COLORS = ['#AD7332', '#C9954D', '#2563EB', '#059669', '#D97706', '#0F766E', '#8B5A26', '#64748B'];

function Spinner() {
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
            <div className="spinner" />
        </div>
    );
}

export default function AnaliticaPage() {
    const [globalPeriod, setGlobalPeriod] = useState<AnalyticsPeriod>('last_30_days');
    const [customStart, setCustomStart] = useState<string>('');
    const [customEnd, setCustomEnd] = useState<string>('');
    
    // Solo pasamos start y end si el periodo es 'custom' y ambos están definidos
    const { data, isLoading } = useAnalytics(
        globalPeriod, 
        globalPeriod === 'custom' && customStart && customEnd ? customStart : undefined,
        globalPeriod === 'custom' && customStart && customEnd ? customEnd : undefined
    );
    const [occView, setOccView] = useState<'monthly' | 'weekly' | 'custom'>('monthly');

    // Cambiar la vista de ocupación automáticamente si usan custom
    React.useEffect(() => {
        if (globalPeriod === 'custom' && customStart && customEnd) {
            setOccView('custom');
        } else if (globalPeriod === 'last_7_days') {
            setOccView('weekly');
        } else {
            setOccView('monthly');
        }
    }, [globalPeriod, customStart, customEnd]);

    // ── Adherencia donut ──────────────────────────────────────────────────
    const adherenceDonut = [
        { name: 'Una visita',  value: data?.adherence.oneTime   ?? 0, color: '#D97706' },
        { name: '2–3 visitas', value: data?.adherence.twoThree  ?? 0, color: '#2563EB' },
        { name: '4+ visitas',  value: data?.adherence.loyal      ?? 0, color: '#059669' },
    ];

    // ── Estado de citas donut ─────────────────────────────────────────────
    const statusDonut = [
        { name: 'Completadas', value: data?.statusBreakdown.statusCount.completed ?? 0, color: '#059669' },
        { name: 'Confirmadas', value: data?.statusBreakdown.statusCount.confirmed ?? 0, color: '#2563EB' },
        { name: 'Pendientes',  value: data?.statusBreakdown.statusCount.pending   ?? 0, color: '#D97706' },
        { name: 'Canceladas',  value: data?.statusBreakdown.statusCount.cancelled ?? 0, color: '#DC2626' },
    ];

    // ── Ingresos por servicio (barras horizontales) ────────────────────────
    const revenueBarData = (data?.revenue.topServices ?? []).map((s, i) => ({
        name: s.name,
        shortName: s.name,   // full name — axis is wide enough
        value: Math.round(s.revenue),
        color: PIE_COLORS[i % PIE_COLORS.length],
    }));

    // ── Sesiones por profesional ───────────────────────────────────────────
    const proBarData = (data?.professionals ?? []).map((p, i) => ({
        name: p.name,
        shortName: p.name,   // full name
        value: p.sessions,
        color: PIE_COLORS[i % PIE_COLORS.length],
    }));

    // ── Distribución por día ───────────────────────────────────────────────
    const dayBarData = (data?.dayBreakdown ?? []).filter(d => d.value > 0);

    // ── Origen de reservas (donut) ─────────────────────────────────────────
    const sourcesDonut = [
        { name: 'Panel (Admin)', value: data?.bookingSources.admin ?? 0, color: '#2563EB' },
        { name: 'Web',           value: data?.bookingSources.web   ?? 0, color: '#059669' },
    ];

    // ── Horas pico ─────────────────────────────────────────────────────────
    const peakHoursBarData = data?.peakHours ?? [];

    // ── Tendencia de ingresos (6 meses) ────────────────────────────────────
    const revenueTrendBarData = (data?.revenueTrend ?? []).map((m) => ({
        name: m.label,
        shortName: m.label,
        value: m.revenue,
        color: '#0F766E', // teal
    }));

    const occData = data?.occupancy[occView] ?? { rate: 0, hoursBooked: 0, capacityHours: 0 };
    const occ = occData.rate;
    const occColor = occ > 75 ? '#059669' : occ > 45 ? '#2563EB' : '#D97706';

    const periodLabels: Record<AnalyticsPeriod, string> = {
        last_7_days: 'Últimos 7 días',
        last_30_days: 'Último mes',
        last_year: 'Último año',
        all_time: 'Histórico',
        custom: 'Personalizado'
    };

    return (
        <div className="content-shell section-shell animate-in fade-in duration-500">

            {/* ── Header ── */}
            <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h1 style={{
                        fontFamily: 'var(--font-zeus-display, serif)',
                        fontSize: 'clamp(22px, 2.4vw, 30px)',
                        fontWeight: 800,
                        color: 'var(--text-main)',
                        letterSpacing: '-0.03em',
                        lineHeight: 1.1,
                        marginBottom: 6,
                    }}>
                        Reporte de Negocio
                    </h1>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>
                        Mostrando datos para: <strong>{periodLabels[globalPeriod]}</strong>.
                    </p>
                </div>

                {/* Global Period Toggle & Print */}
                <div className="print-hide" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <button
                        onClick={() => window.print()}
                        className="btn"
                        style={{ padding: '6px 12px', height: 'auto', minHeight: 0, gap: '6px', display: 'flex', alignItems: 'center' }}
                    >
                        <Icon name="download" size={16} />
                        Exportar a PDF
                    </button>
                    
                    <div style={{ display: 'flex', background: 'var(--bg-body)', borderRadius: '8px', padding: '4px', border: '1px solid var(--border-color)', overflowX: 'auto' }}>
                        {(Object.keys(periodLabels) as AnalyticsPeriod[]).map(p => (
                            <button
                                key={p}
                                onClick={() => setGlobalPeriod(p)}
                                style={{ 
                                    padding: '6px 12px', 
                                    fontSize: 13, 
                                    fontWeight: 600, 
                                    borderRadius: '6px', 
                                    background: globalPeriod === p ? 'var(--bg-surface)' : 'transparent', 
                                    color: globalPeriod === p ? 'var(--text-main)' : 'var(--text-muted)', 
                                    border: globalPeriod === p ? '1px solid var(--border-color)' : '1px solid transparent', 
                                    boxShadow: globalPeriod === p ? '0 1px 2px rgba(0,0,0,0.05)' : 'none', 
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                {periodLabels[p]}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Custom Date Picker Row */}
            {globalPeriod === 'custom' && (
                <div className="print-hide animate-in slide-in-from-top-2 fade-in duration-200" style={{ marginBottom: 24, padding: '16px', background: 'var(--bg-surface)', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>Desde:</label>
                        <input 
                            type="date" 
                            className="form-input" 
                            style={{ minHeight: '32px', fontSize: 13 }}
                            value={customStart}
                            onChange={e => setCustomStart(e.target.value)}
                        />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>Hasta:</label>
                        <input 
                            type="date" 
                            className="form-input" 
                            style={{ minHeight: '32px', fontSize: 13 }}
                            value={customEnd}
                            onChange={e => setCustomEnd(e.target.value)}
                        />
                    </div>
                    {(!customStart || !customEnd) && (
                        <p style={{ fontSize: 12, color: 'var(--text-subtle)', margin: 0 }}>
                            Selecciona ambas fechas para aplicar el filtro.
                        </p>
                    )}
                </div>
            )}

            <section className="zs-charts-panel" aria-label="Métricas clínicas avanzadas">

                {/* ── Row 1: Adherencia + Estado de citas ── */}
                <div className="zs-charts-row">

                    {/* Adherencia */}
                    <div className="zs-charts-card">
                        <div className="zs-charts-card__header">
                            <p className="zs-charts-card__title">Fidelización de pacientes</p>
                            <p className="zs-charts-card__hint">visitas completadas por paciente</p>
                        </div>
                        {isLoading ? <Spinner /> : (
                            <DonutChart
                                data={adherenceDonut}
                                centerLabel="pacientes"
                                centerValue={data?.adherence.totalPatients ?? 0}
                                height={200}
                                showLegend
                            />
                        )}
                        {!isLoading && (
                            <div className="zs-occ-strip">
                                <div style={{
                                    width: 64, height: 64, borderRadius: '50%',
                                    background: 'rgba(5,150,105,0.10)',
                                    border: '2px solid rgba(5,150,105,0.25)',
                                    display: 'flex', flexDirection: 'column',
                                    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                }}>
                                    <strong style={{ fontSize: 18, fontWeight: 800, color: '#059669', lineHeight: 1 }}>
                                        {data?.adherence.averageVisits}
                                    </strong>
                                    <span style={{ fontSize: 9, fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                        media
                                    </span>
                                </div>
                                <div className="zs-occ-strip__copy">
                                    <p className="zs-occ-strip__title">Media de visitas</p>
                                    <p className="zs-occ-strip__sub">
                                        {data?.adherence.loyal ?? 0} fidelizados · {data?.adherence.oneTime ?? 0} pacientes de una sola visita
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Estado de citas */}
                    <div className="zs-charts-card">
                        <div className="zs-charts-card__header">
                            <p className="zs-charts-card__title">Estado global de citas</p>
                            <p className="zs-charts-card__hint">distribución de todos los registros</p>
                        </div>
                        {isLoading ? <Spinner /> : (
                            <DonutChart
                                data={statusDonut}
                                centerLabel="total"
                                centerValue={data?.statusBreakdown.totalAll ?? 0}
                                height={200}
                                showLegend
                            />
                        )}
                        {!isLoading && (
                            <div className="zs-occ-strip">
                                <RadialRing
                                    value={data?.statusBreakdown.cancellationRate ?? 0}
                                    size={72}
                                    color="#DC2626"
                                />
                                <div className="zs-occ-strip__copy">
                                    <p className="zs-occ-strip__title">Tasa de cancelación</p>
                                    <p className="zs-occ-strip__sub">
                                        {data?.statusBreakdown.statusCount.cancelled ?? 0} canceladas de {data?.statusBreakdown.totalAll ?? 0} totales
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Row 2: Ingresos por servicio + Sesiones por profesional ── */}
                <div className="zs-charts-row">

                    {/* Ingresos por servicio */}
                    <div className="zs-charts-card">
                        <div className="zs-charts-card__header">
                            <p className="zs-charts-card__title">Ingresos por servicio</p>
                            <p className="zs-charts-card__hint">
                                estimado · total {data?.revenue.totalEstimatedRevenue
                                    ? `${data.revenue.totalEstimatedRevenue.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}`
                                    : '—'}
                            </p>
                        </div>
                        {isLoading ? <Spinner /> : revenueBarData.length === 0 ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--text-muted)', fontSize: 13, fontWeight: 600 }}>
                                Sin datos de servicios
                            </div>
                        ) : (
                            <BarChartH
                                data={revenueBarData}
                                height={Math.max(180, revenueBarData.length * 36)}
                                axisWidth={150}
                                ariaLabel="Ingresos estimados por servicio en euros"
                            />
                        )}
                    </div>

                    {/* Sesiones por profesional */}
                    <div className="zs-charts-card">
                        <div className="zs-charts-card__header">
                            <p className="zs-charts-card__title">Sesiones por profesional</p>
                            <p className="zs-charts-card__hint">citas completadas históricas</p>
                        </div>
                        {isLoading ? <Spinner /> : proBarData.length === 0 ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--text-muted)', fontSize: 13, fontWeight: 600 }}>
                                Sin profesionales activos
                            </div>
                        ) : (
                            <BarChartH
                                data={proBarData}
                                height={Math.max(180, proBarData.length * 44)}
                                axisWidth={110}
                                ariaLabel="Sesiones completadas por profesional"
                            />
                        )}
                    </div>
                </div>

                {/* ── Row 3: Ocupación + Día de la semana ── */}
                <div className="zs-charts-row">

                    {/* Ocupación */}
                    <div className="zs-charts-card">
                        <div className="zs-charts-card__header">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                                <div>
                                    <p className="zs-charts-card__title">Ocupación</p>
                                    <p className="zs-charts-card__hint">horas agendadas vs capacidad total</p>
                                </div>
                                <div className="print-hide" style={{ display: 'flex', background: 'var(--bg-body)', borderRadius: '8px', padding: '2px', border: '1px solid var(--border-color)' }}>
                                    <button 
                                        className="print-hide"
                                        onClick={() => setOccView('monthly')}
                                        style={{ padding: '4px 8px', fontSize: 11, fontWeight: 600, borderRadius: '6px', background: occView === 'monthly' ? 'var(--bg-surface)' : 'transparent', color: occView === 'monthly' ? 'var(--text-main)' : 'var(--text-muted)', border: occView === 'monthly' ? '1px solid var(--border-color)' : '1px solid transparent', boxShadow: occView === 'monthly' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none', cursor: 'pointer' }}
                                    >
                                        Mes
                                    </button>
                                    <button 
                                        className="print-hide"
                                        onClick={() => setOccView('weekly')}
                                        style={{ padding: '4px 8px', fontSize: 11, fontWeight: 600, borderRadius: '6px', background: occView === 'weekly' ? 'var(--bg-surface)' : 'transparent', color: occView === 'weekly' ? 'var(--text-main)' : 'var(--text-muted)', border: occView === 'weekly' ? '1px solid var(--border-color)' : '1px solid transparent', boxShadow: occView === 'weekly' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none', cursor: 'pointer' }}
                                    >
                                        Semana
                                    </button>
                                    {globalPeriod === 'custom' && customStart && customEnd && (
                                        <button 
                                            className="print-hide"
                                            onClick={() => setOccView('custom')}
                                            style={{ padding: '4px 8px', fontSize: 11, fontWeight: 600, borderRadius: '6px', background: occView === 'custom' ? 'var(--bg-surface)' : 'transparent', color: occView === 'custom' ? 'var(--text-main)' : 'var(--text-muted)', border: occView === 'custom' ? '1px solid var(--border-color)' : '1px solid transparent', boxShadow: occView === 'custom' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none', cursor: 'pointer' }}
                                        >
                                            Rango
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                        {isLoading ? <Spinner /> : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px 0' }}>
                                <div className="zs-occ-strip" style={{ gap: '20px' }}>
                                    <RadialRing value={occ} size={80} color={occColor} />
                                    <div className="zs-occ-strip__copy">
                                        <p className="zs-occ-strip__title" style={{ fontSize: 16 }}>
                                            {occ > 75 ? 'Alta demanda' : occ > 45 ? 'Carga media' : 'Baja ocupación'}
                                        </p>
                                        <p className="zs-occ-strip__sub" style={{ color: 'var(--text-muted)' }}>
                                            {occData.hoursBooked}h de {occData.capacityHours}h estimadas {occView === 'monthly' ? 'este mes' : occView === 'weekly' ? 'esta semana' : 'en estas fechas'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Distribución por día de la semana */}
                    <div className="zs-charts-card">
                        <div className="zs-charts-card__header">
                            <p className="zs-charts-card__title">Actividad por día</p>
                            <p className="zs-charts-card__hint">sesiones completadas según día de la semana</p>
                        </div>
                        {isLoading ? <Spinner /> : dayBarData.length === 0 ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--text-muted)', fontSize: 13, fontWeight: 600 }}>
                                Sin datos suficientes
                            </div>
                        ) : (
                            <BarChartH
                                data={dayBarData}
                                height={200}
                                ariaLabel="Distribución de sesiones completadas por día de la semana"
                            />
                        )}
                    </div>
                </div>

                {/* ── Row 4: Tendencia mensual + Origen de reservas ── */}
                <div className="zs-charts-row">

                    {/* Tendencia mensual */}
                    <div className="zs-charts-card">
                        <div className="zs-charts-card__header">
                            <p className="zs-charts-card__title">Tendencia de Ingresos</p>
                            <p className="zs-charts-card__hint">estimación mensual basada en citas completadas x precio</p>
                        </div>
                        {isLoading ? <Spinner /> : revenueTrendBarData.length === 0 ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--text-muted)', fontSize: 13, fontWeight: 600 }}>
                                Sin datos suficientes
                            </div>
                        ) : (
                            <BarChartH
                                data={revenueTrendBarData}
                                height={Math.max(180, revenueTrendBarData.length * 36)}
                                axisWidth={50}
                                ariaLabel="Tendencia mensual de ingresos estimados"
                            />
                        )}
                    </div>

                    {/* Origen de reservas */}
                    <div className="zs-charts-card">
                        <div className="zs-charts-card__header">
                            <p className="zs-charts-card__title">Origen de Reservas</p>
                            <p className="zs-charts-card__hint">distribución de canal de captación</p>
                        </div>
                        {isLoading ? <Spinner /> : (
                            <DonutChart
                                data={sourcesDonut}
                                centerLabel="reservas"
                                centerValue={data?.bookingSources.total ?? 0}
                                height={200}
                                showLegend
                            />
                        )}
                        {!isLoading && (
                            <div className="zs-occ-strip">
                                <div style={{
                                    width: 48, height: 48, borderRadius: '50%',
                                    background: 'rgba(5,150,105,0.10)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                    color: '#059669',
                                }}>
                                    <Icon name="globe" size={24} />
                                </div>
                                <div className="zs-occ-strip__copy">
                                    <p className="zs-occ-strip__title">{data?.bookingSources.web ?? 0} desde la Web</p>
                                    <p className="zs-occ-strip__sub" style={{ color: 'var(--text-muted)' }}>
                                        Reservas captadas de forma autónoma
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Row 5: Horas pico — full width ── */}
                <div className="zs-charts-card">
                    <div className="zs-charts-card__header">
                        <p className="zs-charts-card__title">Horas Pico de Actividad</p>
                        <p className="zs-charts-card__hint">número de sesiones completadas agrupadas por hora de inicio</p>
                    </div>
                    {isLoading ? <Spinner /> : peakHoursBarData.length === 0 ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--text-muted)', fontSize: 13, fontWeight: 600 }}>
                            Sin datos suficientes
                        </div>
                    ) : (
                        <BarChartH
                            data={peakHoursBarData}
                            height={Math.max(300, peakHoursBarData.length * 32)}
                            axisWidth={50}
                            ariaLabel="Distribución de sesiones por hora del día"
                        />
                    )}
                </div>

                {/* ── CTA ── */}
                <div className="zs-charts-actions">
                    <Link href="/pacientes" className="btn btn--primary" style={{ width: '100%', textAlign: 'center' }}>
                        Ver todos los pacientes
                    </Link>
                </div>

            </section>
        </div>
    );
}
