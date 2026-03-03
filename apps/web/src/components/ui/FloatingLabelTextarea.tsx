import React, { TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface FloatingLabelTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
    label: string;
    error?: string;
    wrapperClassName?: string;
}

export const FloatingLabelTextarea = React.forwardRef<HTMLTextAreaElement, FloatingLabelTextareaProps>(
    ({ label, className, wrapperClassName, error, maxLength, value, id, ...props }, ref) => {
        const currentLength = typeof value === 'string' ? value.length : 0;
        // Generate a unique ID if not provided, to link label and textarea
        const inputId = id || `floating-textarea-${label.replace(/\s+/g, '-').toLowerCase()}-${Math.random().toString(36).substr(2, 9)}`;

        return (
            <div className={cn("w-full", wrapperClassName)}>
                <div className="relative h-full flex flex-col">
                    <textarea
                        {...props}
                        id={inputId}
                        ref={ref}
                        value={value}
                        maxLength={maxLength}
                        placeholder=" " // Important for :placeholder-shown to work
                        className={cn(
                            "peer block w-full rounded-md border bg-transparent px-3 py-2 text-sm text-foreground placeholder-transparent focus:outline-none focus:ring-1 disabled:cursor-not-allowed disabled:opacity-50 resize-none",
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
                    {maxLength && (
                        <div className="absolute bottom-2 right-2 text-xs text-muted-foreground pointer-events-none flex justify-end">
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

FloatingLabelTextarea.displayName = 'FloatingLabelTextarea';
