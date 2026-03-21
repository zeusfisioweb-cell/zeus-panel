import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    isLoading?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    (
        {
            className = '',
            variant = 'primary',
            size = 'md',
            isLoading = false,
            leftIcon,
            rightIcon,
            children,
            disabled,
            type = 'button',
            ...props
        },
        ref
    ) => {
        const baseClass = 'btn';

        const variants = {
            primary: 'btn--primary',
            secondary: 'btn--secondary',
            danger: 'btn--danger',
            ghost: 'btn--ghost'
        };

        const sizes = {
            sm: 'btn--sm',
            md: '', // base size
            lg: 'h-12 px-6 text-lg' // adhoc
        };

        return (
            <button
                ref={ref}
                className={`${baseClass} ${variants[variant]} ${sizes[size]} ${className}`}
                disabled={isLoading || disabled}
                aria-disabled={isLoading || disabled}
                aria-busy={isLoading || undefined}
                data-loading={isLoading ? 'true' : 'false'}
                type={type}
                {...props}
            >
                {isLoading && (
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                )}
                {!isLoading && leftIcon && <span className="mr-2">{leftIcon}</span>}
                {children}
                {!isLoading && rightIcon && <span className="ml-2">{rightIcon}</span>}
            </button>
        );
    }
);

Button.displayName = 'Button';
