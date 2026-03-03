'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X, LayoutDashboard, Settings, User, Sun, Moon, LogOut, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';

import { useTheme } from 'next-themes';

interface User {
    display_name: string;
    username: string;
    avatar_url?: string;
    role?: string;
}

interface SidebarProps {
    user: User | null;
    isOpen: boolean;
    onClose: () => void;
    onLogout: () => void;
    isLoggingOut: boolean;
}

export function Sidebar({ user, isOpen, onClose, onLogout, isLoggingOut }: SidebarProps) {
    const { theme, setTheme } = useTheme();
    const pathname = usePathname();

    // close sidebar when pathname changes
    const handleLinkClick = (href: string) => {
        if (pathname === href) {
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-background/80 backdrop-blur-sm animate-[fadeIn_0.3s_ease-out]"
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
                    {/* Main Content Area */}
                    <div className="flex-1 flex justify-between items-start">
                        <nav className="space-y-2 w-full">
                            <Link
                                href="/dashboard"
                                className="flex items-center gap-3 pb-3 rounded-md text-sm text-muted-foreground font-medium hover:text-foreground transition-colors"
                                onClick={() => handleLinkClick('/dashboard')}
                            >
                                <LayoutDashboard className="h-[18px] w-[18px]" />
                                Dashboard
                            </Link>

                            {user && (
                                <Link
                                    href={`/${user.username}`}
                                    className="flex items-center gap-3 py-3 rounded-md text-sm text-muted-foreground font-medium hover:text-foreground transition-colors"
                                    onClick={() => handleLinkClick(`/${user.username}`)}
                                >
                                    <User className="h-[18px] w-[18px]" />
                                    Profile
                                </Link>
                            )}

                            {user?.role === 'admin' && (
                                <Link
                                    href="/admin"
                                    className="flex items-center gap-3 py-3 rounded-md text-sm text-muted-foreground font-medium hover:text-foreground transition-colors"
                                    onClick={() => handleLinkClick('/admin')}
                                >
                                    <Shield className="h-[18px] w-[18px]" />
                                    Admin
                                </Link>
                            )}

                            <Link
                                href="/settings/profile"
                                className="flex items-center gap-3 py-3 rounded-md text-sm text-muted-foreground font-medium hover:text-foreground transition-colors"
                                onClick={() => handleLinkClick('/settings/profile')}
                            >
                                <Settings className="h-[18px] w-[18px]" />
                                Settings
                            </Link>
                        </nav>

                        <button
                            onClick={onClose}
                            className="relative cursor-pointer flex align-center items-center justify-center text-muted-foreground hover:text-foreground transition-colors after:absolute after:-inset-2 after:content-['']"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="pt-6 border-t border-border mt-auto space-y-3">
                        {/* Theme Toggle */}
                        <Button
                            variant="secondary"
                            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                            className="w-full justify-center gap-2"
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
                        </Button>

                        <Button
                            variant="destructive"
                            onClick={onLogout}
                            disabled={isLoggingOut}
                            className="w-full justify-center gap-2 bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive"
                        >
                            {isLoggingOut ? (
                                'Logging out...'
                            ) : (
                                <>
                                    <LogOut className="h-4 w-4" />
                                    Log Out
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
