'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, ArrowLeft, CheckCircle2, XCircle } from 'lucide-react';
import { FloatingLabelInput } from '@/components/ui/FloatingLabelInput';
import { useToast } from "@/components/ui/Toast";

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

function ResetPasswordContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get('token');

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');
    const { showToast } = useToast();

    if (!token) {
        return (
            <div className="flex flex-col items-center justify-center text-center space-y-4">
                <XCircle className="w-12 h-12 text-red-500" />
                <h2 className="text-xl font-semibold">Invalid Link</h2>
                <p className="text-muted-foreground">
                    This password reset link is invalid or missing a token.
                </p>
                <Link
                    href="/forgot-password"
                    className="text-primary hover:underline"
                >
                    Request a new link
                </Link>
            </div>
        );
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (newPassword.length < 6) {
            showToast('Password must be at least 6 characters', 'error');
            return;
        }

        if (newPassword !== confirmPassword) {
            showToast('Passwords do not match', 'error');
            return;
        }

        setLoading(true);
        setErrorMessage('');

        try {
            const res = await fetch(`${API_URL}/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token,
                    new_password: newPassword
                }),
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(text || 'Failed to reset password');
            }

            setStatus('success');
            setTimeout(() => {
                router.push('/login');
            }, 3000);
        } catch (err) {
            console.error(err);
            setStatus('error');
            if (err instanceof Error) {
                setErrorMessage(err.message);
            } else {
                setErrorMessage('An error occurred. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    if (status === 'success') {
        return (
            <div className="flex flex-col items-center justify-center text-center animate-in fade-in zoom-in duration-300 space-y-6">
                <CheckCircle2 className="w-16 h-16 text-green-500" />
                <div className="space-y-2">
                    <h2 className="text-2xl font-bold">Password Reset Successful!</h2>
                    <p className="text-muted-foreground">
                        Your password has been securely updated.
                    </p>
                </div>
                <Link
                    href="/login"
                    className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors"
                >
                    Proceed to Login
                </Link>
                <p className="text-xs text-muted-foreground">
                    Redirecting automatically in a few seconds...
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="text-center space-y-2">
                <h2 className="text-3xl tracking-tight">Reset password</h2>
                <p className="text-sm text-muted-foreground">
                    Enter your new password below.
                </p>
            </div>

            {status === 'error' && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-md p-4 flex items-start gap-3">
                    <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                    <div className="text-sm text-red-600">
                        <p className="font-medium">Reset failed</p>
                        <p>{errorMessage}</p>
                    </div>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-4">
                    <FloatingLabelInput
                        id="newPassword"
                        type="password"
                        label="New Password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                    />

                    <FloatingLabelInput
                        id="confirmPassword"
                        type="password"
                        label="Confirm Password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Reset Password
                </button>
            </form>

            <div className="text-center text-sm">
                <Link
                    href="/login"
                    className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to login
                </Link>
            </div>
        </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-background text-foreground transition-colors duration-300">
            <div className="w-full max-w-md bg-card p-8 rounded-xl border border-border shadow-lg">
                <Suspense fallback={
                    <div className="flex justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                }>
                    <ResetPasswordContent />
                </Suspense>
            </div>
        </div>
    );
}
