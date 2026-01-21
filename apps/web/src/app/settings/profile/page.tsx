'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Loader2 } from 'lucide-react';
import { NavBar } from '@/components/dashboard/NavBar';
import { FloatingLabelInput } from '../../../components/ui/FloatingLabelInput';
import { FloatingLabelTextarea } from '../../../components/ui/FloatingLabelTextarea';
import { useToast } from "@/components/ui/Toast";

interface UserProfile {
    id: string;
    username: string;
    display_name: string;
    email?: string;
    avatar_url?: string;
    bio?: string;
    location?: string;
    website?: string;
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
        bio: '',
        location: '',
        website: '',
    });

    const [errors, setErrors] = useState({
        username: '',
        display_name: '',
        website: '',
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
                    bio: data.bio || '',
                    location: data.location || '',
                    website: data.website || '',
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

    const validateField = (name: string, value: string) => {
        if (name === 'username') {
            if (!value.trim()) return 'Username is required';
        }
        if (name === 'website' && value) {
            // site validation
            const urlPattern = /^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}$/;

            if (!urlPattern.test(value)) {
                return 'Please enter a valid website (e.g., example.com)';
            }
        }
        return '';
    };

    const saveChanges = async () => {
        console.log('UseProfile: Saving changes', formData);
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

            // Success - silently update local state
            // Refresh local user data to reflect changes so next strict comparison works
            setUser((prev) => prev ? { ...prev, ...formData } : null);

            // Clear backend errors if they resolve
            setErrors(prev => ({ ...prev, website: '', username: '' }));

        } catch (err: any) {
            console.error('UseProfile: Update failed', err);

            if (err.message === 'Website could not be reached') {
                setErrors((prev) => ({ ...prev, website: 'Website could not be reached' }));
                // Optional: show toast if you want attention, but field error is good
                showToast('Website validation failed.', 'error');
            } else if (err.message.includes("Username already taken")) {
                setErrors((prev) => ({ ...prev, username: 'Username already taken' }));
            } else {
                showToast(err.message, 'error');
            }
        } finally {
            setUpdating(false);
        }
    };

    const handleBlur = async (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { id, value } = e.target;

        // 1. Validate
        let error = '';
        if (Object.keys(errors).includes(id)) {
            error = validateField(id, value);
            setErrors((prev) => ({ ...prev, [id]: error }));
        }

        if (error) return;

        // 2. Check for changes against original user data
        // Helper to safely get property from user object or empty string
        const originalValue = user ? (user[id as keyof UserProfile] as string || '') : '';
        const currentValue = formData[id as keyof typeof formData];

        if (currentValue !== originalValue) {
            await saveChanges();
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
            <NavBar user={user} onLogout={handleLogout} isLoggingOut={loading} />

            <div className="p-3">
                <div className="w-full grid grid-cols-1 md:grid-cols-12 gap-3">

                    {/* Sidebar Navigation (Visual Only for now) */}
                    <aside className="md:col-span-3 space-y-2">
                        {/* 'Back to Dashboard' removed as Header handles it */}
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
                    <main className="md:col-span-9 rounded-xl border border-border p-6 shadow-sm bg-card">
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <h1 className="text-3xl font-semibold tracking-tight">Profile</h1>
                                <div className="text-sm text-muted-foreground">
                                    {updating ? (
                                        <div className="flex items-center gap-2">
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                            <span>Saving...</span>
                                        </div>
                                    ) : (
                                        <span>All changes saved</span>
                                    )}
                                </div>
                            </div>

                            <div className="border-t border-border my-6"></div>

                            <form
                                className="space-y-8 max-w-2xl"
                                autoComplete="off"
                                data-lpignore="true"
                                onSubmit={(e) => e.preventDefault()}
                            >

                                {/* Profile Picture Section */}
                                <div className="space-y-4">
                                    <label className="block text-sm font-medium">Profile picture</label>
                                    <div className="flex items-center gap-6">
                                        <div className="relative h-24 w-24 rounded-full overflow-hidden border border-border bg-secondary flex items-center justify-center text-2xl font-bold uppercase text-foreground">
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
                                        error={errors.display_name}
                                        onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                                        onBlur={handleBlur}
                                    />

                                </div>

                                {/* Location Input */}
                                <div className="space-y-2">
                                    <FloatingLabelInput
                                        id="location"
                                        label="Location"
                                        type="text"
                                        value={formData.location}
                                        autoComplete="off"
                                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                        onBlur={handleBlur}
                                        maxLength={100}
                                    />
                                </div>

                                {/* Website Input */}
                                <div className="space-y-2">
                                    <FloatingLabelInput
                                        id="website"
                                        label="Website"
                                        type="text"
                                        value={formData.website}
                                        autoComplete="off"
                                        error={errors.website}
                                        onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                                        onBlur={handleBlur}
                                        maxLength={100}
                                    />
                                </div>

                                {/* Bio Input */}
                                <div className="space-y-2">
                                    <FloatingLabelTextarea
                                        id="bio"
                                        label="Bio"
                                        rows={4}
                                        value={formData.bio}
                                        onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                                        onBlur={handleBlur}
                                        maxLength={200}
                                    />
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
                                        error={errors.username}
                                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                        onBlur={handleBlur}
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



                            </form>
                        </div>
                    </main>
                </div>
            </div>
        </div>
    );
}
