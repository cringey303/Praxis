'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Smartphone, Key, Trash2, Plus, Copy, Check } from 'lucide-react';
import { NavBar } from '@/components/dashboard/NavBar';
import { FloatingLabelInput } from '../../../components/ui/FloatingLabelInput';
import { useToast } from "@/components/ui/Toast";
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

interface UserProfile {
    id: string;
    username: string;
    display_name: string;
    avatar_url?: string;
    email?: string;
    has_password: boolean;
}

interface PasskeyInfo {
    id: string;
    name: string;
    created_at: string;
    last_used_at: string | null;
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
    const [isPasswordFormOpen, setIsPasswordFormOpen] = useState(false);

    // Passkey state
    const [passkeys, setPasskeys] = useState<PasskeyInfo[]>([]);
    const [registeringPasskey, setRegisteringPasskey] = useState(false);
    const [deletingPasskeyId, setDeletingPasskeyId] = useState<string | null>(null);
    const [newPasskeyName, setNewPasskeyName] = useState('');
    const [showPasskeyNameDialog, setShowPasskeyNameDialog] = useState(false);
    const [pendingCredential, setPendingCredential] = useState<unknown>(null);
    const [showPasskeyPasswordDialog, setShowPasskeyPasswordDialog] = useState(false);
    const [passkeyPassword, setPasskeyPassword] = useState('');

    // TOTP state
    const [totpEnabled, setTotpEnabled] = useState(false);
    const [totpSetupData, setTotpSetupData] = useState<{ secret: string; qr_code_url: string } | null>(null);
    const [totpCode, setTotpCode] = useState('');
    const [settingUpTotp, setSettingUpTotp] = useState(false);
    const [disablingTotp, setDisablingTotp] = useState(false);
    const [backupCodes, setBackupCodes] = useState<string[]>([]);
    const [showBackupCodes, setShowBackupCodes] = useState(false);
    const [copiedCode, setCopiedCode] = useState<string | null>(null);

