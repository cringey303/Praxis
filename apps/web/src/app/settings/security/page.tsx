'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Smartphone, Key, Trash2, Plus, Copy, Check, Monitor, LogOut, Globe, Shield } from 'lucide-react';
import { NavBar } from '@/components/dashboard/NavBar';
import { FloatingLabelInput } from '../../../components/ui/FloatingLabelInput';
import { useToast } from "@/components/ui/Toast";
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

interface UserProfile {
    id: string;
    username: string;
    display_name: string;
    avatar_url?: string;
    email?: string;
    has_password: boolean;
    verified?: boolean;
}

interface PasskeyInfo {
    id: string;
    name: string;
    created_at: string;
    last_used_at: string | null;
}

interface ActiveSession {
    id: string;
    user_agent: string;
    ip_address: string;
    last_active_at: string;
    expires_at: string;
    is_current: boolean;
}

interface LinkedAccount {
    provider: string;
    provider_email: string | null;
}

export default function SecurityPage() {
    const router = useRouter();
    const [user, setUser] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [resettingPassword, setResettingPassword] = useState(false);
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
    const [isDisableTotpOpen, setIsDisableTotpOpen] = useState(false);
    const [backupCodes, setBackupCodes] = useState<string[]>([]);
    const [showBackupCodes, setShowBackupCodes] = useState(false);
    const [copiedCode, setCopiedCode] = useState<string | null>(null);

    // Session state
    const [sessions, setSessions] = useState<ActiveSession[]>([]);
    const [loadingSessions, setLoadingSessions] = useState(true);
    const [sessionLocations, setSessionLocations] = useState<Record<string, string>>({});

    // Linked accounts state
    const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>([]);
    const [loadingAccounts, setLoadingAccounts] = useState(true);
    const [unlinkingProvider, setUnlinkingProvider] = useState<string | null>(null);

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

    // Lookup location for an IP address
    const lookupIpLocation = useCallback(async (ip: string): Promise<string> => {
        // Skip private/local IPs
        if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
            return '';
        }
        try {
            // Use our backend proxy to avoid mixed content (HTTPS -> HTTP) errors
            const res = await fetch(`${API_URL}/geoip/${ip}`);
            if (res.ok) {
                const data = await res.json();
                if (data.status === 'success' && data.city) {
                    return data.regionName ? `${data.city}, ${data.regionName}` : data.city;
                }
            }
        } catch {
            // Silently fail - location is not critical
        }
        return '';
    }, []);

    // Fetch sessions
    const fetchSessions = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/auth/sessions`, {
                credentials: 'include',
            });
            if (res.ok) {
                const data = await res.json();
                setSessions(data);

                // Resolve locations for unique IPs
                const uniqueIps = [...new Set(data.map((s: ActiveSession) => s.ip_address).filter(Boolean))] as string[];
                const locationMap: Record<string, string> = {};
                await Promise.all(
                    uniqueIps.map(async (ip) => {
                        const location = await lookupIpLocation(ip);
                        if (location) locationMap[ip] = location;
                    })
                );
                setSessionLocations(locationMap);
            }
        } catch (err) {
            console.error('Failed to fetch sessions', err);
        } finally {
            setLoadingSessions(false);
        }
    }, [lookupIpLocation]);

    // Fetch linked accounts
    const fetchLinkedAccounts = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/auth/linked-accounts`, {
                credentials: 'include',
            });
            if (res.ok) {
                const data = await res.json();
                setLinkedAccounts(data);
            }
        } catch (err) {
            console.error('Failed to fetch linked accounts:', err);
        } finally {
            setLoadingAccounts(false);
        }
    }, []);

    useEffect(() => {
        fetchUser();
        fetchPasskeys();
        fetchTotpStatus();
        fetchSessions();
        fetchLinkedAccounts();
    }, [fetchUser, fetchPasskeys, fetchTotpStatus, fetchSessions, fetchLinkedAccounts]);

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

    // Handle OAuth redirect errors
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const error = params.get('error');
        if (error === 'already_linked') {
            showToast('This account is already linked to another user.', 'error');
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, [showToast]);

    // Linked account handlers
    const handleUnlinkAccount = async (provider: string) => {
        const displayName = provider.charAt(0).toUpperCase() + provider.slice(1);
        if (!confirm(`Are you sure you want to disconnect your ${displayName} account?`)) return;

        setUnlinkingProvider(provider);
        try {
            const res = await fetch(`${API_URL}/auth/linked-accounts/${provider}`, {
                method: 'DELETE',
                credentials: 'include',
            });

            if (res.ok) {
                setLinkedAccounts(prev => prev.filter(a => a.provider !== provider));
                showToast(`${displayName} account disconnected`, 'success');
            } else {
                const text = await res.text();
                showToast(text || 'Failed to disconnect account', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('An error occurred', 'error');
        } finally {
            setUnlinkingProvider(null);
        }
    };

    const handleConnectAccount = (provider: string) => {
        window.location.href = `${API_URL}/auth/${provider}`;
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

    const handleForgotPassword = async () => {
        if (!user?.email) return;

        setResettingPassword(true);
        try {
            const res = await fetch(`${API_URL}/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email: user.email }),
            });

            if (res.ok) {
                showToast('Password reset email sent!', 'success');
            } else {
                const text = await res.text();
                showToast(text || 'Failed to send reset email', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('An error occurred', 'error');
        } finally {
            setResettingPassword(false);
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
            } else if (err instanceof Error) {
                showToast(err.message, 'error');
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
        } finally {
            setSettingUpTotp(false);
        }
    };

    const handleEnableTotp = async (codeArg?: string | React.MouseEvent) => {
        const code = typeof codeArg === 'string' ? codeArg : totpCode;
        if (!code || code.length !== 6) return;

        setSettingUpTotp(true);
        try {
            const res = await fetch(`${API_URL}/auth/totp/enable`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ code }),
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

    const handleResendVerification = async () => {
        if (!user?.email) return;

        try {
            const res = await fetch(`${API_URL}/auth/resend-verification`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email: user.email }),
            });

            const text = await res.text();
            if (res.ok) {
                showToast('Verification email sent!', 'success');
            } else {
                showToast(text || 'Failed to send email', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('An error occurred', 'error');
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

    const copyToClipboard = async (text: string) => {
        if (!navigator.clipboard) return;
        try {
            await navigator.clipboard.writeText(text);
            setCopiedCode(text);
            setTimeout(() => setCopiedCode(null), 2000);
            showToast('Copied to clipboard', 'success');
        } catch (err) {
            console.error('Failed to copy', err);
            showToast('Failed to copy to clipboard', 'error');
        }
    };

    const handleRevokeSession = async (sessionId: string) => {
        if (!confirm('Are you sure you want to log out this session?')) return;

        try {
            const res = await fetch(`${API_URL}/auth/sessions/${sessionId}`, {
                method: 'DELETE',
                credentials: 'include',
            });

            if (res.ok) {
                setSessions(sessions.filter(s => s.id !== sessionId));
                showToast('Session revoked successfully', 'success');
            } else {
                showToast('Failed to revoke session', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('An error occurred', 'error');
        }
    };

    const handleRevokeAllOtherSessions = async () => {
        if (!confirm('Are you sure you want to log out all other devices?')) return;

        try {
            const res = await fetch(`${API_URL}/auth/sessions`, {
                method: 'DELETE',
                credentials: 'include',
            });

            if (res.ok) {
                setSessions(sessions.filter(s => s.is_current));
                showToast('All other sessions logged out', 'success');
            } else {
                showToast('Failed to log out sessions', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('An error occurred', 'error');
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const parseUserAgent = (ua: string): { browser: string; os: string; isMobile: boolean } => {
        let browser = 'Unknown Browser';
        let os = 'Unknown OS';
        let isMobile = false;

        // Detect browser
        if (ua.includes('Firefox') && !ua.includes('Seamonkey')) {
            browser = 'Firefox';
        } else if (ua.includes('Edg')) {
            browser = 'Edge';
        } else if (ua.includes('OPR') || ua.includes('Opera')) {
            browser = 'Opera';
        } else if (ua.includes('Chrome') && !ua.includes('Edg') && !ua.includes('OPR')) {
            browser = 'Chrome';
        } else if (ua.includes('Safari') && !ua.includes('Chrome') && !ua.includes('Chromium')) {
            browser = 'Safari';
        }

        // Detect OS
        if (ua.includes('iPhone')) {
            const match = ua.match(/iPhone\s*(?:OS\s*([\d_]+))?/);
            os = match ? `iPhone ${match[1]?.replace(/_/g, '.') || ''}`.trim() : 'iPhone';
            isMobile = true;
        } else if (ua.includes('iPad')) {
            os = 'iPad';
            isMobile = true;
        } else if (ua.includes('Android')) {
            os = 'Android';
            isMobile = true;
        } else if (ua.includes('Mac OS X') || ua.includes('Macintosh')) {
            os = 'macOS';
        } else if (ua.includes('Windows')) {
            os = 'Windows';
        } else if (ua.includes('Linux')) {
            os = 'Linux';
        } else if (ua.includes('CrOS')) {
            os = 'ChromeOS';
        }

        return { browser, os, isMobile };
    };

    const formatRelativeTime = (dateString: string): string => {
        const now = new Date();
        const date = new Date(dateString);
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
        if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
        return formatDate(dateString);
    };

    return (
        <div className="min-h-screen bg-background text-foreground">
            <NavBar user={user} onLogout={handleLogout} isLoggingOut={loading} />

            <div className="p-3">
                <div className="w-full grid grid-cols-1 md:grid-cols-12 gap-3">

                    {/* Sidebar Navigation */}
                    <aside className="md:col-span-3 space-y-4">
                        <nav className="flex flex-col gap-1">
                            <Button asChild variant="ghost" className="w-full justify-start gap-3 px-4 py-3 hover:bg-secondary/30">
                                <Link href="/settings/profile">
                                    <div className="h-5 w-5 flex items-center justify-center">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                                    </div>
                                    <span className="text-sm font-medium">Profile</span>
                                </Link>
                            </Button>

                            <Button asChild variant="ghost" className="w-full justify-start gap-3 px-4 py-3 bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20">
                                <Link href="/settings/security">
                                    <div className="h-5 w-5 flex items-center justify-center">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
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

                    {/* Main Content */}
                    <main className="md:col-span-9 space-y-6">

                        {/* Password Section */}
                        <div className="max-w-[700px] border border-border rounded-xl p-6 bg-card">
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-medium">
                                    Password
                                </h2>
                                {user?.has_password && (
                                    <Button
                                        variant="outline"
                                        onClick={() => setIsPasswordFormOpen(!isPasswordFormOpen)}
                                    >
                                        {isPasswordFormOpen ? 'Hide' : 'Change password'}
                                    </Button>
                                )}
                            </div>

                            {(isPasswordFormOpen || !user?.has_password) && (
                                <>
                                    {!user?.has_password && (
                                        <p className="text-sm text-muted-foreground mb-4">
                                            Add a password to your account so you can also log in with email and password.
                                        </p>
                                    )}

                                    <form onSubmit={user?.has_password ? handleChangePassword : handleSetPassword} className="space-y-4 mt-4">
                                        {!user?.has_password && (
                                            <div>
                                                <FloatingLabelInput
                                                    id="email"
                                                    type="email"
                                                    label="Email Address"
                                                    value={email}
                                                    onChange={(e) => setEmail(e.target.value)}
                                                    error={errors.email}
                                                    labelBg="bg-card"
                                                />
                                            </div>
                                        )}

                                        {user?.has_password && (
                                            <div>
                                                <FloatingLabelInput
                                                    id="currentPassword"
                                                    type={showCurrentPassword ? "text" : "password"}
                                                    label="Current password"
                                                    value={currentPassword}
                                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                                    error={errors.currentPassword}
                                                    labelBg="bg-card"
                                                />
                                            </div>
                                        )}

                                        <div>
                                            <FloatingLabelInput
                                                id="newPassword"
                                                type={showNewPassword ? "text" : "password"}
                                                label={user?.has_password ? "New password" : "Password"}
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                                error={errors.newPassword}
                                                labelBg="bg-card"
                                            />
                                        </div>

                                        <div>
                                            <FloatingLabelInput
                                                id="confirmPassword"
                                                type={showConfirmPassword ? "text" : "password"}
                                                label={user?.has_password ? "Confirm new password" : "Confirm password"}
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                error={errors.confirmPassword}
                                                labelBg="bg-card"
                                            />
                                        </div>

                                        <div className="flex items-center gap-4">
                                            <Button
                                                type="submit"
                                                disabled={updating}
                                            >
                                                {updating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                {user?.has_password ? 'Update password' : 'Set password'}
                                            </Button>

                                            {user?.has_password && (
                                                <Button
                                                    type="button"
                                                    variant="link"
                                                    onClick={handleForgotPassword}
                                                    disabled={resettingPassword}
                                                    className="px-0 text-muted-foreground underline h-auto hover:text-primary/90"
                                                >
                                                    {resettingPassword ? (
                                                        <>
                                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                            Sending...
                                                        </>
                                                    ) : (
                                                        'I forgot my password'
                                                    )}
                                                </Button>
                                            )}
                                        </div>
                                    </form>
                                </>
                            )}
                        </div>

                        {/* Passkey Section */}
                        <div className="max-w-[700px] border border-border rounded-xl bg-card overflow-hidden">
                            <div className="p-6">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-3">
                                        <div>
                                            <h2 className="text-lg font-semibold">Passkeys</h2>
                                            <p className="text-sm text-muted-foreground">Sign in securely without a password.</p>
                                        </div>
                                    </div>
                                    <Button
                                        onClick={initiatePasskeyRegistration}
                                        disabled={registeringPasskey}
                                    >
                                        {registeringPasskey && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        + Add Passkey
                                    </Button>
                                </div>

                                <div className="space-y-3">
                                    {passkeys.length === 0 ? (
                                        <div className="text-center py-8 text-muted-foreground bg-secondary/20 rounded-lg border border-dashed border-border">
                                            <Key className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                            <p>No passkeys added yet</p>
                                        </div>
                                    ) : (
                                        passkeys.map((pk) => (
                                            <div key={pk.id} className="flex items-center justify-between p-4 rounded-lg border border-border bg-background hover:bg-secondary/10 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center">
                                                        <Smartphone className="h-4 w-4 text-muted-foreground" />
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-sm">{pk.name}</p>
                                                        <p className="text-xs text-muted-foreground">Added on {formatDate(pk.created_at)}</p>
                                                    </div>
                                                </div>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    onClick={() => handleDeletePasskey(pk.id)}
                                                    disabled={deletingPasskeyId === pk.id}
                                                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                >
                                                    {deletingPasskeyId === pk.id ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <Trash2 className="h-4 w-4" />
                                                    )}
                                                </Button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Two-Factor Authentication Section */}
                        <div className="max-w-[700px] border border-border rounded-xl bg-card overflow-hidden">
                            <div className="p-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div>
                                            <div className="flex items-center gap-3">
                                                <h2 className="text-lg font-semibold">Two-Factor Authentication</h2>
                                                {totpEnabled && (
                                                    <span className="flex items-center gap-1 text-xs font-medium text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                                        <Check className="h-3 w-3" /> Enabled
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-muted-foreground">Secure your account with an authentication app.</p>
                                        </div>
                                    </div>

                                    {totpEnabled ? (
                                        isDisableTotpOpen ? (
                                            <Button variant="ghost" size="sm" onClick={() => setIsDisableTotpOpen(false)}>Cancel</Button>
                                        ) : (
                                            <Button variant="outline" className="text-destructive hover:text-destructive hover:bg-destructive/30 border-destructive" onClick={() => setIsDisableTotpOpen(true)}>Disable 2FA</Button>
                                        )
                                    ) : (
                                        <Button size="sm" onClick={handleSetupTotp} disabled={settingUpTotp}>
                                            {settingUpTotp ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enable 2FA'}
                                        </Button>
                                    )}
                                </div>

                                {/* Setup Flow */}
                                {totpSetupData && !totpEnabled && (
                                    <div className="mt-6 p-6 border border-border rounded-lg bg-secondary/10 animate-in fade-in zoom-in-95">
                                        <h3 className="font-medium mb-4">Set up Authenticator App</h3>
                                        <div className="flex flex-col md:flex-row gap-6">
                                            <div className="bg-white p-2 rounded-lg w-fit h-fit shrink-0">
                                                <img src={totpSetupData.qr_code_url} alt="QR Code" className="w-32 h-32" />
                                            </div>
                                            <div className="space-y-4 flex-1">
                                                <div className="space-y-2">
                                                    <p className="text-sm text-muted-foreground">Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.), or enter the code manually:</p>
                                                    <div className="flex items-center gap-2">
                                                        <code className="bg-secondary px-2 py-1 rounded text-sm font-mono">{totpSetupData.secret}</code>
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-8 w-8"
                                                            onClick={() => copyToClipboard(totpSetupData.secret)}
                                                        >
                                                            <Copy className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium">Verify Code</label>
                                                    <div className="flex gap-2">
                                                        <Input
                                                            type="text"
                                                            placeholder="000000"
                                                            maxLength={6}
                                                            className="w-32 font-mono text-center tracking-widest"
                                                            value={totpCode}
                                                            onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                                                        />
                                                        <Button onClick={() => handleEnableTotp()} disabled={totpCode.length !== 6 || settingUpTotp}>
                                                            {settingUpTotp ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify & Enable'}
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Disable Flow */}
                                {isDisableTotpOpen && totpEnabled && (
                                    <div className="mt-4 p-4 border border-destructive/20 bg-destructive/5 rounded-lg">
                                        <h3 className="font-medium text-destructive mb-2">Disable Two-Factor Authentication</h3>
                                        <p className="text-sm text-muted-foreground mb-4">Enter a code from your authenticator app to confirm disabling 2FA.</p>
                                        <div className="flex gap-2">
                                            <Input
                                                type="text"
                                                placeholder="000000"
                                                maxLength={6}
                                                className="w-32 font-mono text-center tracking-widest"
                                                value={totpCode}
                                                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                                            />
                                            <Button variant="destructive" onClick={handleDisableTotp} disabled={totpCode.length !== 6 || disablingTotp}>
                                                {disablingTotp ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Disable 2FA'}
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Linked Accounts Section */}
                        <div className="max-w-[700px] border border-border rounded-xl bg-card overflow-hidden">
                            <div className="p-6">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-3">
                                        <div>
                                            <h2 className="text-lg font-semibold">Linked Accounts</h2>
                                            <p className="text-sm text-muted-foreground">Manage external accounts used for sign-in.</p>
                                        </div>
                                    </div>
                                </div>

                                {loadingAccounts ? (
                                    <div className="flex justify-center py-4">
                                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {['google', 'github'].map((provider) => {
                                            const linked = linkedAccounts.find(a => a.provider === provider);
                                            const providerName = provider.charAt(0).toUpperCase() + provider.slice(1);

                                            return (
                                                <div key={provider} className="flex items-center justify-between p-4 rounded-lg border border-border bg-background">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-8 w-8 flex items-center justify-center shrink-0">
                                                            {provider === 'google' ? (
                                                                <svg className="h-5 w-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
                                                            ) : (
                                                                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23 .957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <p className="font-medium text-sm">{providerName}</p>
                                                            {linked ? (
                                                                <p className="text-xs text-green-600 dark:text-green-500 font-medium flex items-center gap-1">
                                                                    <Check className="h-3 w-3" /> Connected as {linked.provider_email || user?.display_name}
                                                                </p>
                                                            ) : (
                                                                <p className="text-xs text-muted-foreground">Not connected</p>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {linked ? (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            disabled={unlinkingProvider === provider || (linkedAccounts.length === 1 && !user?.has_password)}
                                                            onClick={() => handleUnlinkAccount(provider)}
                                                            className={unlinkingProvider === provider ? 'opacity-70' : ''}
                                                        >
                                                            {unlinkingProvider === provider ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                                                            Disconnect
                                                        </Button>
                                                    ) : (
                                                        <Button
                                                            variant="default"
                                                            size="sm"
                                                            onClick={() => handleConnectAccount(provider)}
                                                        >
                                                            Connect
                                                        </Button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Sessions Section */}
                        <div className="max-w-[700px] border border-border rounded-xl bg-card overflow-hidden">
                            <div className="p-6">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-3">
                                        <div>
                                            <h2 className="text-lg font-semibold">Active Sessions</h2>
                                            <p className="text-sm text-muted-foreground">Manage devices where you're logged in.</p>
                                        </div>
                                    </div>

                                    {sessions.length > 1 && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="text-muted-foreground hover:text-foreground"
                                            onClick={handleRevokeAllOtherSessions}
                                        >
                                            Log out all other devices
                                        </Button>
                                    )}
                                </div>

                                {loadingSessions ? (
                                    <div className="flex justify-center py-8">
                                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                    </div>
                                ) : (
                                    <div className="space-y-0 divide-y divide-border">
                                        {sessions.map((session) => {
                                            const { browser, os, isMobile } = parseUserAgent(session.user_agent);
                                            const location = sessionLocations[session.ip_address];

                                            return (
                                                <div key={session.id} className={`flex items-center justify-between ${session.is_current ? 'p-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/10 my-2' : 'py-4 first:pt-0 last:pb-0'}`}>
                                                    <div className="flex items-center gap-4">
                                                        <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center shrink-0">
                                                            {isMobile ? <Smartphone className="h-5 w-5 text-muted-foreground" /> : <Monitor className="h-5 w-5 text-muted-foreground" />}
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <p className="text-sm font-medium">{browser} on {os}</p>
                                                            </div>
                                                            <div className="text-xs text-muted-foreground mt-0.5">
                                                                {location ? `${location} • ` : ''}{session.ip_address}
                                                            </div>
                                                            <div className="flex items-center gap-1.5 text-xs mt-1">
                                                                {session.is_current ? (
                                                                    <>
                                                                        <span className="relative flex h-2 w-2 ml-0.5">
                                                                            <span
                                                                                className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"
                                                                                style={{ animationDuration: '2s' }}
                                                                            ></span>
                                                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                                                        </span>
                                                                        <span className="text-emerald-500 font-medium">Active now</span>
                                                                    </>
                                                                ) : (
                                                                    <span className="text-muted-foreground">Last active {formatRelativeTime(session.last_active_at)}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {!session.is_current && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                            onClick={() => handleRevokeSession(session.id)}
                                                        >
                                                            Log out
                                                        </Button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                    </main>
                </div>
            </div>

            {/* Passkey Name Dialog */}
            {showPasskeyNameDialog && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <Card className="w-full max-w-sm p-6 animate-in fade-in zoom-in-95 duration-200">
                        <h3 className="text-lg font-semibold mb-4">Name your passkey</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                            Give this passkey a recognizable name so you can identify it later.
                        </p>
                        <FloatingLabelInput
                            id="passkeyName"
                            label="Passkey Name"
                            value={newPasskeyName}
                            onChange={(e) => setNewPasskeyName(e.target.value)}
                            autoFocus
                        />
                        <div className="flex justify-end gap-3 mt-6">
                            <Button
                                variant="ghost"
                                onClick={() => {
                                    setShowPasskeyNameDialog(false);
                                    setNewPasskeyName(''); // clear on cancel
                                }}
                            >
                                Skip
                            </Button>
                            <Button onClick={handleFinishPasskeyRegistration} disabled={registeringPasskey}>
                                {registeringPasskey && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save Passkey
                            </Button>
                        </div>
                    </Card>
                </div>
            )}

            {/* Passkey Password Verification Dialog */}
            {showPasskeyPasswordDialog && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <Card className="w-full max-w-sm p-6 animate-in fade-in zoom-in-95 duration-200">
                        <h3 className="text-lg font-semibold mb-4">Verify Password</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                            Please enter your password to add a new passkey.
                        </p>
                        <FloatingLabelInput
                            id="passkeyPassword"
                            type="password"
                            label="Password"
                            value={passkeyPassword}
                            onChange={(e) => setPasskeyPassword(e.target.value)}
                            autoFocus
                        />
                        <div className="flex justify-end gap-3 mt-6">
                            <Button
                                variant="ghost"
                                onClick={() => { setShowPasskeyPasswordDialog(false); setPasskeyPassword(''); }}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={() => handleRegisterPasskey(passkeyPassword)}
                                disabled={!passkeyPassword || registeringPasskey}
                            >
                                {registeringPasskey && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Verify
                            </Button>
                        </div>
                    </Card>
                </div>
            )}

            {/* Backup Codes Dialog */}
            {showBackupCodes && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <Card className="w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                <Check className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold">2FA Enabled Successfully!</h3>
                                <p className="text-sm text-muted-foreground">Save these backup codes in a safe place.</p>
                            </div>
                        </div>

                        <div className="bg-secondary/50 p-4 rounded-lg border border-border mb-6">
                            <div className="grid grid-cols-2 gap-2 text-center font-mono text-sm">
                                {backupCodes.map((code) => (
                                    <div key={code} className="py-1">{code}</div>
                                ))}
                            </div>
                        </div>

                        <p className="text-xs text-muted-foreground mb-6">
                            If you lose access to your authenticator app, these codes will be the only way to recover your account. Each code can only be used once.
                        </p>

                        <div className="flex justify-end gap-3">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    const text = backupCodes.join('\n');
                                    copyToClipboard(text);
                                }}
                            >
                                <Copy className="mr-2 h-4 w-4" />
                                Copy Codes
                            </Button>
                            <Button onClick={() => setShowBackupCodes(false)}>
                                I've Saved Them
                            </Button>
                        </div>
                    </Card>
                </div>
            )}

            {/* Using Shield icon for module requirement if needed elsewhere, 
                already imported but highlighting usage */}
            <div className="hidden"><Shield /></div>
        </div>
    );
}
