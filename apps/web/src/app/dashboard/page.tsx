'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { UserListWidget } from '../../components/dashboard/UserListWidget';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';

export default function Dashboard() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const [user, setUser] = useState<{ display_name: string; username: string; role: string } | null>(null);

    // fetch user data
    useEffect(() => {
        const fetchUser = async () => {
            try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/user/me`, {
                    credentials: 'include',
                });
                if (res.ok) {
                    const data = await res.json();
                    setUser(data);
                }
            } catch (err) {
                console.error('Failed to load user', err);
            }
        };
        fetchUser();
    }, []);

    const handleLogout = async () => {
        setLoading(true);
        try {
            await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/auth/logout`, {
                method: 'POST',
                credentials: 'include',
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
        <div className="min-h-screen bg-background text-foreground">
            <DashboardHeader user={user} onLogout={handleLogout} isLoggingOut={loading} />

            <main className="p-8">
                <div className="w-full space-y-8">

                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {/* Welcome Card */}
                        <div className="col-span-full md:col-span-2 rounded-xl border border-border p-6 shadow-sm">
                            <h2 className="text-xl mb-2">
                                Welcome Back{user ? `, ${user.display_name}` : ''}
                            </h2>
                            <p className="text-muted-foreground">
                                This is the dashboard for Praxis. You will find different widgets here in the future.
                            </p>
                        </div>

                        {/* User List Widget */}
                        <div className="col-span-full md:col-span-1">
                            <UserListWidget currentUser={user} />
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
