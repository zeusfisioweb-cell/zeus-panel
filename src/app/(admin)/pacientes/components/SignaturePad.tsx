'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';

const CANVAS_W = 300;
const CANVAS_H = 100;
const LINE_WIDTH = 2;
const STROKE_COLOR = '#111';
const BG_COLOR = '#fff';

interface SignaturePadProps {
    label: string;
    value: string | null;
    onChange: (dataUrl: string | null) => void;
}

interface Point { x: number; y: number }

/**
 * Captura firma manuscrita con mouse/touch sobre un canvas 300×100. Emite
 * un PNG base64 (`data:image/png;base64,…`) en `onChange` cada vez que el
 * usuario suelta el puntero (un trazo completo). El padre persiste el dataURL
 * en `formData` y el render server-side lo embebe en la caja de firma del PDF.
 */
export function SignaturePad({ label, value, onChange }: SignaturePadProps) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const drawingRef = useRef(false);
    const lastPointRef = useRef<Point | null>(null);
    const hasInkRef = useRef(false);
    const [hasInk, setHasInk] = useState(false);

    const clearCanvas = useCallback((): void => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.fillStyle = BG_COLOR;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = STROKE_COLOR;
        ctx.lineWidth = LINE_WIDTH;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = CANVAS_W;
        canvas.height = CANVAS_H;
        clearCanvas();
        // Hidratar desde value si existe.
        if (value) {
            const img = new Image();
            img.onload = () => {
                const ctx = canvas.getContext('2d');
                if (!ctx) return;
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                hasInkRef.current = true;
                setHasInk(true);
            };
            img.src = value;
        }
    }, [value, clearCanvas]);

    function pointerPosition(event: React.PointerEvent<HTMLCanvasElement>): Point {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        return {
            x: ((event.clientX - rect.left) / rect.width) * canvas.width,
            y: ((event.clientY - rect.top) / rect.height) * canvas.height,
        };
    }

    function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>): void {
        event.preventDefault();
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.setPointerCapture(event.pointerId);
        drawingRef.current = true;
        lastPointRef.current = pointerPosition(event);
    }

    function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>): void {
        if (!drawingRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;
        const point = pointerPosition(event);
        const last = lastPointRef.current ?? point;
        ctx.beginPath();
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(point.x, point.y);
        ctx.stroke();
        lastPointRef.current = point;
        if (!hasInkRef.current) {
            hasInkRef.current = true;
            setHasInk(true);
        }
    }

    function handlePointerUp(event: React.PointerEvent<HTMLCanvasElement>): void {
        if (!drawingRef.current) return;
        drawingRef.current = false;
        lastPointRef.current = null;
        const canvas = canvasRef.current;
        if (!canvas) return;
        if (canvas.hasPointerCapture(event.pointerId)) {
            canvas.releasePointerCapture(event.pointerId);
        }
        if (hasInkRef.current) {
            onChange(canvas.toDataURL('image/png'));
        }
    }

    function handleClear(): void {
        clearCanvas();
        hasInkRef.current = false;
        setHasInk(false);
        onChange(null);
    }

    return (
        <div className="flex flex-col gap-2">
            <span className="form-label">{label}</span>
            <div
                className="rounded-lg border border-dashed border-[var(--border-color)] bg-white p-1 inline-block"
                style={{ width: 'fit-content' }}
            >
                <canvas
                    ref={canvasRef}
                    style={{
                        width: `${CANVAS_W}px`,
                        height: `${CANVAS_H}px`,
                        touchAction: 'none',
                        cursor: 'crosshair',
                    }}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                />
            </div>
            <div className="flex items-center gap-2 text-xs">
                <Button type="button" variant="ghost" size="sm" onClick={handleClear} disabled={!hasInk}>
                    Borrar firma
                </Button>
                <span className="text-[var(--text-secondary)]">
                    {hasInk ? 'Firma capturada' : 'Firma con el ratón o pantalla táctil'}
                </span>
            </div>
        </div>
    );
}
