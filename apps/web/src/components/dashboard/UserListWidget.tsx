'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useToast } from '../ui/Toast';
import { getImageUrl } from '@/lib/utils';

interface User {
    id: string;
    username: string;
    display_name: string;
    email?: string;
    avatar_url?: string;
    role?: string;
}

interface UserListWidgetProps {
    currentUser: { role: string } | null;
}

export function UserListWidget({ currentUser }: UserListWidgetProps) {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const { showToast } = useToast();

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/user/all`, {
                    credentials: 'include',
                });

                if (!res.ok) throw new Error('Failed to fetch users');

                const data = await res.json();
                setUsers(data);
            } catch (err) {
                console.error(err);
                showToast('Could not load user list', 'error');
            } finally {
                setLoading(false);
            }
        };

        fetchUsers();
    }, [showToast]);

    const handleDelete = async (userId: string) => {
        if (!confirm('Are you sure you want to delete this user?')) return;

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/user/${userId}`, {
                method: 'DELETE',
                credentials: 'include',
            });

            if (!res.ok) throw new Error('Failed to delete user');

            setUsers(users.filter(u => u.id !== userId));
            showToast('User deleted successfully', 'success');
        } catch (error) {
            console.error(error);
            showToast('Failed to delete user', 'error');
        }
    };

    const handleAddTestUser = async () => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/user/test`, {
                method: 'POST',
                credentials: 'include',
            });

            if (!res.ok) throw new Error('Failed to create test user');

            const newUser = await res.json();
            setUsers([newUser, ...users]);
            showToast('Test user added', 'success');
        } catch (error) {
            console.error(error);
            showToast('Failed to add test user', 'error');
        }
    };

    if (loading) {
        return (
            <div className="rounded-xl border border-border bg-card shadow-sm h-96 animate-pulse">
                <div className="h-6 w-32 bg-muted rounded mb-4"></div>
                <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-muted"></div>
                            <div className="space-y-2">
                                <div className="h-4 w-24 bg-muted rounded"></div>
                                <div className="h-3 w-32 bg-muted rounded opacity-50"></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden flex flex-col h-96">
            <div className="flex items-center justify-between p-6">
                <h2 className="text-lg tracking-tight">Users</h2>
                {currentUser?.role === 'admin' && (
                    <button
                        onClick={handleAddTestUser}
                        className="cursor-pointer text-xs px-2 py-1 flex items-center gap-2 rounded-full border border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors font-medium"
                    >
                        + Test User
                    </button>
                )}
            </div>

            <div className="overflow-y-auto space-y-4 flex-1">
                {users.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No users found.</p>
                ) : (
                    users.map((user) => (
                        <div key={user.id} className="group relative flex items-center justify-between pl-6 pr-4 py-2 hover:bg-secondary/50 transition-colors">
                            {/* Overlay Link */}
                            <Link href={`/${user.username}`} className="absolute inset-0 z-0" aria-label={`View profile of ${user.display_name || user.username}`} />

                            {/* Content */}
                            <div className="flex items-center gap-3 flex-1 min-w-0 pointer-events-none z-10 relative">
                                <div className="relative h-10 w-10 shrink-0 rounded-full bg-secondary border border-border flex items-center justify-center overflow-hidden text-sm font-bold text-foreground">
                                    {user.avatar_url ? (
                                        <img src={getImageUrl(user.avatar_url)} alt={user.username} className="h-full w-full object-cover" />
                                    ) : (
                                        <span>{user.display_name?.[0] || user.username?.[0] || '?'}</span>
                                    )}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-foreground truncate">
                                        {user.display_name || user.username}
                                    </p>
                                    <p className="text-xs text-muted-foreground truncate">
                                        @{user.username}
                                    </p>
                                </div>
                            </div>

                            {currentUser?.role === 'admin' && (
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleDelete(user.id);
                                    }}
                                    className="relative z-20 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity p-2 text-muted-foreground hover:text-destructive cursor-pointer"
                                    title="Delete User"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M3 6h18"></path>
                                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                                    </svg>
                                </button>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
