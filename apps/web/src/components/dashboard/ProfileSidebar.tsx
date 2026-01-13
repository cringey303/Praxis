'use client';

import Link from 'next/link';
import { X, LayoutDashboard, Settings, Sun, Moon, LogOut } from 'lucide-react';

import { useTheme } from 'next-themes';

interface User {
    display_name: string;
    username: string;
    avatar_url?: string;
}

interface ProfileSidebarProps {
    user: User | null;
    isOpen: boolean;
    onClose: () => void;
    onLogout: () => void;
    isLoggingOut: boolean;
}

export function ProfileSidebar({ user, isOpen, onClose, onLogout, isLoggingOut }: ProfileSidebarProps) {
    const { theme, setTheme } = useTheme();

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-[fadeIn_0.3s_ease-out]"
                onClick={onClose}
            >
                <style jsx>{`
                    @keyframes fadeIn {
                        from { opacity: 0; }
                        to { opacity: 1; }
                    }
                `}</style>
            </div>

            <div
                className="relative h-full w-64 bg-card border-l border-border shadow-2xl animate-[slideIn_0.1s_ease-out]"
            >
                <style jsx>{`
                    @keyframes slideIn {
                        from { transform: translateX(100%); }
                        to { transform: translateX(0); }
                    }
                `}</style>
                <div className="flex flex-col h-full p-6">
                    {/* Header / Profile Section */}
                    <div className="flex items-center justify-between mb-6">
                        {user ? (
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 rounded-full bg-secondary border border-border flex items-center justify-center overflow-hidden text-lg font-bold text-foreground">
                                    {user.avatar_url ? (
                                        <img src={user.avatar_url} alt={user.username} className="h-full w-full object-cover" />
                                    ) : (
                                        <span>{user.display_name?.[0] || '?'}</span>
                                    )}
                                </div>
                                <div className="overflow-hidden">
                                    <p className="font-medium truncate">{user.display_name}</p>
                                    <p className="text-sm text-muted-foreground truncate">@{user.username}</p>
                                </div>
                            </div>
                        ) : (
                            <div className="h-12" /> /* Spacer if no user yet */
                        )}

                        <button
                            onClick={onClose}
                            className="cursor-pointer flex align-center items-center justify-center p-2 -mr-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-secondary/50 transition-colors"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <nav className="space-y-2 flex-1">
                        <Link
                            href="/dashboard"
                            className="flex items-center gap-3 py-3 rounded-md text-sm text-muted-foreground font-medium hover:text-foreground transition-colors"
                            onClick={onClose}
                        >
                            <LayoutDashboard className="h-[18px] w-[18px]" />
                            Dashboard
                        </Link>

                        <Link
                            href="/settings/profile"
                            className="flex items-center gap-3 py-3 rounded-md text-sm text-muted-foreground font-medium hover:text-foreground transition-colors"
                            onClick={onClose}
                        >
                            <Settings className="h-[18px] w-[18px]" />
                            Settings
                        </Link>
                    </nav>

                    <div className="pt-6 border-t border-border mt-auto space-y-3">
                        {/* Theme Toggle */}
                        <button
                            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                            className="cursor-pointer w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium bg-secondary text-foreground hover:bg-secondary/80 transition-colors"
                        >
                            {theme === 'dark' ? (
                                <>
                                    <Sun className="h-4 w-4" />
                                    Light Mode
                                </>
                            ) : (
                                <>
                                    <Moon className="h-4 w-4" />
                                    Dark Mode
                                </>
                            )}
                        </button>

                        <button
                            onClick={onLogout}
                            disabled={isLoggingOut}
                            className="cursor-pointer w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50"
                        >
                            {isLoggingOut ? (
                                'Logging out...'
                            ) : (
                                <>
                                    <LogOut className="h-4 w-4" />
                                    Log Out
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
