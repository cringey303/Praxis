import React, { InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface FloatingLabelInputProps extends InputHTMLAttributes<HTMLInputElement> {
    label: string;
    error?: string;
    wrapperClassName?: string;
}

export const FloatingLabelInput = React.forwardRef<HTMLInputElement, FloatingLabelInputProps>(
    ({ label, className, wrapperClassName, error, maxLength, value, id, type, ...props }, ref) => {
        const [showPassword, setShowPassword] = React.useState(false);
        const isPassword = type === 'password';
        const currentLength = typeof value === 'string' ? value.length : 0;
        // Generate a unique ID if not provided, to link label and input
        const inputId = id || `floating-input-${label.replace(/\s+/g, '-').toLowerCase()}-${Math.random().toString(36).substr(2, 9)}`;

        const togglePassword = () => {
            setShowPassword((prev) => !prev);
        };

        return (
            <div className={cn("w-full mb-6", wrapperClassName)}>
                <div className="relative h-10 w-full">
                    <input
                        {...props}
                        id={inputId}
                        ref={ref}
                        value={value}
                        type={isPassword ? (showPassword ? 'text' : 'password') : type}
                        maxLength={maxLength}
                        placeholder=" " // Important for :placeholder-shown to work
                        className={cn(
                            "peer h-full w-full rounded-md border bg-transparent px-3 py-2 text-sm text-foreground",
                            "placeholder-transparent focus:outline-none focus:ring-1 disabled:cursor-not-allowed disabled:opacity-50",
                            isPassword ? "pr-10" : "",
                            error
                                ? "border-destructive-foreground focus:border-destructive-foreground focus:ring-destructive-foreground"
                                : "border-input focus:border-primary focus:ring-primary",
                            className
                        )}
                    />
                    <label
                        htmlFor={inputId}
                        className={cn(
                            "absolute left-2 top-2 z-10 origin-left -translate-y-5 scale-75 transform bg-background px-2 text-sm duration-300 cursor-text",
                            "peer-placeholder-shown:top-2 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100",
                            "peer-focus:-translate-y-5 peer-focus:scale-75 peer-focus:px-2",
                            error
                                ? "text-destructive peer-focus:text-destructive"
                                : "text-muted-foreground peer-focus:text-primary"
                        )}
                    >
                        {label}
                    </label>
                    {isPassword && (
                        <button
                            type="button"
                            onClick={togglePassword}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                            tabIndex={-1}
                        >
                            {showPassword ? (
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><line x1="2" y1="2" x2="22" y2="22" /></svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
                            )}
                        </button>
                    )}
                    {maxLength && !isPassword && (
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                            {currentLength}/{maxLength}
                        </div>
                    )}
                </div>
                {error && (
                    <p className="mt-1 text-xs text-destructive">{error}</p>
                )}
            </div>
        );
    }
);

FloatingLabelInput.displayName = 'FloatingLabelInput';
