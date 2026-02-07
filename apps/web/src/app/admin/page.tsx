'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { NavBar } from '@/components/dashboard/NavBar';
import { useToast } from "@/components/ui/Toast";
import { Loader2, Search, RotateCcw, Shield } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

interface UserProfile {
    id: string;
    username: string;
    display_name: string;
    email?: string;
    role: string;
    created_at?: string;
    has_password: boolean;
}

export default function AdminPage() {
    const router = useRouter();
    const { showToast } = useToast();
    const [user, setUser] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Reset Password State
    const [resettingId, setResettingId] = useState<string | null>(null);
    const [newPassword, setNewPassword] = useState('');
    const [showResetDialog, setShowResetDialog] = useState(false);
    const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

    // Check if user is admin
    useEffect(() => {
        const checkAdmin = async () => {
            try {
                const res = await fetch(`${API_URL}/user/me`, {
                    credentials: 'include',
                });
                if (!res.ok) {
                    router.push('/login');
                    return;
                }
                const data = await res.json();
                if (data.role !== 'admin') {
                    showToast('You do not have permission to view this page.', 'error');
                    router.push('/dashboard');
                    return;
                }
                setUser(data);
                fetchUsers();
            } catch (err) {
                console.error(err);
                router.push('/login');
            } finally {
                setLoading(false);
            }
        };

        checkAdmin();
    }, [router, showToast]);

    const fetchUsers = async () => {
        setLoadingUsers(true);
        try {
            const res = await fetch(`${API_URL}/user/all`, {
                credentials: 'include',
            });
            if (res.ok) {
                const data = await res.json();
                setUsers(data);
            } else {
                showToast('Failed to load users', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('Failed to load users', 'error');
        } finally {
            setLoadingUsers(false);
        }
    };

    const handleResetPassword = async () => {
        if (!selectedUser || !newPassword) return;
        if (newPassword.length < 6) {
            showToast('Password must be at least 6 characters', 'error');
            return;
        }

        setResettingId(selectedUser.id);
        try {
            const res = await fetch(`${API_URL}/admin/users/${selectedUser.id}/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ new_password: newPassword }),
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(text || 'Failed to reset password');
            }

            showToast(`Password for ${selectedUser.username} reset successfully`, 'success');
            setShowResetDialog(false);
            setNewPassword('');
            setSelectedUser(null);
            fetchUsers(); // Refresh to potentially update state if we added tracking later
        } catch (err: unknown) {
            console.error(err);
            let msg = 'Failed to reset password';
            if (err instanceof Error) msg = err.message;
            showToast(msg, 'error');
        } finally {
            setResettingId(null);
        }
    };

    const openResetDialog = (targetUser: UserProfile) => {
        setSelectedUser(targetUser);
        setNewPassword('');
        setShowResetDialog(true);
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString();
    };

    const filteredUsers = users.filter(u =>
        u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const handleLogout = async () => {
        try {
            await fetch(`${API_URL}/auth/logout`, {
                method: 'POST',
                credentials: 'include',
            });
            router.push('/');
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground">
            <NavBar user={user} onLogout={handleLogout} isLoggingOut={false} />

            <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
                        <p className="text-muted-foreground mt-1">Manage users and system settings.</p>
                    </div>
                </div>

                <div className="border border-border rounded-xl bg-card overflow-hidden">
                    <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-4 items-center justify-between">
                        <h2 className="text-lg font-medium flex items-center gap-2">
                            <Shield className="h-5 w-5 text-primary" />
                            Users ({users.length})
                        </h2>
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search users..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-secondary border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-secondary/50 text-muted-foreground font-medium">
                                <tr>
                                    <th className="px-4 py-3">User</th>
                                    <th className="px-4 py-3">Role</th>
                                    <th className="px-4 py-3">Email</th>
                                    <th className="px-4 py-3">Created</th>
                                    <th className="px-4 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {loadingUsers ? (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                                            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                                            Loading users...
                                        </td>
                                    </tr>
                                ) : filteredUsers.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                                            No users found matching "{searchTerm}"
                                        </td>
                                    </tr>
                                ) : (
                                    filteredUsers.map((u) => (
                                        <tr key={u.id} className="hover:bg-secondary/20 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium uppercase">
                                                        {u.username[0]}
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-foreground">{u.display_name}</div>
                                                        <div className="text-xs text-muted-foreground">@{u.username}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${u.role === 'admin'
                                                    ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                                                    : 'bg-secondary text-foreground'
                                                    }`}>
                                                    {u.role}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground">
                                                {u.email || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground">
                                                {formatDate(u.created_at)}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <button
                                                    onClick={() => openResetDialog(u)}
                                                    className="px-3 py-1.5 text-xs font-medium bg-secondary hover:bg-secondary/80 text-foreground rounded-md transition-colors inline-flex items-center gap-1"
                                                >
                                                    <RotateCcw className="h-3 w-3" />
                                                    Reset Password
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Reset Password Dialog */}
            {showResetDialog && selectedUser && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-card w-full max-w-md rounded-xl border border-border p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200">
                        <h3 className="text-lg font-semibold mb-2">Reset Password</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                            Set a new password for <span className="font-medium text-foreground">@{selectedUser.username}</span>.
                            They will be able to log in with this password immediately.
                        </p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1.5">New Password</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 bg-secondary border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    placeholder="Enter new password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    autoFocus
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    Must be at least 6 characters.
                                </p>
                            </div>

                            <div className="flex gap-3 justify-end mt-6">
                                <button
                                    onClick={() => setShowResetDialog(false)}
                                    className="px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary rounded-md transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleResetPassword}
                                    disabled={!newPassword || newPassword.length < 6 || resettingId === selectedUser.id}
                                    className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {resettingId === selectedUser.id && <Loader2 className="h-4 w-4 animate-spin" />}
                                    Reset Password
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
