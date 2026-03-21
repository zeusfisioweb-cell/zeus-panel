import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    icon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className = '', label, error, icon, ...props }, ref) => {
        return (
            <div className="flex flex-col gap-1 w-full">
                {label && (
                    <label className="text-sm font-medium text-[var(--text-muted)]">
                        {label} {props.required && <span className="text-red-500">*</span>}
                    </label>
                )}
                <div className="relative">
                    {icon && (
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                            {icon}
                        </div>
                    )}
                    <input
                        ref={ref}
                        className={`
                            flex w-full form-input
                            disabled:cursor-not-allowed disabled:opacity-50
                            ${icon ? 'pl-10' : ''}
                            ${error ? 'border-red-500 focus:ring-red-500' : ''}
                            ${className}
                        `}
                        {...props}
                    />
                </div>
                {error && <span className="text-xs text-red-500 mt-1">{error}</span>}
            </div>
        );
    }
);

Input.displayName = 'Input';
