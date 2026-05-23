import React, { useEffect, useState, useId } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import Icon from './Icon';

interface QRModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function QRModal({ isOpen, onClose }: QRModalProps) {
    const [bookingUrl, setBookingUrl] = useState('');
    const titleId = useId();

    useEffect(() => {
        setBookingUrl('https://zeusfisioterapiatorrijos.com/portal/login?returnUrl=%2F');
    }, []);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) onClose();
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div
            className="modal-overlay"
            onClick={handleBackdropClick}
        >
            <div
                className="modal flex flex-col"
                style={{ maxWidth: 460 }}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
            >
                {/* Header */}
                <div className="modal__header shrink-0">
                    <h3 id={titleId} className="modal__title flex items-center gap-2">
                        <Icon name="qr-code" size={18} className="text-[var(--text-primary)]" />
                        Código QR de Citas
                    </h3>
                    <button
                        className="modal__close"
                        onClick={onClose}
                        aria-label="Cerrar modal"
                    >
                        <Icon name="x" size={18} />
                    </button>
                </div>

                {/* Content - Print Area */}
                <div id="print-qr-area" className="modal__body flex flex-col items-center justify-center pt-6 pb-6 overflow-y-auto">
                    <div className="text-center mb-6 print:mb-8">
                        <h3 className="text-2xl font-bold text-[var(--zeus-accent-strong)] font-[var(--font-zeus-display,inherit)] !m-0">
                            ZEUS Fisioterapia
                        </h3>
                        <p className="text-[13px] text-[var(--text-secondary)] uppercase tracking-[1.5px] mt-1 !mb-0">
                            Escanea para reservar
                        </p>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-[var(--border-color)] w-full max-w-[220px] aspect-square flex items-center justify-center mx-auto"
                        style={{ boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}
                    >
                        {bookingUrl ? (
                            <QRCodeSVG
                                value={bookingUrl}
                                size={1000}
                                className="w-full h-auto block"
                                level="H"
                                fgColor="#201610"
                                bgColor="#ffffff"
                                imageSettings={{
                                    src: "/zeusheader.webp",
                                    height: 24,
                                    width: 80,
                                    excavate: true,
                                }}
                            />
                        ) : (
                            <p className="text-xs text-center text-[var(--text-muted)]">
                                Configura <code>NEXT_PUBLIC_PORTAL_URL</code> para generar el QR.
                            </p>
                        )}
                    </div>

                </div>

                {/* Footer Actions */}
                <div className="modal__footer print:hidden shrink-0 flex justify-end gap-3 p-4">
                    <button className="btn btn--secondary !m-0" onClick={onClose}>
                        Cancelar
                    </button>
                    <button
                        className="btn btn--primary flex items-center gap-2 !m-0"
                        onClick={handlePrint}
                    >
                        <Icon name="printer" size={16} />
                        Imprimir QR
                    </button>
                </div>

                {/* Print styles */}
                <style dangerouslySetInnerHTML={{__html: `
                    @media print {
                        body * {
                            visibility: hidden;
                        }
                        #print-qr-area, #print-qr-area * {
                            visibility: visible;
                        }
                        #print-qr-area {
                            position: absolute;
                            left: 50%;
                            top: 40%;
                            transform: translate(-50%, -50%);
                            width: 100%;
                        }
                    }
                `}} />
            </div>
        </div>
    );
}
