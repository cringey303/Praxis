'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';

interface User {
    display_name: string;
    username: string;
    avatar_url?: string;
}

interface NavBarProps {
    user: User | null;
    isLoading?: boolean;
    onLogout: () => void;
    isLoggingOut: boolean;
}

export function NavBar({ user, isLoading = false, onLogout, isLoggingOut }: NavBarProps) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const pathname = usePathname();

    // close sidebar when pathname changes
    useEffect(() => {
        setSidebarOpen(false);
    }, [pathname]);

    return (
        <>
            <header className="sticky top-0 z-40 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl supports-backdrop-filter:bg-background/60">
                <div className="w-full px-3">
                    <div className="flex h-16 items-center justify-between">
                        {/* Logo Area */}
                        <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                            <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl shadow-sm">
                                P
                            </div>
                            <span className="text-xl font-bold tracking-tight text-foreground/90">Praxis</span>
                        </Link>

                        {/* Right Area: User Profile */}
                        {isLoading ? (
                            // Loading state skeleton
                            <div className="flex items-center gap-4 animate-pulse">
                                <div className="hidden sm:block space-y-2">
                                    <div className="h-3 w-20 bg-muted rounded"></div>
                                    <div className="h-2 w-16 bg-muted rounded ml-auto"></div>
                                </div>
                                <div className="h-10 w-10 rounded-full bg-muted"></div>
                            </div>
                        ) : user ? (
                            <div className="flex items-center gap-1">
                                <div className="hidden sm:flex flex-col items-end mr-2">
                                    <span className="text-sm font-medium leading-none">{user.display_name}</span>
                                    <span className="text-xs text-muted-foreground mt-1">@{user.username}</span>
                                </div>
                                <button
                                    onClick={() => setSidebarOpen(true)}
                                    className="relative h-10 w-10 rounded-full border border-border bg-secondary flex items-center justify-center overflow-hidden hover:ring-2 hover:ring-ring hover:ring-offset-2 transition-all cursor-pointer"
                                    aria-label="Open profile menu"
                                >
                                    {user.avatar_url ? (
                                        <img src={user.avatar_url} alt={user.username} className="h-full w-full object-cover" />
                                    ) : (
                                        <span className="font-semibold text-foreground">{user.display_name?.[0]?.toUpperCase() || '?'}</span>
                                    )}
                                </button>
                            </div>
                        ) : (
                            // Guest state
                            <div className="flex items-center gap-4">
                                <Link
                                    href="/login"
                                    className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    Log in
                                </Link>
                                <Link
                                    href="/signup"
                                    className="hidden sm:flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
                                >
                                    Sign up
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <Sidebar
                user={user}
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
                onLogout={onLogout}
                isLoggingOut={isLoggingOut}
            />
        </>
    );
}
