'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { FloatingLabelInput } from '../../../components/ui/FloatingLabelInput';
import { useToast } from "@/components/ui/Toast";

interface UserProfile {
    id: string;
    username: string;
    display_name: string;
    email?: string;
    avatar_url?: string;
}

export default function ProfilePage() {
    const router = useRouter();
    const [user, setUser] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const { showToast } = useToast();

    // Form state
    const [formData, setFormData] = useState({
        username: '',
        display_name: '',
    });

    // Fetch user data on mount
    useEffect(() => {
        const fetchUser = async () => {
            try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/user/me`, {
                    credentials: 'include',
                });
                if (!res.ok) {
                    if (res.status === 401) {
                        router.push('/login');
                        return;
                    }
                    throw new Error('Failed to load profile');
                }
                const data = await res.json();
                setUser(data);
                setFormData({
                    username: data.username || '',
                    display_name: data.display_name || '',
                });
            } catch (err) {
                console.error(err);
                showToast('Could not load profile data.', 'error');
            } finally {
                setLoading(false);
            }
        };

        fetchUser();
    }, [router]);

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
            setLoading(false);
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        console.log('UseProfile: Submitting update', formData);
        setUpdating(true);

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/user/profile`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(formData),
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(text || 'Update failed');
            }

            showToast('Profile updated successfully.', 'success');
            // Refresh local user data to reflect changes
            setUser((prev) => prev ? { ...prev, ...formData } : null);
        } catch (err: any) {
            console.error('UseProfile: Update failed', err);
            showToast(err.message, 'error');
        } finally {
            setUpdating(false);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
                <div className="animate-pulse flex flex-col items-center">
                    <div className="h-12 w-12 rounded-full bg-muted mb-4"></div>
                    <div className="h-4 w-32 bg-muted rounded"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground">
            <DashboardHeader user={user} onLogout={handleLogout} isLoggingOut={loading} />

            <div className="p-6 md:p-12">
                <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-8">

                    {/* Sidebar Navigation (Visual Only for now) */}
                    <aside className="md:col-span-3 space-y-2">
                        {/* 'Back to Dashboard' removed as Header handles it */}
                        <div className="h-4"></div>
                        <nav className="space-y-1">
                            <Link href="/settings/profile" className="block px-3 py-2 rounded-md bg-secondary/50 text-foreground font-medium border-l-2 border-primary">
                                Profile
                            </Link>
                            <div className="block px-3 py-2 rounded-md text-muted-foreground hover:bg-secondary/30 cursor-not-allowed opacity-50">
                                Security
                            </div>
                            <div className="block px-3 py-2 rounded-md text-muted-foreground hover:bg-secondary/30 cursor-not-allowed opacity-50">
                                Notifications
                            </div>
                        </nav>
                    </aside>

                    {/* Main Content */}
                    <main className="md:col-span-9">
                        <div className="space-y-6">
                            <div>
                                <h1 className="text-3xl font-semibold tracking-tight">Profile</h1>
                            </div>

                            <div className="border-t border-border my-6"></div>

                            <form
                                onSubmit={handleSubmit}
                                className="space-y-8 max-w-2xl"
                                autoComplete="off"
                                data-lpignore="true"
                            >

                                {/* Profile Picture Section */}
                                <div className="space-y-4">
                                    <label className="block text-sm font-medium">Profile picture</label>
                                    <div className="flex items-center gap-6">
                                        <div className="relative h-24 w-24 rounded-full overflow-hidden border border-border bg-secondary flex items-center justify-center text-2xl font-bold uppercase text-muted-foreground">
                                            {user?.avatar_url ? (
                                                <Image
                                                    src={user.avatar_url}
                                                    alt={user.username}
                                                    fill
                                                    className="object-cover"
                                                />
                                            ) : (
                                                <span>{user?.display_name?.[0] || user?.username?.[0] || '?'}</span>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            className="px-4 py-2 border border-input rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50"
                                            disabled
                                        >
                                            Upload new picture
                                            <span className="block text-xs font-normal text-muted-foreground mt-0.5">Coming soon</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Name Input */}
                                <div className="space-y-2">
                                    <FloatingLabelInput
                                        id="display_name"
                                        label="Display Name"
                                        type="text"
                                        value={formData.display_name}
                                        autoComplete="off"
                                        data-lpignore="true"
                                        onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                                    />
                                    <p className="text-xs text-muted-foreground">Your real name or pen name.</p>
                                </div>

                                {/* Username Input */}
                                <div className="space-y-2">
                                    <FloatingLabelInput
                                        id="username"
                                        label="Username"
                                        type="text"
                                        value={formData.username}
                                        autoComplete="off"
                                        data-lpignore="true"
                                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        URL: praxis.com/<b>{formData.username || 'username'}</b>
                                    </p>
                                </div>

                                {/* Email Input (Read Only) */}
                                <div className="space-y-2">
                                    <FloatingLabelInput
                                        id="email"
                                        label="Email"
                                        type="text"
                                        disabled
                                        className="cursor-not-allowed bg-secondary/50 text-muted-foreground"
                                        value={user?.email || 'No email visible'}
                                    />
                                    <p className="text-xs text-muted-foreground">To change your email, please contact support.</p>
                                </div>

                                <div className="pt-4">
                                    <button
                                        type="submit"
                                        disabled={updating}
                                        className="cursor-pointer rounded-md bg-green-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus-visible:outlinefocus-visible:outline-offset-2 focus-visible:outline-green-600 disabled:opacity-50 transition-colors"
                                    >
                                        {updating ? 'Saving...' : 'Update profile'}
                                    </button>
                                </div>

                            </form>
                        </div>
                    </main>
                </div>
            </div>
        </div>
    );
}
