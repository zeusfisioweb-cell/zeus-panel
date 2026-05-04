import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
}

export function Card({ className = '', children, ...props }: CardProps) {
    return (
        <div
            className={`card mb-0 ${className}`}
            {...props}
        >
            {children}
        </div>
    );
}

export function CardHeader({ className = '', children, ...props }: CardProps) {
    return (
        <div className={`card__header ${className}`} {...props}>
            {children}
        </div>
    );
}

export function CardTitle({ className = '', children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
    return (
        <h3 className={`card__title ${className}`} {...props}>
            {children}
        </h3>
    );
}

export function CardDescription({ className = '', children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
    return (
        <p className={`text-sm text-gray-500 mt-1.5 ${className}`} {...props}>
            {children}
        </p>
    );
}

export function CardContent({ className = '', children, ...props }: CardProps) {
    return (
        <div className={`card__body ${className}`} {...props}>
            {children}
        </div>
    );
}

export function CardFooter({ className = '', children, ...props }: CardProps) {
    return (
        <div className={`p-6 pt-0 flex items-center ${className}`} {...props}>
            {children}
        </div>
    );
}
