import React from 'react';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
    variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'outline';
    children: React.ReactNode;
}

export function Badge({ className = '', variant = 'default', children, ...props }: BadgeProps) {
    const variants = {
        default: 'badge-default',
        success: 'badge--confirmed',
        warning: 'badge--pending',
        danger: 'badge--cancelled',
        info: 'badge--completed',
        outline: 'badge-default'
    };

    return (
        <span
            className={`badge ${variants[variant]} ${className}`}
            {...props}
        >
            {children}
        </span>
    );
}
