'use client';

import Icon from '@/components/Icon';

interface ConfirmModalProps {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
    onCancel: () => void;
}

const VARIANT_ICON: Record<string, string> = {
    danger: 'alert-triangle',
    warning: 'alert-triangle',
    info: 'info',
};

const VARIANT_COLOR: Record<string, string> = {
    danger: 'var(--danger)',
    warning: 'var(--warning)',
    info: 'var(--info)',
};

export default function ConfirmModal({
    title,
    message,
    confirmLabel = 'Eliminar',
    cancelLabel = 'Cancelar',
    variant = 'danger',
    onConfirm,
    onCancel,
}: ConfirmModalProps) {
    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
                <div className="modal__header">
                    <h3 className="modal__title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Icon name={VARIANT_ICON[variant]} size={18} style={{ color: VARIANT_COLOR[variant] }} />
                        {title}
                    </h3>
                    <button className="modal__close" onClick={onCancel}>
                        <Icon name="close" size={18} />
                    </button>
                </div>
                <div className="modal__body">
                    <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>{message}</p>
                </div>
                <div className="modal__footer">
                    <button className="btn btn--secondary" onClick={onCancel}>{cancelLabel}</button>
                    <button
                        className={`btn btn--${variant}`}
                        onClick={onConfirm}
                    >
                        <Icon name={variant === 'danger' ? 'trash' : 'check'} size={14} />
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
