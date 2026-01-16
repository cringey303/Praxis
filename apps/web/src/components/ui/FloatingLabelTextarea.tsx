import React, { TextareaHTMLAttributes } from 'react';

interface FloatingLabelTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
    label: string;
    error?: string;
}

export const FloatingLabelTextarea = React.forwardRef<HTMLTextAreaElement, FloatingLabelTextareaProps>(
    ({ label, className, error, maxLength, value, ...props }, ref) => {
        const currentLength = typeof value === 'string' ? value.length : 0;

        return (
            <div className="w-full">
                <div className="relative">
                    <textarea
                        {...props}
                        ref={ref}
                        value={value}
                        maxLength={maxLength}
                        placeholder=" " // Important for :placeholder-shown to work
                        className={`peer block w-full rounded-md border bg-transparent px-3 py-2 text-sm 
            text-foreground placeholder-transparent
            ${error
                                ? 'border-destructive-foreground focus:border-destructive-foreground focus:ring-destructive-foreground'
                                : 'border-input focus:border-primary focus:ring-primary'
                            } 
            focus:outline-none focus:ring-1 
            disabled:cursor-not-allowed disabled:opacity-50
            resize-none
            ${className}`}
                    />
                    <label
                        htmlFor={props.id}
                        className={`absolute left-2 top-2 z-10 origin-left -translate-y-5 scale-75 transform bg-background px-2 text-sm duration-300 
            peer-placeholder-shown:top-2 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 
            peer-focus:-translate-y-5 peer-focus:scale-75 peer-focus:px-2 
            ${error
                                ? 'text-destructive peer-focus:text-destructive'
                                : 'text-muted-foreground peer-focus:text-primary'
                            }
            cursor-text`}
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
