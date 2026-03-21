'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | 'full';
}

export function Modal({ isOpen, onClose, title, children, maxWidth = 'md' }: ModalProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!mounted || !isOpen) return null;

    const maxWidthClasses = {
        sm: 'max-w-sm',
        md: 'max-w-md',
        lg: 'max-w-lg',
        xl: 'max-w-xl',
        '2xl': 'max-w-2xl',
        '3xl': 'max-w-3xl',
        '4xl': 'max-w-4xl',
        '5xl': 'max-w-5xl',
        full: 'max-w-full m-4'
    };

    return createPortal(
        <div className="modal-overlay">
            {/* Backdrop */}
            <div
                className="modal-backdrop"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div
                className={`modal modal--${maxWidth}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-title"
            >
                {/* Header */}
                <div className="modal__header">
                    <h2 id="modal-title" className="modal__title">
                        {title}
                    </h2>
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
                <div className="modal__body">
                    {children}
                </div>
            </div>
        </div>,
        document.body
    );
}