    // Fetch user data
    const fetchUser = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/user/me`, {
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
    }, [router, showToast]);

    // Fetch passkeys
    const fetchPasskeys = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/auth/passkey/list`, {
                credentials: 'include',
            });
            if (res.ok) {
                const data = await res.json();
                setPasskeys(data);
            }
        } catch (err) {
            console.error('Failed to fetch passkeys:', err);
        }
    }, []);

    // Fetch TOTP status
    const fetchTotpStatus = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/auth/totp/status`, {
                credentials: 'include',
            });
            if (res.ok) {
                const data = await res.json();
                setTotpEnabled(data.enabled);
            }
        } catch (err) {
            console.error('Failed to fetch TOTP status:', err);
        }
    }, []);

    useEffect(() => {
        fetchUser();
        fetchPasskeys();
        fetchTotpStatus();
    }, [fetchUser, fetchPasskeys, fetchTotpStatus]);

    const handleLogout = async () => {
        setLoading(true);
        try {
            await fetch(`${API_URL}/auth/logout`, {
                method: 'POST',
                credentials: 'include',
            });
            router.push('/');
        } catch (error) {
            console.error('Logout failed:', error);
            setLoading(false);
        }
    };

    // Password validation and handlers (keeping existing implementation)
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
            const res = await fetch(`${API_URL}/auth/change-password`, {
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
            const res = await fetch(`${API_URL}/auth/set-password`, {
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

            showToast('Password set successfully!', 'success');
            setEmail('');
            setNewPassword('');
            setConfirmPassword('');
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

    // Passkey handlers
    const initiatePasskeyRegistration = () => {
        if (user?.has_password) {
            setShowPasskeyPasswordDialog(true);
        } else {
            handleRegisterPasskey();
        }
    };

    const handleRegisterPasskey = async (password?: string) => {
        setRegisteringPasskey(true);
        try {
            // Start registration
            const startRes = await fetch(`${API_URL}/auth/passkey/register/start`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ password }),
            });

            if (!startRes.ok) {
                const errorText = await startRes.text();
                // If unauthorized, it might be a bad password
                if (startRes.status === 401 && password) {
                    showToast('Incorrect password', 'error');
                    setRegisteringPasskey(false); // Stop here so they can try again
                    return;
                }

                console.error('Passkey start error:', startRes.status, errorText);
                throw new Error(errorText || 'Failed to start passkey registration');
            }

            // Close password dialog if it was open
            setShowPasskeyPasswordDialog(false);
            setPasskeyPassword('');

            const data = await startRes.json();

            // webauthn-rs returns options wrapped in 'publicKey' or 'public_key'
            // @simplewebauthn/browser expects the inner options object
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const options = (data as any).publicKey || (data as any).public_key || data;

            // Use browser API to create credential
            const credential = await startRegistration(options);

            // Store credential and show name dialog
            setPendingCredential(credential);
            setShowPasskeyNameDialog(true);
        } catch (err: unknown) {
            console.error('Passkey registration error:', err);
            if (err instanceof Error && err.name === 'NotAllowedError') {
                showToast('Passkey registration was cancelled.', 'error');
            } else {
                showToast('Failed to register passkey. Please try again.', 'error');
            }
        } finally {
            setRegisteringPasskey(false);
        }
    };

    const handleFinishPasskeyRegistration = async () => {
        if (!pendingCredential) return;

        setRegisteringPasskey(true);
        try {
            const finishRes = await fetch(`${API_URL}/auth/passkey/register/finish`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    credential: pendingCredential,
                    name: newPasskeyName || 'Passkey',
                }),
            });

            if (!finishRes.ok) {
                throw new Error('Failed to finish passkey registration');
            }

            showToast('Passkey registered successfully!', 'success');
            setShowPasskeyNameDialog(false);
            setNewPasskeyName('');
            setPendingCredential(null);
            fetchPasskeys();
        } catch (err) {
            console.error('Passkey finish error:', err);
            showToast('Failed to complete passkey registration.', 'error');
        } finally {
            setRegisteringPasskey(false);
        }
    };

    const handleDeletePasskey = async (passkeyId: string) => {
        setDeletingPasskeyId(passkeyId);
        try {
            const res = await fetch(`${API_URL}/auth/passkey/${passkeyId}`, {
                method: 'DELETE',
                credentials: 'include',
            });

            if (!res.ok) {
                throw new Error('Failed to delete passkey');
            }

            showToast('Passkey deleted successfully.', 'success');
            fetchPasskeys();
        } catch (err) {
            console.error('Failed to delete passkey:', err);
            showToast('Failed to delete passkey.', 'error');
        } finally {
            setDeletingPasskeyId(null);
        }
    };

    // TOTP handlers
    const handleSetupTotp = async () => {
        setSettingUpTotp(true);
        try {
            // Need to verify password first? 
            // The requirement was for passkey creation. 
            // let's stick to passkey for now as requested.
            const res = await fetch(`${API_URL}/auth/totp/setup`, {
                method: 'POST',
                credentials: 'include',
            });

            if (!res.ok) {
                throw new Error('Failed to setup TOTP');
            }

            const data = await res.json();
            setTotpSetupData(data);
        } catch (err) {
            console.error('TOTP setup error:', err);
            showToast('Failed to setup 2FA. Please try again.', 'error');
            setSettingUpTotp(false);
        }
    };

    const handleEnableTotp = async () => {
        if (!totpCode || totpCode.length !== 6) {
            showToast('Please enter a valid 6-digit code.', 'error');
            return;
        }

        setSettingUpTotp(true);
        try {
            const res = await fetch(`${API_URL}/auth/totp/enable`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ code: totpCode }),
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(text || 'Invalid code');
            }

            const data = await res.json();
            showToast('Two-factor authentication enabled!', 'success');
            setTotpEnabled(true);
            setTotpSetupData(null);
            setTotpCode('');
            setBackupCodes(data.backup_codes || []);
            setShowBackupCodes(true);
        } catch (err: unknown) {
            console.error('TOTP enable error:', err);
            showToast('Invalid code. Please try again.', 'error');
        } finally {
            setSettingUpTotp(false);
        }
    };

    const handleDisableTotp = async () => {
        if (!totpCode || totpCode.length !== 6) {
            showToast('Please enter your current 2FA code to disable.', 'error');
            return;
        }

        setDisablingTotp(true);
        try {
            const res = await fetch(`${API_URL}/auth/totp/disable`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ code: totpCode }),
            });

            if (!res.ok) {
                throw new Error('Invalid code');
            }

            showToast('Two-factor authentication disabled.', 'success');
            setTotpEnabled(false);
            setTotpCode('');
        } catch (err) {
            console.error('TOTP disable error:', err);
            showToast('Invalid code. Please try again.', 'error');
        } finally {
            setDisablingTotp(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedCode(text);
        setTimeout(() => setCopiedCode(null), 2000);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
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
                                className="flex items-center gap-3 px-4 py-3 rounded-sm text-muted-foreground hover:text-foreground hover:bg-secondary/30 border border-transparent transition-all group"
                            >
                                <div className="h-5 w-5 flex items-center justify-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                                </div>
                                <span className="text-sm font-medium">Profile</span>
                            </Link>

                            <Link
                                href="/settings/security"
                                className="flex items-center gap-3 px-4 py-3 rounded-sm bg-primary/10 border border-primary/20 text-primary transition-all group"
                            >
                                <div className="h-5 w-5 flex items-center justify-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                                </div>
                                <span className="text-sm font-medium">Security</span>
                            </Link>

                            <button className="flex items-center gap-3 px-4 py-3 rounded-sm text-muted-foreground hover:text-foreground hover:bg-secondary/30 border border-transparent transition-all group cursor-not-allowed opacity-60">
                                <div className="h-5 w-5 flex items-center justify-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
                                </div>
                                <span className="text-sm font-medium">Notifications</span>
                            </button>
                        </nav>
                    </aside>

                    {/* Main Content */}
                    <main className="md:col-span-9">
                        <div className="space-y-4 mb-6">
                            <div className="max-w-[700px] mb-4">
                                <h1 className="text-3xl font-semibold tracking-tight">Security</h1>
                            </div>

                            {/* Emails Section */}
                            <div className="max-w-[700px] border border-border rounded-xl p-6 bg-card">
                                <h2 className="text-lg font-medium mb-4">Emails</h2>
                                <div className="max-w-[500px]">
                                    <FloatingLabelInput
                                        id="security-email"
                                        label="Email Address"
                                        type="email"
                                        value={user?.email || ''}
                                        disabled
                                        className="cursor-not-allowed opacity-60"
                                    />
                                </div>
                            </div>

                            {/* Passkeys Section */}
                            <div className="max-w-[700px] border border-border rounded-xl p-6 bg-card">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h2 className="text-lg font-medium">Passkeys</h2>
                                    </div>
                                    <button
                                        onClick={initiatePasskeyRegistration}
                                        disabled={registeringPasskey}
                                        className="cursor-pointer py-1.5 px-3 bg-primary text-primary-foreground rounded-sm text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                    >
                                        {registeringPasskey ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Plus className="h-4 w-4" />
                                        )}
                                        Add Passkey
                                    </button>
                                </div>

                                {passkeys.length > 0 ? (
                                    <div className="space-y-3">
                                        {passkeys.map((passkey) => (
                                            <div
                                                key={passkey.id}
                                                className="flex items-center justify-between p-4 rounded-sm border border-border bg-secondary/20"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-secondary rounded-sm">
                                                        <Key className="h-5 w-5" />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium">{passkey.name}</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            Added {formatDate(passkey.created_at)}
                                                            {passkey.last_used_at && ` • Last used ${formatDate(passkey.last_used_at)}`}
                                                        </p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleDeletePasskey(passkey.id)}
                                                    disabled={deletingPasskeyId === passkey.id}
                                                    className="cursor-pointer p-2 text-muted-foreground hover:text-red-500 transition-colors disabled:opacity-50"
                                                >
                                                    {deletingPasskeyId === passkey.id ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <Trash2 className="h-4 w-4" />
                                                    )}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-muted-foreground">
                                        <Key className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                        <p className="text-sm">No passkeys registered yet.</p>
                                        <p className="text-xs mt-1">Add a passkey to enable passwordless sign-in.</p>
                                    </div>
                                )}
                            </div>

                            {/* Passkey Name Dialog */}
                            {showPasskeyNameDialog && (
                                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                                    <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md mx-4">
                                        <h3 className="text-lg font-medium mb-4">Name your passkey</h3>
                                        <p className="text-sm text-muted-foreground mb-4">
                                            Give this passkey a name so you can identify it later.
                                        </p>
                                        <input
                                            type="text"
                                            value={newPasskeyName}
                                            onChange={(e) => setNewPasskeyName(e.target.value)}
                                            placeholder="e.g., MacBook Pro, iPhone"
                                            className="w-full px-3 py-2 bg-secondary border border-border rounded-sm text-sm mb-4"
                                            autoFocus
                                        />
                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => {
                                                    setShowPasskeyNameDialog(false);
                                                    setPendingCredential(null);
                                                    setNewPasskeyName('');
                                                }}
                                                className="cursor-pointer flex-1 py-2 px-4 border border-border rounded-sm text-sm font-medium hover:bg-secondary transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={handleFinishPasskeyRegistration}
                                                disabled={registeringPasskey}
                                                className="cursor-pointer flex-1 py-2 px-4 bg-primary text-primary-foreground rounded-sm text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                            >
                                                {registeringPasskey && <Loader2 className="h-4 w-4 animate-spin" />}
                                                Save
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Password Section */}
                            <div className="max-w-[700px] border border-border rounded-xl p-6 bg-card">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-lg font-medium">
                                        Password
                                    </h2>
                                    {user?.has_password && (
                                        <button
                                            onClick={() => setIsPasswordFormOpen(!isPasswordFormOpen)}
                                            className="cursor-pointer py-1.5 px-3 bg-primary text-primary-foreground rounded-sm text-sm hover:bg-primary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                                        >
                                            {isPasswordFormOpen ? 'Hide' : 'Change Password'}
                                        </button>
                                    )}
                                </div>

                                {(isPasswordFormOpen || !user?.has_password) && (
                                    <>
                                        {!user?.has_password && (
                                            <p className="text-sm text-muted-foreground mb-4">
                                                Add a password to your account so you can also log in with email and password.
                                            </p>
                                        )}

                                        <form onSubmit={user?.has_password ? handleChangePassword : handleSetPassword} className="space-y-4">
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
                                                    className="cursor-pointer w-auto py-1.5 px-4 bg-primary text-primary-foreground rounded-sm font-small hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                                >
                                                    {updating ? (
                                                        <>
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                            {user?.has_password ? 'Changing Password...' : 'Setting Password...'}
                                                        </>
                                                    ) : (
                                                        user?.has_password ? 'Update Password' : 'Set Password'
                                                    )}
                                                </button>

                                                {user?.has_password && (
                                                    <button
                                                        type="button"
                                                        disabled
                                                        className="text-sm text-foreground underline decoration-muted-foreground/30 underline-offset-4 opacity-50 cursor-not-allowed"
                                                    >
                                                        I forgot my password
                                                    </button>
                                                )}
                                            </div>
                                        </form>
                                    </>
                                )}
                            </div>

                            {/* Two-Factor Authentication Section */}
                            <div className="max-w-[700px] border border-border rounded-xl p-6 bg-card">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                                    <div>
                                        <h2 className="text-lg font-medium">Two-Factor Authentication</h2>
                                        <p className="text-sm text-muted-foreground">
                                            Add an extra layer of security when logging in with password.
                                        </p>
                                    </div>
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${totpEnabled
                                        ? 'bg-green-500/10 text-green-500 border border-green-500/20'
                                        : 'bg-red-500/10 text-red-500 border border-red-500/20'
                                        }`}>
                                        {totpEnabled ? 'Enabled' : 'Disabled'}
                                    </span>
                                </div>

                                {!totpEnabled && !totpSetupData && (
                                    <div className="bg-secondary/30 rounded-sm p-4 border border-border flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                        <div className="p-2 bg-secondary rounded-sm relative">
                                            <Smartphone className="h-6 w-6" />
                                            <div className="absolute bottom-3 left-1 bg-secondary rounded-sm p-0.5">
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    width="24"
                                                    height="24"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    className="h-3 w-3"
                                                >
                                                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" fill="currentColor" />
                                                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                                </svg>
                                            </div>
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-medium">Protect your account with 2FA</p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Use an authenticator app to generate one-time codes for login.
                                            </p>
                                        </div>
                                        <button
                                            onClick={handleSetupTotp}
                                            disabled={settingUpTotp}
                                            className="cursor-pointer shrink-0 border border-border bg-background text-foreground font-medium py-1.5 px-4 rounded-sm text-sm hover:bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                        >
                                            {settingUpTotp && <Loader2 className="h-4 w-4 animate-spin" />}
                                            Enable 2FA
                                        </button>
                                    </div>
                                )}

                                {/* TOTP Setup Flow */}
                                {totpSetupData && (
                                    <div className="space-y-6">
                                        <div className="bg-secondary/30 rounded-sm p-4 border border-border">
                                            <h3 className="text-sm font-medium mb-3">1. Scan QR Code</h3>
                                            <p className="text-xs text-muted-foreground mb-4">
                                                Use an authenticator app like Google Authenticator, Authy, or 1Password to scan this QR code.
                                            </p>
                                            <div className="flex justify-center mb-4">
                                                <div className="bg-white p-4 rounded-sm">
                                                    <img
                                                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(totpSetupData.qr_code_url)}`}
                                                        alt="TOTP QR Code"
                                                        className="w-48 h-48"
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-center gap-2">
                                                <p className="text-xs text-muted-foreground">Or enter this code manually:</p>
                                                <div className="flex items-center gap-2">
                                                    <code className="text-sm font-mono bg-secondary px-3 py-1 rounded-sm border border-border">
                                                        {totpSetupData.secret}
                                                    </code>
                                                    <button
                                                        onClick={() => copyToClipboard(totpSetupData.secret)}
                                                        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-sm transition-colors cursor-pointer"
                                                        title="Copy code"
                                                    >
                                                        {copiedCode === totpSetupData.secret ? (
                                                            <Check className="h-4 w-4 text-green-500" />
                                                        ) : (
                                                            <Copy className="h-4 w-4" />
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-secondary/30 rounded-sm p-4 border border-border">
                                            <h3 className="text-sm font-medium mb-3">2. Enter verification code</h3>
                                            <p className="text-xs text-muted-foreground mb-4">
                                                Enter the 6-digit code from your authenticator app to verify setup.
                                            </p>
                                            <div className="flex gap-3">
                                                <input
                                                    type="text"
                                                    value={totpCode}
                                                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                                    placeholder="000000"
                                                    className="flex-1 px-4 py-2 bg-secondary border border-border rounded-sm text-center text-lg font-mono tracking-widest"
                                                    maxLength={6}
                                                />
                                                <button
                                                    onClick={handleEnableTotp}
                                                    disabled={settingUpTotp || totpCode.length !== 6}
                                                    className="cursor-pointer px-6 py-2 bg-primary text-primary-foreground rounded-sm text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                                >
                                                    {settingUpTotp && <Loader2 className="h-4 w-4 animate-spin" />}
                                                    Verify
                                                </button>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => {
                                                setTotpSetupData(null);
                                                setTotpCode('');
                                                setSettingUpTotp(false);
                                            }}
                                            className="cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                            Cancel setup
                                        </button>
                                    </div>
                                )}

                                {/* 2FA Enabled State */}
                                {totpEnabled && !totpSetupData && (
                                    <div className="space-y-4">
                                        <div className="bg-green-500/10 border border-green-500/20 rounded-sm p-4 flex items-center gap-3">
                                            <Check className="h-5 w-5 text-green-500" />
                                            <div>
                                                <p className="text-sm font-medium text-green-500">2FA is enabled</p>
                                                <p className="text-xs text-muted-foreground">
                                                    Your account is protected with two-factor authentication.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="bg-secondary/30 rounded-sm p-4 border border-border">
                                            <h3 className="text-sm font-medium mb-3">Disable 2FA</h3>
                                            <p className="text-xs text-muted-foreground mb-4">
                                                Enter your current 2FA code to disable two-factor authentication.
                                            </p>
                                            <div className="flex gap-3">
                                                <input
                                                    type="text"
                                                    value={totpCode}
                                                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                                    placeholder="000000"
                                                    className="flex-1 px-4 py-2 bg-secondary border border-border rounded-sm text-center text-lg font-mono tracking-widest"
                                                    maxLength={6}
                                                />
                                                <button
                                                    onClick={handleDisableTotp}
                                                    disabled={disablingTotp || totpCode.length !== 6}
                                                    className="cursor-pointer px-6 py-2 bg-red-500 text-white rounded-sm text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                                >
                                                    {disablingTotp && <Loader2 className="h-4 w-4 animate-spin" />}
                                                    Disable
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Backup Codes Modal */}
                            {showBackupCodes && backupCodes.length > 0 && (
                                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                                    <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md mx-4">
                                        <h3 className="text-lg font-medium mb-2">Save your backup codes</h3>
                                        <p className="text-sm text-muted-foreground mb-4">
                                            These codes can be used to access your account if you lose your authenticator device.
                                            <strong className="text-foreground"> Save them in a secure location.</strong>
                                        </p>
                                        <div className="bg-secondary rounded-sm p-4 mb-4 grid grid-cols-2 gap-2">
                                            {backupCodes.map((code, index) => (
                                                <div
                                                    key={index}
                                                    className="flex items-center justify-between bg-background rounded px-3 py-2"
                                                >
                                                    <code className="text-sm font-mono">{code}</code>
                                                    <button
                                                        onClick={() => copyToClipboard(code)}
                                                        className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
                                                    >
                                                        {copiedCode === code ? (
                                                            <Check className="h-4 w-4 text-green-500" />
                                                        ) : (
                                                            <Copy className="h-4 w-4" />
                                                        )}
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                        <button
                                            onClick={() => copyToClipboard(backupCodes.join('\n'))}
                                            className="cursor-pointer w-full mb-3 py-2 px-4 border border-border rounded-sm text-sm font-medium hover:bg-secondary transition-colors flex items-center justify-center gap-2"
                                        >
                                            <Copy className="h-4 w-4" />
                                            Copy all codes
                                        </button>
                                        <button
                                            onClick={() => {
                                                setShowBackupCodes(false);
                                                setBackupCodes([]);
                                            }}
                                            className="cursor-pointer w-full py-2 px-4 bg-primary text-primary-foreground rounded-sm text-sm font-medium hover:bg-primary/90 transition-colors"
                                        >
                                            I&apos;ve saved my codes
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Login Sessions Section */}
                            <div className="max-w-[700px] border border-border rounded-xl p-6 bg-card">
                                <h2 className="text-lg font-medium mb-1">Login Sessions</h2>
                                <p className="text-sm text-muted-foreground mb-6">Places where you&apos;re currently logged into Praxis.</p>

                                <div className="space-y-4">
                                    {/* Current Device */}
                                    <div className="flex items-start gap-4 p-4 rounded-sm border border-primary/30 bg-primary/5">
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
                                    <div className="flex items-start gap-4 p-4 rounded-sm border border-border opacity-50">
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


            {/* Passkey Password Prompt Modal */}
            {
                showPasskeyPasswordDialog && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md mx-4">
                            <h3 className="text-lg font-medium mb-2">Verify it's you</h3>
                            <p className="text-sm text-muted-foreground mb-4">
                                Please enter your password to continue adding a passkey.
                            </p>
                            <FloatingLabelInput
                                id="passkey-password"
                                label="Password"
                                type="password"
                                value={passkeyPassword}
                                onChange={(e) => setPasskeyPassword(e.target.value)}
                                className="mb-4"
                            />
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => {
                                        setShowPasskeyPasswordDialog(false);
                                        setPasskeyPassword('');
                                        setRegisteringPasskey(false);
                                    }}
                                    className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleRegisterPasskey(passkeyPassword)}
                                    disabled={!passkeyPassword || registeringPasskey}
                                    className="px-4 py-2 bg-primary text-primary-foreground rounded-sm text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {registeringPasskey && <Loader2 className="h-4 w-4 animate-spin" />}
                                    Continue
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Name Passkey Modal */}
            {
                showPasskeyNameDialog && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md mx-4">
                            <h3 className="text-lg font-medium mb-2">Name your passkey</h3>
                            <p className="text-sm text-muted-foreground mb-4">
                                Give this passkey a name to help you identify it later (e.g. &quot;MacBook Pro&quot;, &quot;iPhone&quot;).
                            </p>
                            <FloatingLabelInput
                                id="passkey-name"
                                label="Passkey Name"
                                value={newPasskeyName}
                                onChange={(e) => setNewPasskeyName(e.target.value)}
                                className="mb-4"
                                autoFocus
                            />
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => {
                                        setShowPasskeyNameDialog(false);
                                        setNewPasskeyName('');
                                        setPendingCredential(null);
                                    }}
                                    className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleFinishPasskeyRegistration}
                                    disabled={registeringPasskey}
                                    className="px-4 py-2 bg-primary text-primary-foreground rounded-sm text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {registeringPasskey && <Loader2 className="h-4 w-4 animate-spin" />}
                                    Save Passkey
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
