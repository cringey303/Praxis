'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation'; // used for redirecting
import { FloatingLabelInput } from "@/components/ui/FloatingLabelInput";

export default function SignupPage() {
    const router = useRouter();

    const [formData, setFormData] = useState({
        username: '',
        display_name: '',
        email: '',
        password: '',
    });

    // status holds success/error messages
    const [status, setStatus] = useState<{ error: boolean; msg: string } | null>(null);
    // loading disables the submit button
    const [loading, setLoading] = useState(false);
    // field-level errors
    const [errors, setErrors] = useState<{ [key: string]: string }>({});

    // helper function that updates the form e.target.name with e.target.value
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let { name, value } = e.target;
        if (name === 'username') {
            value = value.toLowerCase();
        }
        setFormData({ ...formData, [name]: value });

        // Password validation on change
        if (name === 'password') {
            if (value.length < 6) {
                setErrors((prev) => ({ ...prev, password: 'Password must be at least 6 characters.' }));
            } else {
                setErrors((prev) => ({ ...prev, password: '' }));
            }
        } else {
            // Clear error when user types for other fields
            if (errors[name]) {
                setErrors((prev) => ({ ...prev, [name]: '' }));
            }
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

    // called when the form is submitted
    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault(); // prevent full-page refresh

        // Check for any existing errors before submitting
        const hasErrors = Object.values(errors).some(err => err);
        if (hasErrors) return;

        setLoading(true); // disable the submit button
        setStatus(null); // clear any previous status messages and display "Creating Account..."

        try {
            // send data to the backend
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/auth/signup`, {
                method: 'POST', // prepares the backend for new data
                headers: { 'Content-Type': 'application/json' }, // prepares backend to accept JSON format
                credentials: 'include',
                body: JSON.stringify(formData), // send form data as JSON
            });

            if (!res.ok) { // if the request failed
                const errorText = await res.text(); // get error message
                throw new Error(errorText || 'Signup failed');
            }

            setStatus({ error: false, msg: 'Account created! Redirecting...' }); // display success message
            setTimeout(() => router.push('/dashboard'), 1000); // redirect to home page in 1sec
        } catch (err: any) {
            setStatus({ error: true, msg: err.message }); // display error message
        } finally {
            setLoading(false); // enable the submit button
        }
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-background text-foreground transition-colors duration-300">
            {/* Main Card Container */}
            <div className="w-full max-w-md space-y-8 bg-card p-8 rounded-xl border border-border shadow-lg">

                {/* Header */}
                <div className="text-center space-y-2">
                    <h1 className="text-3xl tracking-tight">Join Praxis</h1>
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
                                id="username"
                                name="username"
                                type="text"
                                label="Username"
                                value={formData.username}
                                required
                                onChange={handleChange}
                                onBlur={handleBlur}
                                error={errors.username}
                                maxLength={20}
                            />
                            <FloatingLabelInput
                                id="display_name"
                                name="display_name"
                                type="text"
                                label="Display Name"
                                value={formData.display_name}
                                required
                                onChange={handleChange}
                                onBlur={handleBlur}
                                error={errors.display_name}
                                maxLength={20}
                            />
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
                        {loading ? 'Creating Account...' : 'Sign Up'}
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

                <div className="space-y-4">
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

                    <a
                        href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/auth/github/login`}
                        className="flex w-full items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                        <svg className="h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="github" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                            <path fill="currentColor" d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"></path>
                        </svg>
                        Continue with GitHub
                    </a>
                </div>

                <div className="text-center text-sm text-brand">
                    Already have an account?{' '}
                    <a href="/login" className="underline underline-offset-4 hover:text-primary/90">
                        Sign in
                    </a>
                </div>
            </div>
        </div>
    );
}