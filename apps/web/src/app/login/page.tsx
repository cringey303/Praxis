'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { FloatingLabelInput } from "@/components/ui/FloatingLabelInput";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/button";
import { startAuthentication } from '@simplewebauthn/browser';
import { Loader2, Key } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

export default function LoginPage() {
    const router = useRouter();
    const { showToast } = useToast();

    const [formData, setFormData] = useState({
        email: '',
        password: '',
    });

    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<{ [key: string]: string }>({});

    // 2FA state
    const [requires2FA, setRequires2FA] = useState(false);
    const [totpCode, setTotpCode] = useState('');
    const [verifying2FA, setVerifying2FA] = useState(false);

    // Passkey state
    const [authenticatingPasskey, setAuthenticatingPasskey] = useState(false);

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
            const res = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(formData),
            });

            if (!res.ok) {
                const errorText = await res.text();
                throw new Error(errorText || 'Login failed');
            }

            const data = await res.json();

            if (data.requires_2fa) {
                setRequires2FA(true);
                showToast('Please enter your 2FA code.', 'info');
            } else {
                showToast('Login successful! Redirecting...', 'success');
                setTimeout(() => router.push('/dashboard'), 1500);
            }
        } catch (err: unknown) {
            if (err instanceof Error) {
                showToast(err.message, 'error');
            } else {
                showToast('Login failed', 'error');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleVerify2FA = async (e: FormEvent) => {
        e.preventDefault();

        if (!totpCode || totpCode.length !== 6) {
            showToast('Please enter a valid 6-digit code.', 'error');
            return;
        }

        setVerifying2FA(true);

        try {
            const res = await fetch(`${API_URL}/auth/totp/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ code: totpCode }),
            });

            if (!res.ok) {
                throw new Error('Invalid code');
            }

            showToast('Login successful! Redirecting...', 'success');
            setTimeout(() => router.push('/dashboard'), 1500);
        } catch (err) {
            showToast('Invalid code. Please try again.', 'error');
            setTotpCode('');
        } finally {
            setVerifying2FA(false);
        }
    };

    const handlePasskeyLogin = async () => {
        setAuthenticatingPasskey(true);

        try {
            // Start passkey authentication
            const startRes = await fetch(`${API_URL}/auth/passkey/auth/start`, {
                method: 'POST',
                credentials: 'include',
            });

            if (!startRes.ok) {
                const text = await startRes.text();
                if (text.includes('No passkeys registered')) {
                    showToast('No passkeys available. Please sign in with password.', 'error');
                    return;
                }
                throw new Error('Failed to start passkey authentication');
            }

            const data = await startRes.json();

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const options = (data as any).publicKey || (data as any).public_key || data;

            // Use browser API
            const credential = await startAuthentication(options);

            // Finish authentication
            const finishRes = await fetch(`${API_URL}/auth/passkey/auth/finish`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ credential }),
            });

            if (!finishRes.ok) {
                const errorText = await finishRes.text();
                console.error('Passkey authentication finish error:', finishRes.status, errorText);
                throw new Error(errorText || 'Authentication failed');
            }

            showToast('Login successful! Redirecting...', 'success');
            setTimeout(() => router.push('/dashboard'), 1500);
        } catch (err: unknown) {
            console.error('Passkey login error:', err);
            if (err instanceof Error && err.name === 'NotAllowedError') {
                showToast('Passkey authentication was cancelled.', 'error');
            } else {
                showToast('Failed to authenticate with passkey.', 'error');
            }
        } finally {
            setAuthenticatingPasskey(false);
        }
    };

    // 2FA Verification Screen
    if (requires2FA) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-background text-foreground transition-colors duration-300">
                <div className="w-full max-w-md space-y-8 bg-card p-8 rounded-xl border border-border shadow-lg">
                    <div className="text-center space-y-2">
                        <h1 className="text-3xl tracking-tight">Two-Factor Authentication</h1>
                        <p className="text-sm text-muted-foreground">
                            Enter the 6-digit code from your authenticator app or a backup code.
                        </p>
                    </div>

                    <form onSubmit={handleVerify2FA} className="space-y-6">
                        <div>
                            <input
                                type="text"
                                value={totpCode}
                                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                placeholder="000000"
                                className="w-full px-4 py-3 bg-secondary border border-border rounded-lg text-center text-2xl font-mono tracking-[0.5em]"
                                maxLength={6}
                                autoFocus
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={verifying2FA || totpCode.length !== 6}
                            className="cursor-pointer inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 w-full gap-2"
                        >
                            {verifying2FA && <Loader2 className="h-4 w-4 animate-spin" />}
                            {verifying2FA ? 'Verifying...' : 'Verify'}
                        </button>
                    </form>

                    <button
                        onClick={() => {
                            setRequires2FA(false);
                            setTotpCode('');
                            setFormData({ email: '', password: '' });
                        }}
                        className="cursor-pointer w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                        ← Back to login
                    </button>
                </div>
            </div>
        );
    }

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


                        <div className="">
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
                                className="mb-4"
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
                            <div className="flex justify-end mt-1">
                                <a
                                    href="/forgot-password"
                                    className="text-sm text-muted-foreground hover:text-foreground hover:underline"
                                >
                                    Forgot password?
                                </a>
                            </div>
                        </div>
                    </div>

                    <Button
                        type="submit"
                        disabled={loading}
                        className="w-full gap-2"
                    >
                        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                        {loading ? 'Signing in...' : 'Sign In'}
                    </Button>
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

                <div className="space-y-3">
                    {/* Passkey Login Button */}
                    <Button
                        variant="outline"
                        onClick={handlePasskeyLogin}
                        disabled={authenticatingPasskey}
                        className="w-full gap-2"
                    >
                        {authenticatingPasskey ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Key className="h-4 w-4" />
                        )}
                        Sign in with Passkey
                    </Button>

                    {/* Google Login Button */}
                    <Button
                        variant="outline"
                        asChild
                        className="w-full gap-2"
                    >
                        <a href={`${API_URL}/auth/google/login`}>
                            <svg className="h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                                <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
                            </svg>
                            Continue with Google
                        </a>
                    </Button>

                    <Button
                        variant="outline"
                        asChild
                        className="w-full gap-2"
                    >
                        <a href={`${API_URL}/auth/github/login`}>
                            <svg className="h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="github" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                                <path fill="currentColor" d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-1.334-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"></path>
                            </svg>
                            Continue with GitHub
                        </a>
                    </Button>
                </div>

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