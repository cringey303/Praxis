'use client';

import Link from 'next/link';

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
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>

                    <nav className="space-y-2 flex-1">
                        <Link
                            href="/settings/profile"
                            className="flex items-center gap-3 py-3 rounded-md text-sm text-muted-foreground font-medium hover:text-foreground transition-colors"
                            onClick={onClose}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                <circle cx="12" cy="7" r="4"></circle>
                            </svg>
                            Profile Settings
                        </Link>
                        {/* Placeholder for future links */}
                        <button disabled className="w-full flex items-center gap-3 py-3 rounded-md text-sm font-medium text-muted-foreground opacity-50 cursor-not-allowed">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                            App Settings
                        </button>
                    </nav>

                    <div className="pt-6 border-t border-border mt-auto">
                        <button
                            onClick={onLogout}
                            disabled={isLoggingOut}
                            className="cursor-pointer w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50"
                        >
                            {isLoggingOut ? (
                                'Logging out...'
                            ) : (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                                        <polyline points="16 17 21 12 16 7"></polyline>
                                        <line x1="21" y1="12" x2="9" y2="12"></line>
                                    </svg>
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
