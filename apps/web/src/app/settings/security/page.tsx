'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { NavBar } from '@/components/dashboard/NavBar';
import { FloatingLabelInput } from '../../../components/ui/FloatingLabelInput';
import { useToast } from "@/components/ui/Toast";

interface UserProfile {
    id: string;
    username: string;
    display_name: string;
    avatar_url?: string;
    has_password: boolean;
}

export default function SecurityPage() {
    const router = useRouter();
    const [user, setUser] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const { showToast } = useToast();

    // Password form state
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [email, setEmail] = useState('');
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [errors, setErrors] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
        email: '',
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
            router.push('/');
        } catch (error) {
            console.error('Logout failed:', error);
            setLoading(false);
        }
    };

    const validatePassword = () => {
        const newErrors = {
            currentPassword: '',
            newPassword: '',
            confirmPassword: '',
            email: '',
        };

        if (!currentPassword) {
            newErrors.currentPassword = 'Current password is required';
        }

        if (!newPassword) {
            newErrors.newPassword = 'New password is required';
        } else if (newPassword.length < 6) {
            newErrors.newPassword = 'Password must be at least 6 characters';
        } else if (newPassword === currentPassword) {
            newErrors.newPassword = 'New password cannot be the same as current password';
        }

        if (!confirmPassword) {
            newErrors.confirmPassword = 'Please confirm your new password';
        } else if (newPassword !== confirmPassword) {
            newErrors.confirmPassword = 'Passwords do not match';
        }

        setErrors(newErrors);

        // Show toasts for each error with slight delays to ensure unique IDs
        const errorMessages = [newErrors.currentPassword, newErrors.newPassword, newErrors.confirmPassword].filter(Boolean);
        errorMessages.forEach((msg, index) => {
            setTimeout(() => showToast(msg, 'error'), index * 50);
        });

        return errorMessages.length === 0;
    };

    const validateSetPassword = () => {
        const newErrors = {
            currentPassword: '',
            newPassword: '',
            confirmPassword: '',
            email: '',
        };

        if (!email || !email.includes('@')) {
            newErrors.email = 'Valid email is required';
        }

        if (!newPassword) {
            newErrors.newPassword = 'Password is required';
        } else if (newPassword.length < 6) {
            newErrors.newPassword = 'Password must be at least 6 characters';
        }

        if (!confirmPassword) {
            newErrors.confirmPassword = 'Please confirm your password';
        } else if (newPassword !== confirmPassword) {
            newErrors.confirmPassword = 'Passwords do not match';
        }

        setErrors(newErrors);

        // Show toasts for each error with slight delays to ensure unique IDs
        const errorMessages = [newErrors.email, newErrors.newPassword, newErrors.confirmPassword].filter(Boolean);
        errorMessages.forEach((msg, index) => {
            setTimeout(() => showToast(msg, 'error'), index * 50);
        });

        return errorMessages.length === 0;
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validatePassword()) return;

        setUpdating(true);

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/auth/change-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    current_password: currentPassword,
                    new_password: newPassword,
                }),
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(text || 'Failed to change password');
            }

            showToast('Password changed successfully!', 'success');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (err: unknown) {
            console.error(err);
            let errorMessage = 'Failed to change password';
            if (err instanceof Error) {
                errorMessage = err.message;
            }

            if (errorMessage.includes('incorrect')) {
                setErrors(prev => ({ ...prev, currentPassword: 'Current password is incorrect' }));
            } else {
                showToast(errorMessage, 'error');
            }
        } finally {
            setUpdating(false);
        }
    };

    const handleSetPassword = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateSetPassword()) return;

        setUpdating(true);

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/auth/set-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    email: email,
                    new_password: newPassword,
                }),
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(text || 'Failed to set password');
            }

            showToast('Password set successfully! You can now log in with email/password.', 'success');
            setEmail('');
            setNewPassword('');
            setConfirmPassword('');
            // Refresh user data to update has_password
            setUser(prev => prev ? { ...prev, has_password: true } : null);
        } catch (err: unknown) {
            console.error(err);
            let errorMessage = 'Failed to set password';
            if (err instanceof Error) {
                errorMessage = err.message;
            }

            if (errorMessage.includes('Email already in use')) {
                setErrors(prev => ({ ...prev, email: 'This email is already in use' }));
            } else {
                showToast(errorMessage, 'error');
            }
        } finally {
            setUpdating(false);
        }
    };

    return (
        <div className="min-h-screen bg-background text-foreground">
            <NavBar user={user} onLogout={handleLogout} isLoggingOut={loading} />

            <div className="p-3">
                <div className="w-full grid grid-cols-1 md:grid-cols-12 gap-3">

                    {/* Sidebar Navigation */}
                    <aside className="md:col-span-3 space-y-4">
                        <nav className="flex flex-col gap-1">
                            <Link
                                href="/settings/profile"
                                className="flex items-center gap-3 px-4 py-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 border border-transparent transition-all group"
                            >
                                <div className="h-5 w-5 flex items-center justify-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                                </div>
                                <span className="text-sm font-medium">Profile</span>
                            </Link>

                            <Link
                                href="/settings/security"
                                className="flex items-center gap-3 px-4 py-3 rounded-lg bg-primary/10 border border-primary/20 text-primary transition-all group"
                            >
                                <div className="h-5 w-5 flex items-center justify-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                                </div>
                                <span className="text-sm font-medium">Security</span>
                            </Link>

                            <button className="flex items-center gap-3 px-4 py-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 border border-transparent transition-all group cursor-not-allowed opacity-60">
                                <div className="h-5 w-5 flex items-center justify-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
                                </div>
                                <span className="text-sm font-medium">Notifications</span>
                            </button>
                        </nav>
                    </aside>

                    {/* Main Content */}
                    <main className="md:col-span-9 bg-card">
                        <div className="space-y-6 mb-6">
                            <div className="max-w-[700px] mb-6">
                                <h1 className="text-3xl font-semibold tracking-tight">Security</h1>
                            </div>

                            {/* Password Section */}
                            <div className="max-w-[500px]">
                                <h2 className="text-lg font-medium mb-4">
                                    {user?.has_password ? 'Change Password' : 'Set Password'}
                                </h2>

                                {!user?.has_password && (
                                    <p className="text-sm text-muted-foreground mb-4">
                                        Add a password to your account so you can also log in with email and password.
                                    </p>
                                )}

                                <form onSubmit={user?.has_password ? handleChangePassword : handleSetPassword} className="space-y-4">
                                    {/* Email field only for Set Password (OAuth users) */}
                                    {!user?.has_password && (
                                        <div>
                                            <FloatingLabelInput
                                                id="email"
                                                type="email"
                                                label="Email Address"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                error={errors.email}
                                            />
                                        </div>
                                    )}

                                    {/* Current password only for Change Password */}
                                    {user?.has_password && (
                                        <div>
                                            <FloatingLabelInput
                                                id="currentPassword"
                                                type={showCurrentPassword ? "text" : "password"}
                                                label="Current Password"
                                                value={currentPassword}
                                                onChange={(e) => setCurrentPassword(e.target.value)}
                                                error={errors.currentPassword}
                                            />
                                        </div>
                                    )}

                                    <div>
                                        <FloatingLabelInput
                                            id="newPassword"
                                            type={showNewPassword ? "text" : "password"}
                                            label={user?.has_password ? "New Password" : "Password"}
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            error={errors.newPassword}
                                        />
                                    </div>

                                    <div>
                                        <FloatingLabelInput
                                            id="confirmPassword"
                                            type={showConfirmPassword ? "text" : "password"}
                                            label={user?.has_password ? "Confirm New Password" : "Confirm Password"}
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            error={errors.confirmPassword}
                                        />
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <button
                                            type="submit"
                                            disabled={updating}
                                            className="cursor-pointer w-1/2 py-1.5 px-4 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                        >
                                            {updating ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                    {user?.has_password ? 'Changing Password...' : 'Setting Password...'}
                                                </>
                                            ) : (
                                                user?.has_password ? 'Change Password' : 'Set Password'
                                            )}
                                        </button>

                                        {/* Forgot Password Link - Disabled */}
                                        {user?.has_password && (
                                            <button
                                                type="button"
                                                disabled
                                                className="text-sm text-muted-foreground underline decoration-muted-foreground/30 underline-offset-4 opacity-50 cursor-not-allowed"
                                            >
                                                I forgot my password
                                            </button>
                                        )}
                                    </div>
                                    
                                </form>

                                <p className="text-xs text-muted-foreground mt-4">
                                    Password must be at least 6 characters long.
                                </p>
                            </div>

                            {/* Divider */}
                            <hr className="border-border my-8" />

                            {/* Two-Factor Authentication Section */}
                            <div className="max-w-[700px]">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                                    <div>
                                        <h2 className="text-lg font-medium">Two-Factor Authentication</h2>
                                        <p className="text-sm text-muted-foreground">Add an extra layer of security to your account.</p>
                                    </div>
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-500 border border-red-500/20">
                                        Disabled
                                    </span>
                                </div>

                                <div className="bg-secondary/30 rounded-lg p-4 border border-border flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                    <div className="p-2 bg-secondary rounded-lg">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                                            <rect width="7" height="12" x="2" y="6" rx="1" /><rect width="7" height="12" x="15" y="6" rx="1" /><path d="M9 6V5a3 3 0 0 1 6 0v1" />
                                        </svg>
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium">Protect your account with 2FA</p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Configuring two-factor authentication adds an extra layer of security to your account by requiring more than just a password to log in.
                                        </p>
                                    </div>
                                    <button
                                        disabled
                                        className="shrink-0 border border-border bg-background text-foreground font-medium py-2 px-4 rounded-lg text-sm opacity-50 cursor-not-allowed"
                                    >
                                        Enable 2FA
                                    </button>
                                </div>
                            </div>

                            {/* Divider */}
                            <hr className="border-border my-8" />

                            {/* Login Sessions Section */}
                            <div className="max-w-[700px]">
                                <h2 className="text-lg font-medium mb-1">Login Sessions</h2>
                                <p className="text-sm text-muted-foreground mb-6">Places where you&apos;re currently logged into Praxis.</p>

                                <div className="space-y-4">
                                    {/* Current Device */}
                                    <div className="flex items-start gap-4 p-4 rounded-lg border border-primary/30 bg-primary/5">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                                            <rect width="20" height="14" x="2" y="3" rx="2" /><line x1="8" x2="16" y1="21" y2="21" /><line x1="12" x2="12" y1="17" y2="21" />
                                        </svg>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-sm font-medium">Your Current Browser</h3>
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-primary text-primary-foreground">
                                                    Current Device
                                                </span>
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-0.5">Location unavailable • IP hidden</p>
                                            <p className="text-xs text-primary mt-1 font-medium">Active now</p>
                                        </div>
                                    </div>

                                    {/* Example Other Device - Placeholder */}
                                    <div className="flex items-start gap-4 p-4 rounded-lg border border-border opacity-50">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                                            <rect width="14" height="20" x="5" y="2" rx="2" ry="2" /><path d="M12 18h.01" />
                                        </svg>
                                        <div className="flex-1">
                                            <h3 className="text-sm font-medium text-muted-foreground">Other devices will appear here</h3>
                                            <p className="text-xs text-muted-foreground mt-0.5">No other active sessions</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-6">
                                    <button
                                        disabled
                                        className="text-red-500 text-sm font-medium flex items-center gap-2 opacity-50 cursor-not-allowed"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" />
                                        </svg>
                                        Log out all other sessions
                                    </button>
                                </div>
                            </div>
                        </div>
                    </main>
                </div>
            </div>
        </div>
    );
}
