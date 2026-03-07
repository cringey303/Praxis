import React, { useState, forwardRef } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input, InputProps } from './input';

const PasswordInput = forwardRef<HTMLInputElement, InputProps>(
    ({ className, ...props }, ref) => {
        const [showPassword, setShowPassword] = useState(false);

        return (
            <div className="relative">
                <Input
                    type={showPassword ? 'text' : 'password'}
                    className={`pr-10 ${className || ''}`}
                    ref={ref}
                    {...props}
                />
                <button
                    type="button"
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowPassword((prev) => !prev)}
                >
                    {showPassword ? (
                        <EyeOff className="h-4 w-4" aria-hidden="true" />
                    ) : (
                        <Eye className="h-4 w-4" aria-hidden="true" />
                    )}
                    <span className="sr-only">
                        {showPassword ? 'Hide password' : 'Show password'}
                    </span>
                </button>
            </div>
        );
    }
);

PasswordInput.displayName = 'PasswordInput';

export { PasswordInput };
