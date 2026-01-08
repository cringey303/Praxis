'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function Dashboard() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const handleLogout = async () => {
        setLoading(true);
        try {
            await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/auth/logout`, {
                method: 'POST',
            });
            // Redirect to home page
            router.push('/');
        } catch (error) {
            console.error('Logout failed:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center p-8 bg-background text-foreground">
            <div className="max-w-4xl w-full space-y-8 text-center">
                <h1 className="text-4xl tracking-tight sm:text-6xl">
                    Dashboard
                </h1>

                <div className="mt-10 flex items-center justify-center gap-x-6">
                    <button
                        onClick={handleLogout}
                        disabled={loading}
                        className="cursor-pointer rounded-md bg-destructive px-3.5 py-2.5 text-sm font-semibold text-destructive-foreground shadow-sm hover:bg-destructive/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-destructive disabled:opacity-50"
                    >
                        {loading ? 'Logging out...' : 'Log Out'}
                    </button>
                </div>
            </div>
        </div>
    );
}
