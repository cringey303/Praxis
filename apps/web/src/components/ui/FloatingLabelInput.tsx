import React, { InputHTMLAttributes, useState } from 'react';

interface FloatingLabelInputProps extends InputHTMLAttributes<HTMLInputElement> {
    label: string;
    error?: string;
}

export const FloatingLabelInput = React.forwardRef<HTMLInputElement, FloatingLabelInputProps>(
    ({ label, className, type, error, ...props }, ref) => {
        const [showPassword, setShowPassword] = useState(false);
        const isPassword = type === 'password';

        return (
            <div className="relative">
                <input
                    type={isPassword ? (showPassword ? 'text' : 'password') : type}
                    {...props}
                    ref={ref}
                    placeholder=" " // Important for :placeholder-shown to work, but we want it invisible
                    className={`peer block w-full rounded-md border bg-transparent px-3 py-2 text-sm 
            text-foreground placeholder-transparent
            ${error
                            ? 'border-destructive-foreground focus:border-destructive-foreground focus:ring-destructive-foreground'
                            : 'border-input focus:border-primary focus:ring-primary'
                        } 
            focus:outline-none focus:ring-1 
            disabled:cursor-not-allowed disabled:opacity-50
            ${isPassword ? 'pr-10' : ''}
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
                {isPassword && (
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-muted-foreground hover:text-foreground focus:outline-none"
                    >
                        {showPassword ? (
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="h-4 w-4"
                            >
                                <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                                <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                                <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                                <line x1="2" x2="22" y1="2" y2="22" />
                            </svg>
                        ) : (
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="h-4 w-4"
                            >
                                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                                <circle cx="12" cy="12" r="3" />
                            </svg>
                        )}
                    </button>
                )}
                {error && (
                    <p className="mt-1 text-xs text-destructive">{error}</p>
                )}
            </div>
        );
    }
);

FloatingLabelInput.displayName = 'FloatingLabelInput';
