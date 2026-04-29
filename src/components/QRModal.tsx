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
        if (typeof window !== 'undefined') {
            const origin = window.location.origin;
            setBookingUrl(`${origin}/citas.html`);
        }
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
                className="modal" 
                style={{ maxWidth: 460, display: 'flex', flexDirection: 'column' }}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
            >
                {/* Header */}
                <div className="modal__header" style={{ flexShrink: 0 }}>
                    <h3 id={titleId} className="modal__title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Icon name="qr-code" size={18} style={{ color: 'var(--text-primary)' }} />
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
                <div className="modal__body" id="print-qr-area" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 24, paddingBottom: 24, overflowY: 'auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: 24 }} className="print:mb-8">
                        <h3 style={{ fontSize: 24, fontWeight: 'bold', color: 'var(--zeus-accent-strong)', fontFamily: 'var(--font-zeus-display, inherit)', margin: 0 }}>
                            ZEUS Fisioterapia
                        </h3>
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 4, marginBottom: 0 }}>
                            Escanea para reservar
                        </p>
                    </div>

                    <div style={{ 
                        background: '#ffffff', 
                        padding: 16, 
                        borderRadius: 16, 
                        boxShadow: '0 2px 10px rgba(0,0,0,0.05)', 
                        border: '1px solid var(--border-color)',
                        width: '100%', 
                        maxWidth: 220, 
                        aspectRatio: '1 / 1', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        margin: '0 auto'
                    }}>
                        {bookingUrl && (
                            <QRCodeSVG 
                                value={bookingUrl}
                                size={1000}
                                style={{ width: '100%', height: 'auto', display: 'block' }}
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
                        )}
                    </div>
                    
                    <div style={{ 
                        marginTop: 24, 
                        background: 'var(--bg-surface-soft)', 
                        padding: '12px 16px', 
                        borderRadius: 8, 
                        border: '1px solid var(--border-color)', 
                        width: '100%', 
                        textAlign: 'center', 
                        overflow: 'hidden' 
                    }}>
                        <p style={{ 
                            fontSize: 12, 
                            fontFamily: 'monospace', 
                            color: 'var(--text-secondary)', 
                            margin: 0,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            userSelect: 'all'
                        }}>
                            {bookingUrl}
                        </p>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="modal__footer print:hidden" style={{ flexShrink: 0, display: 'flex', justifyContent: 'flex-end', gap: 12, padding: '16px 24px' }}>
                    <button className="btn btn--secondary" onClick={onClose} style={{ margin: 0 }}>
                        Cancelar
                    </button>
                    <button 
                        className="btn btn--primary" 
                        onClick={handlePrint}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}
                    >
                        <Icon name="printer" size={16} />
                        Imprimir QR
                    </button>
                </div>
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
    );
}
