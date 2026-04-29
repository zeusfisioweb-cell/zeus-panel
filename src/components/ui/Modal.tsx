'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | 'full';
    bodyClassName?: string;
}

export function Modal({
    isOpen,
    onClose,
    title,
    children,
    maxWidth = 'md',
    bodyClassName = '',
}: ModalProps) {
    const [mounted, setMounted] = useState(false);
    const dialogRef = useRef<HTMLDivElement>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);
    const titleId = React.useId();

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (isOpen) {
            previousFocusRef.current = document.activeElement as HTMLElement | null;
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;

        const dialogNode = dialogRef.current;
        if (!dialogNode) return;

        const selector =
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

        const focusables = Array.from(dialogNode.querySelectorAll<HTMLElement>(selector)).filter(
            (node) => !node.hasAttribute('disabled') && node.getAttribute('aria-hidden') !== 'true'
        );

        if (focusables.length > 0) {
            focusables[0].focus();
        } else {
            dialogNode.focus();
        }

        const handleKeydown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
                return;
            }

            if (event.key !== 'Tab') return;

            const currentFocusables = Array.from(dialogNode.querySelectorAll<HTMLElement>(selector)).filter(
                (node) => !node.hasAttribute('disabled') && node.getAttribute('aria-hidden') !== 'true'
            );

            if (currentFocusables.length === 0) {
                event.preventDefault();
                dialogNode.focus();
                return;
            }

            const first = currentFocusables[0];
            const last = currentFocusables[currentFocusables.length - 1];
            const activeElement = document.activeElement as HTMLElement | null;

            if (event.shiftKey && activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };

        document.addEventListener('keydown', handleKeydown);

        return () => {
            document.removeEventListener('keydown', handleKeydown);
            previousFocusRef.current?.focus();
        };
    }, [isOpen, onClose]);

    if (!mounted || !isOpen) return null;

    return createPortal(
        <div className="modal-overlay">
            {/* Backdrop */}
            <div
                className="modal-backdrop"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div
                ref={dialogRef}
                className={`modal modal--${maxWidth}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
            >
                {/* Header */}
                <div className="modal__header">
                    <h3 id={titleId} className="modal__title" style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>
                        {title}
                    </h3>
                    <button
                        onClick={onClose}
                        className="modal__close"
                        aria-label="Cerrar modal"
                    >
                        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Body (scrollable) */}
                <div className={`modal__body ${bodyClassName}`.trim()}>
                    {children}
                </div>
            </div>
        </div>,
        document.body
    );
}
