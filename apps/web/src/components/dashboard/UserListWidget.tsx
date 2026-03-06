'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useToast } from '../ui/Toast';
import { getProfileImageUrl } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Trash2, UserPlus } from 'lucide-react';

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
            <div className="rounded-xl border border-border bg-card shadow-sm h-full animate-pulse p-6">
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
        <Card className="flex flex-col h-full max-h-[390px] overflow-hidden">
            <div className="flex items-center justify-between p-6">
                <h2 className="text-lg font-semibold tracking-tight">Users</h2>
                {currentUser?.role === 'admin' && (
                    <Button
                        onClick={handleAddTestUser}
                        size="sm"
                        variant="outline"
                        className="gap-2 h-7 rounded-full text-xs"
                    >
                        <UserPlus className="h-3 w-3" />
                        Test User
                    </Button>
                )}
            </div>

            <div className="overflow-y-auto space-y-1 flex-1 px-2 pb-2">
                {users.length === 0 ? (
                    <p className="text-muted-foreground text-sm text-center py-4">No users found.</p>
                ) : (
                    users.map((user) => (
                        <div key={user.id} className="group relative flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
                            {/* Overlay Link */}
                            <Link href={`/${user.username}`} className="absolute inset-0 z-0" aria-label={`View profile of ${user.display_name || user.username}`} />

                            {/* Content */}
                            <div className="flex items-center gap-3 flex-1 min-w-0 pointer-events-none z-10 relative">
                                <Avatar className="h-9 w-9 border border-border">
                                    <AvatarImage src={getProfileImageUrl(user.avatar_url)} alt={user.username} className="object-cover" />
                                    <AvatarFallback>{user.display_name?.[0] || user.username?.[0] || '?'}</AvatarFallback>
                                </Avatar>
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
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleDelete(user.id);
                                    }}
                                    className="relative z-20 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity h-8 w-8 text-muted-foreground hover:text-destructive"
                                    title="Delete User"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    ))
                )}
            </div>
        </Card>
    );
}
