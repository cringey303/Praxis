'use client';

import { useEffect, useState } from 'react';
import { useToast } from '../ui/Toast';

interface User {
    id: string;
    username: string;
    display_name: string;
    email?: string;
    avatar_url?: string;
}

export function UserListWidget() {
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

    if (loading) {
        return (
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm h-96 animate-pulse">
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
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm overflow-hidden flex flex-col h-96">
            <h2 className="text-lg tracking-tight mb-4">Users</h2>

            <div className="overflow-y-auto pr-2 space-y-4 flex-1">
                {users.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No users found.</p>
                ) : (
                    users.map((user) => (
                        <div key={user.id} className="flex items-center gap-3 group p-2 rounded-lg hover:bg-secondary/50 transition-colors">
                            <div className="relative h-10 w-10 flex-shrink-0 rounded-full bg-secondary border border-border flex items-center justify-center overflow-hidden text-sm font-bold text-muted-foreground">
                                {user.avatar_url ? (
                                    <img src={user.avatar_url} alt={user.username} className="h-full w-full object-cover" />
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
                    ))
                )}
            </div>
        </div>
    );
}
