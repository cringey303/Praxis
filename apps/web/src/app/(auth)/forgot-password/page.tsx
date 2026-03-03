'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, ArrowLeft } from 'lucide-react';
import { FloatingLabelInput } from '@/components/ui/FloatingLabelInput';
import { useToast } from "@/components/ui/Toast";
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const { showToast } = useToast();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch(`${API_URL}/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });

            if (!res.ok) {
                console.error('Failed to send reset email');
            }

            setSubmitted(true);
        } catch (err) {
            console.error(err);
            showToast('An error occurred. Please try again.', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-background text-foreground transition-colors duration-300">
            <Card className="w-full max-w-md space-y-4 p-8 shadow-lg">
                <div className="text-center space-y-2">
                    <h1 className="text-3xl tracking-tight">Forgot password?</h1>
                    <p className="text-sm text-muted-foreground">
                        Enter your email to receive a link to reset your password.
                    </p>
                </div>

                {!submitted ? (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-4">
                            <FloatingLabelInput
                                id="email"
                                type="email"
                                label="Email address"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>

                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full"
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Send reset link
                        </Button>
                    </form>
                ) : (
                    <div className="bg-green-500/10 border border-green-500/20 rounded-sm p-6 text-center">
                        <h3 className="text-green-600 font-medium mb-2">Check your email</h3>
                        <p className="text-sm text-muted-foreground">
                            We&apos;ve sent a password reset link to <strong>{email}</strong>.
                        </p>
                        <p className="text-xs text-muted-foreground mt-4">
                            Didn&apos;t receive the email? Check your spam folder or{' '}
                            <Button
                                variant="link"
                                onClick={() => setSubmitted(false)}
                                className="text-primary hover:underline p-0 h-auto font-normal"
                            >
                                try again
                            </Button>.
                        </p>
                    </div>
                )}

                <div className="text-center text-sm">
                    <Link
                        href="/login"
                        className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to login
                    </Link>
                </div>
            </Card>
        </div>
    );
}
