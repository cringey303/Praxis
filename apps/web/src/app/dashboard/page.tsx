'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { UserListWidget } from '../../components/dashboard/UserListWidget';
import { WelcomeWidget } from '../../components/dashboard/WelcomeWidget';
import { FeedWidget } from '../../components/dashboard/FeedWidget';
import { NavBar } from '@/components/dashboard/NavBar';

export default function Dashboard() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [userLoading, setUserLoading] = useState(true);

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
            } finally {
                setUserLoading(false);
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
            <NavBar user={user} isLoading={userLoading} onLogout={handleLogout} isLoggingOut={loading} />

            <main className="p-3">
                <div className="w-full space-y-8">

                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                        {/* Welcome Card */}
                        <WelcomeWidget user={user} />

                        {/* User List Widget */}
                        <div className="col-span-full md:col-span-1">
                            <UserListWidget currentUser={user} />
                        </div>
                    </div>

                    {/* Activity Feed */}
                    <div className="max-w-2xl">
                        <h2 className="text-xl font-semibold mb-4">Activity Feed</h2>
                        <FeedWidget user={user} />
                    </div>
                </div>
            </main>
        </div>
    );
}
