"use client";

import { useEffect, useId, useRef } from 'react';
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
    const titleId = useId();
    const descriptionId = useId();
    const dialogRef = useRef<HTMLDivElement>(null);
    const cancelButtonRef = useRef<HTMLButtonElement>(null);
    const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        previouslyFocusedElementRef.current = document.activeElement as HTMLElement | null;
        const dialogNode = dialogRef.current;
        if (!dialogNode) return;

        const raf = window.requestAnimationFrame(() => {
            cancelButtonRef.current?.focus();
            if (document.activeElement === document.body) {
                dialogNode.focus();
            }
        });

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onCancel();
                return;
            }

            if (event.key !== 'Tab') return;

            const focusables = Array.from(
                dialogNode.querySelectorAll<HTMLElement>(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                )
            ).filter((element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true');

            if (focusables.length === 0) {
                event.preventDefault();
                dialogNode.focus();
                return;
            }

            const firstFocusable = focusables[0];
            const lastFocusable = focusables[focusables.length - 1];
            const activeElement = document.activeElement as HTMLElement | null;

            if (event.shiftKey && activeElement === firstFocusable) {
                event.preventDefault();
                lastFocusable.focus();
            } else if (!event.shiftKey && activeElement === lastFocusable) {
                event.preventDefault();
                firstFocusable.focus();
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        return () => {
            window.cancelAnimationFrame(raf);
            document.removeEventListener('keydown', handleKeyDown);
            previouslyFocusedElementRef.current?.focus();
        };
    }, [onCancel]);

    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div
                ref={dialogRef}
                className="modal"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: 420 }}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={descriptionId}
                tabIndex={-1}
            >
                <div className="modal__header">
                    <h3 id={titleId} className="modal__title flex items-center gap-2">
                        <Icon name={VARIANT_ICON[variant]} size={18} style={{ color: VARIANT_COLOR[variant] }} />
                        {title}
                    </h3>
                    <button className="modal__close" onClick={onCancel} aria-label="Cerrar dialogo">
                        <Icon name="close" size={18} />
                    </button>
                </div>
                <div className="modal__body">
                    <p id={descriptionId} className="text-sm text-[var(--text-muted)] leading-relaxed">
                        {message}
                    </p>
                </div>
                <div className="modal__footer">
                    <button ref={cancelButtonRef} className="btn btn--secondary" onClick={onCancel}>
                        {cancelLabel}
                    </button>
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
