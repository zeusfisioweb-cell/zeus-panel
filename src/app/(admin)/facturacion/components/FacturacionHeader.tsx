'use client';

import Icon from '@/components/Icon';
import { Button } from '@/components/ui/Button';

interface FacturacionHeaderProps {
    todayTotal: number;
    weekTotal: number;
    monthTotal: number;
    paymentsCount: number;
    onNewPayment: () => void;
    onExportCsv: () => void;
}

function formatEuro(value: number): string {
    return new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
    }).format(value);
}

export function FacturacionHeader({
    todayTotal,
    weekTotal,
    monthTotal,
    paymentsCount,
    onNewPayment,
    onExportCsv,
}: FacturacionHeaderProps) {
    const kpis = [
        { label: 'Caja hoy', value: formatEuro(todayTotal), tone: 'canela', icon: 'wallet' },
        { label: 'Esta semana', value: formatEuro(weekTotal), tone: 'neutral', icon: 'chart' },
        { label: 'Este mes', value: formatEuro(monthTotal), tone: 'success', icon: 'scale' },
        { label: 'Cobros', value: paymentsCount, tone: 'warning', icon: 'receipt' },
    ] as const;

    return (
        <header className="zs-svc-header">
            <div className="zs-svc-header__top">
                <div className="zs-svc-header__actions">
                    <Button
                        variant="secondary"
                        onClick={onExportCsv}
                        leftIcon={<Icon name="download" size={15} />}
                    >
                        <span className="hidden sm:inline">Exportar CSV</span>
                        <span className="sm:hidden">CSV</span>
                    </Button>
                    <Button variant="primary" onClick={onNewPayment} leftIcon={<Icon name="plus" size={15} />}>
                        Registrar cobro
                    </Button>
                </div>
            </div>

            <div className="zs-svc-kpi-strip">
                {kpis.map((k) => (
                    <div key={k.label} className={`zs-svc-kpi zs-svc-kpi--${k.tone}`}>
                        <div className="zs-svc-kpi__top">
                            <p className="zs-svc-kpi__label">{k.label}</p>
                            <span className="zs-svc-kpi__icon">
                                <Icon name={k.icon} size={16} />
                            </span>
                        </div>
                        <p className="zs-svc-kpi__value">{k.value}</p>
                    </div>
                ))}
            </div>
        </header>
    );
}
