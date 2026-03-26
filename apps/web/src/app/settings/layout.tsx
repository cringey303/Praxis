'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Shield, User } from 'lucide-react';
import { NavBar } from '@/components/dashboard/NavBar';
import { Button } from '@/components/ui/button';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

interface SettingsUser {
    id: string;
    username: string;
    display_name: string;
    avatar_url?: string;
    role?: string;
}

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const [user, setUser] = useState<SettingsUser | null>(null);
    const [loggingOut, setLoggingOut] = useState(false);

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const res = await fetch(`${API_URL}/user/me`, {
                    credentials: 'include',
                });

                if (res.ok) {
                    const data = await res.json();
                    setUser(data);
                }
            } catch (err) {
                console.error('Failed to fetch settings user:', err);
            }
        };

        fetchUser();
    }, []);

    const handleLogout = async () => {
        setLoggingOut(true);
        try {
            await fetch(`${API_URL}/auth/logout`, {
                method: 'POST',
                credentials: 'include',
            });
            router.push('/');
        } catch (error) {
            console.error('Logout failed:', error);
            setLoggingOut(false);
        }
    };

    const isProfile = pathname === '/settings/profile';
    const isSecurity = pathname === '/settings/security';

    return (
        <div className="min-h-screen bg-background text-foreground">
            <NavBar user={user} onLogout={handleLogout} isLoggingOut={loggingOut} />

            <div className="p-3">
                <div className="w-full grid grid-cols-1 md:grid-cols-12 gap-3">
                    <aside className="md:col-span-3 space-y-4">
                        <nav className="flex flex-col gap-1">
                            <Button asChild variant="ghost" className={`w-full justify-start gap-3 px-4 py-3 ${isProfile ? 'bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20' : 'hover:bg-secondary/30'}`}>
                                <Link href="/settings/profile" scroll={false}>
                                    <div className="h-5 w-5 flex items-center justify-center">
                                        <User className="h-5 w-5" />
                                    </div>
                                    <span className="text-sm font-medium">Profile</span>
                                </Link>
                            </Button>

                            <Button asChild variant="ghost" className={`w-full justify-start gap-3 px-4 py-3 ${isSecurity ? 'bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20' : 'hover:bg-secondary/30'}`}>
                                <Link href="/settings/security" scroll={false}>
                                    <div className="h-5 w-5 flex items-center justify-center">
                                        <Shield className="h-5 w-5" />
                                    </div>
                                    <span className="text-sm font-medium">Security</span>
                                </Link>
                            </Button>

                            <Button disabled variant="ghost" className="w-full justify-start gap-3 px-4 py-3 opacity-60 cursor-not-allowed hover:bg-transparent">
                                <div className="h-5 w-5 flex items-center justify-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
                                </div>
                                <span className="text-sm font-medium">Notifications</span>
                            </Button>
                        </nav>
                    </aside>

                    <main className="md:col-span-9 space-y-6">
                        {children}
                    </main>
                </div>
            </div>
        </div>
    );
}
