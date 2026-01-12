'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { FloatingLabelInput } from "@/components/ui/FloatingLabelInput";
import { useToast } from "@/components/ui/Toast";


export default function LoginPage() {
    const router = useRouter();

    const [formData, setFormData] = useState({
        email: '',
        password: '',
    });

    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<{ [key: string]: string }>({});


    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        if (errors[e.target.name]) {
            setErrors({ ...errors, [e.target.name]: '' });
        }
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        const { name, value } = e.target;

        // Email Validation
        if (name === 'email' && value) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(value)) {
                setErrors((prev) => ({ ...prev, email: 'Please enter a valid email address.' }));
            }
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(formData),
            });

            if (!res.ok) {
                const errorText = await res.text();
                throw new Error(errorText || 'Login failed');
            }

            showToast('Login successful! Redirecting...', 'success');
            setTimeout(() => router.push('/dashboard'), 2000);
        } catch (err: any) {
            showToast(err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-background text-foreground transition-colors duration-300">
            {/* Main Card Container */}
            <div className="w-full max-w-md space-y-8 bg-card p-8 rounded-xl border border-border shadow-lg">

                {/* Header */}
                <div className="text-center space-y-2">
                    <h1 className="text-3xl tracking-tight">Sign in to Praxis</h1>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-4">

                        <div className="space-y-4">
                            <FloatingLabelInput
                                id="email"
                                name="email"
                                type="email"
                                label="Email"
                                value={formData.email}
                                required
                                onChange={handleChange}
                                onBlur={handleBlur}
                                error={errors.email}
                            />
                            <FloatingLabelInput
                                id="password"
                                name="password"
                                type="password"
                                label="Password"
                                value={formData.password}
                                required
                                onChange={handleChange}
                                onBlur={handleBlur}
                                error={errors.password}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="cursor-pointer inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 w-full"
                    >
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>

                <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-card px-2 text-muted-foreground">
                            OR
                        </span>
                    </div>
                </div>

                {/* Google Login Button */}
                <a
                    href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/auth/google/login`}
                    className="flex w-full items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                    <svg className="h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                        <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
                    </svg>
                    Continue with Google
                </a>

                <div className="text-center text-sm text-brand">
                    Don't have an account?{' '}
                    <a href="/signup" className="underline underline-offset-4 hover:text-primary/90">
                        Sign up
                    </a>
                </div>
            </div>
        </div>
    );
}