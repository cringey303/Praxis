import React, { InputHTMLAttributes } from 'react';

interface FloatingLabelInputProps extends InputHTMLAttributes<HTMLInputElement> {
    label: string;
}

export const FloatingLabelInput = React.forwardRef<HTMLInputElement, FloatingLabelInputProps>(
    ({ label, className, ...props }, ref) => {
        return (
            <div className="relative">
                <input
                    {...props}
                    ref={ref}
                    placeholder=" " // Important for :placeholder-shown to work, but we want it invisible
                    className={`peer block w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm 
            text-foreground placeholder-transparent
            focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary 
            disabled:cursor-not-allowed disabled:opacity-50
            ${className}`}
                />
                <label
                    htmlFor={props.id}
                    className="absolute left-2 top-2 z-10 origin-left -translate-y-5 scale-75 transform bg-background px-2 text-sm text-muted-foreground duration-300 
            peer-placeholder-shown:top-2 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 
            peer-focus:-translate-y-5 peer-focus:scale-75 peer-focus:px-2 peer-focus:text-primary cursor-text"
                >
                    {label}
                </label>
            </div>
        );
    }
);

FloatingLabelInput.displayName = 'FloatingLabelInput';
