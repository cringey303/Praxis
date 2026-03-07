'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

function VerifyEmailContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams.get('token');
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (!token) {
            setStatus('error');
            setMessage('No verification token provided.');
            return;
        }

        const verify = async () => {
            try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/auth/verify`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token }),
                });

                if (res.ok) {
                    setStatus('success');
                    setTimeout(() => {
                        router.push('/dashboard');
                    }, 3000);
                } else {
                    const text = await res.text();
                    setStatus('error');
                    setMessage(text || 'Verification failed. Token may be invalid or expired.');
                }
            } catch (err) {
                setStatus('error');
                setMessage('An error occurred. Please try again.');
            }
        };

        verify();
    }, [token, router]);

    return (
        <div className="flex min-h-screen flex-col items-center justify-center p-4">
            <div className="w-full max-w-md space-y-8 rounded-lg border border-border bg-card p-8 shadow-lg text-center">
                {status === 'loading' && (
                    <div className="flex flex-col items-center space-y-4">
                        <Loader2 className="h-12 w-12 animate-spin text-primary" />
                        <h1 className="text-2xl font-bold">Verifying Email...</h1>
                        <p className="text-muted-foreground">Please wait while we verify your email address.</p>
                    </div>
                )}

                {status === 'success' && (
                    <div className="flex flex-col items-center space-y-4">
                        <CheckCircle2 className="h-12 w-12 text-green-500" />
                        <h1 className="text-2xl font-bold">Email Verified!</h1>
                        <p className="text-muted-foreground">Your email has been successfully verified.</p>
                        <p className="text-sm">Redirecting to dashboard...</p>
                        <Button asChild variant="link">
                            <Link href="/dashboard">
                                Click here if you are not redirected
                            </Link>
                        </Button>
                    </div>
                )}

                {status === 'error' && (
                    <div className="flex flex-col items-center space-y-4">
                        <XCircle className="h-12 w-12 text-destructive" />
                        <h1 className="text-2xl font-bold">Verification Failed</h1>
                        <p className="text-muted-foreground">{message}</p>
                        <Button asChild>
                            <Link href="/dashboard">
                                Return to Dashboard
                            </Link>
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function VerifyEmailPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <VerifyEmailContent />
        </Suspense>
    );
}
