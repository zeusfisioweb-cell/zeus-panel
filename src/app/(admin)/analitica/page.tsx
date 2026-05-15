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
        <div className="flex items-center justify-center h-[200px]" role="status" aria-label="Cargando datos">
            <div className="spinner" />
        </div>
    );
}

function pillClasses(active: boolean): string {
    return `py-1.5 px-3 text-[13px] font-semibold rounded-md cursor-pointer whitespace-nowrap ${
        active
            ? 'bg-[var(--bg-surface)] text-[var(--text-main)] border border-[var(--border-color)] shadow-[0_1px_2px_rgba(0,0,0,0.05)]'
            : 'bg-transparent text-[var(--text-muted)] border border-transparent'
    }`;
}

function occPillClasses(active: boolean): string {
    return `py-1 px-2 text-[11px] font-semibold rounded-md border cursor-pointer ${
        active
            ? 'bg-[var(--bg-surface)] text-[var(--text-main)] border-[var(--border-color)] shadow-[0_1px_2px_rgba(0,0,0,0.05)]'
            : 'bg-transparent text-[var(--text-muted)] border-transparent'
    }`;
}

const EMPTY_CLASSES = 'flex items-center justify-center h-[200px] text-[var(--text-muted)] text-[13px] font-semibold';

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
            <div className="mb-6 flex justify-between items-end flex-wrap gap-4">
                <div>
                    <h1 className="font-[family-name:var(--font-zeus-display,serif)] text-[clamp(22px,2.4vw,30px)] font-extrabold text-[var(--text-main)] tracking-[-0.03em] leading-[1.1] mb-1.5">
                        Reporte de Negocio
                    </h1>
                    <p className="text-[13px] text-[var(--text-muted)] font-medium">
                        Mostrando datos para: <strong>{periodLabels[globalPeriod]}</strong>.
                    </p>
                </div>

                {/* Global Period Toggle */}
                <div className="print-hide flex items-center gap-3 flex-wrap">
                    <div className="flex bg-[var(--bg-body)] rounded-lg p-1 border border-[var(--border-color)] overflow-x-auto" role="group" aria-label="Seleccionar periodo de análisis">
                        {(Object.keys(periodLabels) as AnalyticsPeriod[]).map(p => (
                            <button
                                key={p}
                                type="button"
                                onClick={() => setGlobalPeriod(p)}
                                aria-pressed={globalPeriod === p}
                                className={pillClasses(globalPeriod === p)}
                            >
                                {periodLabels[p]}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Custom Date Picker Row */}
            {globalPeriod === 'custom' && (
                <div className="print-hide animate-in slide-in-from-top-2 fade-in duration-200 mb-6 p-4 bg-[var(--bg-surface)] rounded-xl border border-[var(--border-color)] flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                        <label className="text-[13px] font-semibold text-[var(--text-muted)]" htmlFor="start-date">Desde:</label>
                        <input
                            id="start-date"
                            type="date"
                            className="form-input min-h-[32px] text-[13px]"
                            value={customStart}
                            onChange={e => setCustomStart(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-[13px] font-semibold text-[var(--text-muted)]" htmlFor="end-date">Hasta:</label>
                        <input
                            id="end-date"
                            type="date"
                            className="form-input min-h-[32px] text-[13px]"
                            value={customEnd}
                            onChange={e => setCustomEnd(e.target.value)}
                        />
                    </div>
                    {(!customStart || !customEnd) && (
                        <p className="text-xs text-[var(--text-subtle)] m-0">
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
                                <div className="w-16 h-16 rounded-full bg-[rgba(5,150,105,0.10)] border-2 border-[rgba(5,150,105,0.25)] flex flex-col items-center justify-center shrink-0">
                                    <strong className="text-lg font-extrabold text-[#059669] leading-none">
                                        {data?.adherence.averageVisits}
                                    </strong>
                                    <span className="text-[9px] font-bold text-[#059669] uppercase tracking-[0.06em]">
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
                            <div className={EMPTY_CLASSES}>
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
                            <div className={EMPTY_CLASSES}>
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
                            <div className="flex justify-between items-start w-full">
                                <div>
                                    <p className="zs-charts-card__title">Ocupación</p>
                                    <p className="zs-charts-card__hint">horas agendadas vs capacidad total</p>
                                </div>
                                <div className="print-hide flex bg-[var(--bg-body)] rounded-lg p-0.5 border border-[var(--border-color)]" role="group" aria-label="Vista de ocupación">
                                    <button
                                        type="button"
                                        className={`print-hide ${occPillClasses(occView === 'monthly')}`}
                                        onClick={() => setOccView('monthly')}
                                        aria-pressed={occView === 'monthly'}
                                    >
                                        Mes
                                    </button>
                                    <button
                                        type="button"
                                        className={`print-hide ${occPillClasses(occView === 'weekly')}`}
                                        onClick={() => setOccView('weekly')}
                                        aria-pressed={occView === 'weekly'}
                                    >
                                        Semana
                                    </button>
                                    {globalPeriod === 'custom' && customStart && customEnd && (
                                        <button
                                            type="button"
                                            className={`print-hide ${occPillClasses(occView === 'custom')}`}
                                            onClick={() => setOccView('custom')}
                                            aria-pressed={occView === 'custom'}
                                        >
                                            Rango
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                        {isLoading ? <Spinner /> : (
                            <div className="flex items-center justify-center py-4">
                                <div className="zs-occ-strip gap-5">
                                    <RadialRing value={occ} size={80} color={occColor} />
                                    <div className="zs-occ-strip__copy">
                                        <p className="zs-occ-strip__title text-[16px]">
                                            {occ > 75 ? 'Alta demanda' : occ > 45 ? 'Carga media' : 'Baja ocupación'}
                                        </p>
                                        <p className="zs-occ-strip__sub">
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
                            <div className={EMPTY_CLASSES}>
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
                            <div className={EMPTY_CLASSES}>
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
                                <div className="w-12 h-12 rounded-full bg-[rgba(5,150,105,0.10)] flex items-center justify-center shrink-0 text-[#059669]">
                                    <Icon name="globe" size={24} />
                                </div>
                                <div className="zs-occ-strip__copy">
                                    <p className="zs-occ-strip__title">{data?.bookingSources.web ?? 0} desde la Web</p>
                                    <p className="zs-occ-strip__sub">
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
                        <div className={EMPTY_CLASSES}>
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
                    <Link href="/pacientes" className="btn btn--primary w-full text-center">
                        Ver todos los pacientes
                    </Link>
                </div>

            </section>
        </div>
    );
}
