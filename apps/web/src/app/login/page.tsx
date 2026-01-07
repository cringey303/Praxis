'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { FloatingLabelInput } from "@/components/ui/FloatingLabelInput";


export default function LoginPage() {
    const router = useRouter();

    const [formData, setFormData] = useState({
        email: '',
        password: '',
    });

    const [status, setStatus] = useState<{ error: boolean; msg: string } | null>(null);
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
        setStatus(null);

        try {
            const res = await fetch('http://localhost:8080/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            if (!res.ok) {
                const errorText = await res.text();
                throw new Error(errorText || 'Login failed');
            }

            setStatus({ error: false, msg: 'Login successful! Redirecting...' });
            setTimeout(() => router.push('/'), 2000);
        } catch (err: any) {
            setStatus({ error: true, msg: err.message });
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

                {/* Status Message */}
                {status && (
                    <div className={`p-3 rounded-md text-sm font-medium border ${status.error
                        ? 'bg-destructive/10 text-destructive border-destructive/20'
                        : 'bg-green-500/10 text-green-500 border-green-500/20'
                        }`}>
                        {status.msg}
                    </div>
                )}

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

                <div className="text-center text-sm text-brand">
                    Don't have an account?{' '}
                    <a href="/signup" className="underline underline-offset-4 hover:text-primary">
                        Sign up
                    </a>
                </div>
            </div>
        </div>
    );
}