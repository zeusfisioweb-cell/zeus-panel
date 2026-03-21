import { useState } from 'react';
import { toast } from 'sonner';
import { Appointment } from '@/lib/types';
import { format } from 'date-fns';

interface UseCitasDragDropProps {
    updateCita: { mutateAsync: (args: any) => Promise<any> };
}

export function useCitasDragDrop({ updateCita }: UseCitasDragDropProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [draggedAppointment, setDraggedAppointment] = useState<Appointment | null>(null);

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, apt: Appointment) => {
        setDraggedAppointment(apt);
        setIsDragging(true);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', apt.id);

        const el = e.currentTarget.cloneNode(true) as HTMLElement;
        el.style.opacity = '0.7';
        el.style.position = 'absolute';
        el.style.top = '-1000px';
        document.body.appendChild(el);
        try {
            e.dataTransfer.setDragImage(el, 20, 20);
        } finally {
            setTimeout(() => {
                if (el.parentNode) document.body.removeChild(el);
            }, 0);
        }
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDropTimeline = async (
        e: React.DragEvent<HTMLDivElement>,
        targetDate: Date,
        timelineStart: number,
        timelineEnd: number,
        slotInterval: number
    ) => {
        e.preventDefault();
        setIsDragging(false);
        if (!draggedAppointment) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const percent = Math.max(0, Math.min(1, y / rect.height));

        const totalMinutes = timelineEnd - timelineStart;
        const droppedMinutes = timelineStart + (percent * totalMinutes);
        const snappedMinutes = Math.round(droppedMinutes / slotInterval) * slotInterval;

        const newStart = new Date(targetDate);
        newStart.setHours(Math.floor(snappedMinutes / 60), snappedMinutes % 60, 0, 0);

        const origStart = new Date(draggedAppointment.start_time);
        const origEnd = new Date(draggedAppointment.end_time);
        const durationMs = origEnd.getTime() - origStart.getTime();
        const newEnd = new Date(newStart.getTime() + durationMs);

        const updatePromise = updateCita.mutateAsync({
            id: draggedAppointment.id,
            start_time: newStart.toISOString(),
            end_time: newEnd.toISOString()
        });

        toast.promise(updatePromise, {
            loading: 'Reprogramando...',
            success: 'Cita reprogramada',
            error: 'Error al reprogramar'
        });
        setDraggedAppointment(null);
    };

    const handleDropWeek = async (e: React.DragEvent<HTMLDivElement>, targetDate: Date) => {
        e.preventDefault();
        setIsDragging(false);
        if (!draggedAppointment) return;

        const oldStart = new Date(draggedAppointment.start_time);
        const newStart = new Date(targetDate);
        newStart.setHours(oldStart.getHours(), oldStart.getMinutes(), 0, 0);

        const oldEnd = new Date(draggedAppointment.end_time);
        const durationMs = oldEnd.getTime() - oldStart.getTime();
        const newEnd = new Date(newStart.getTime() + durationMs);

        const updatePromise = updateCita.mutateAsync({
            id: draggedAppointment.id,
            start_time: newStart.toISOString(),
            end_time: newEnd.toISOString()
        });

        toast.promise(updatePromise, {
            loading: 'Moviendo de día...',
            success: 'Cita movida',
            error: 'Error al mover'
        });
        setDraggedAppointment(null);
    };

    return {
        isDragging,
        setIsDragging,
        draggedAppointment,
        setDraggedAppointment,
        handleDragStart,
        handleDragOver,
        handleDropTimeline,
        handleDropWeek
    };
}
