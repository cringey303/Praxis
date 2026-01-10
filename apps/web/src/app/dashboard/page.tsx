'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { UserListWidget } from '../../components/dashboard/UserListWidget';

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
        <div className="min-h-screen bg-background text-foreground p-8">
            <div className="max-w-6xl mx-auto space-y-8">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
                    <div className="flex items-center gap-4">
                        <Link
                            href="/settings/profile"
                            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                        >
                            Edit Profile
                        </Link>
                        <button
                            onClick={handleLogout}
                            disabled={loading}
                            className="cursor-pointer rounded-md bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/20 disabled:opacity-50 transition-colors"
                        >
                            {loading ? 'Logging out...' : 'Log Out'}
                        </button>
                    </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {/* Welcome Card */}
                    <div className="col-span-full md:col-span-2 rounded-xl border border-border p-6 shadow-sm">
                        <h2 className="text-xl mb-2">Welcome Back</h2>
                        <p className="text-muted-foreground">
                            This is the dashboard for Praxis. You will find different widgets here in the future.
                        </p>
                    </div>

                    {/* User List Widget */}
                    <div className="col-span-full md:col-span-1">
                        <UserListWidget />
                    </div>
                </div>
            </div>
        </div>
    );
}
