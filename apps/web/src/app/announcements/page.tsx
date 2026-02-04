'use client';

import { useState, useEffect } from 'react';
import { NavBar } from '@/components/dashboard/NavBar';
import { useRouter } from 'next/navigation';
import { Megaphone, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

interface UserProfile {
    id: string;
    username: string;
    display_name: string;
    avatar_url?: string;
    role: string;
}

interface AnnouncementWithAuthor {
    id: string;
    content: string;
    created_at: string;
    author_name: string;
    author_avatar: string | null;
}

export default function AnnouncementsPage() {
    const router = useRouter();
    const [user, setUser] = useState<UserProfile | null>(null);
    const [announcements, setAnnouncements] = useState<AnnouncementWithAuthor[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/user/me`, {
                    credentials: 'include',
                });
                if (res.ok) {
                    const data = await res.json();
                    setUser(data);
                }
            } catch (error) {
                console.error('Failed to fetch user');
            }
        };

        const fetchAnnouncements = async () => {
            try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/announcements`);
                if (res.ok) {
                    const data = await res.json();
                    setAnnouncements(data);
                }
            } catch (error) {
                console.error('Failed to fetch announcements');
            } finally {
                setLoading(false);
            }
        };

        fetchUser();
        fetchAnnouncements();
    }, []);

    const handleLogout = async () => {
        try {
            await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/auth/logout`, {
                method: 'POST',
                credentials: 'include',
            });
            router.push('/');
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    };

    return (
        <div className="min-h-screen bg-background text-foreground">
            <NavBar user={user} onLogout={handleLogout} isLoggingOut={false} />

            <div className="max-w-3xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="mb-8">
                    <Link
                        href="/dashboard"
                        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Dashboard
                    </Link>
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <Megaphone className="w-8 h-8 text-primary" />
                        All Announcements
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        {announcements.length} announcement{announcements.length !== 1 ? 's' : ''} total
                    </p>
                </div>

                {/* Announcements List */}
                {loading ? (
                    <div className="text-center py-12 text-muted-foreground">Loading...</div>
                ) : announcements.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">No announcements yet.</div>
                ) : (
                    <div className="space-y-4">
                        {announcements.map((ann, index) => (
                            <div
                                key={ann.id}
                                className={`p-5 rounded-xl border ${index === 0
                                        ? 'bg-primary/5 border-primary/20'
                                        : 'bg-card border-border'
                                    }`}
                            >
                                <div className="flex items-center gap-3 mb-3">
                                    {ann.author_avatar ? (
                                        <Image
                                            src={ann.author_avatar}
                                            alt={ann.author_name}
                                            width={40}
                                            height={40}
                                            className="rounded-full"
                                        />
                                    ) : (
                                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                                            <span className="text-sm font-medium text-primary">
                                                {ann.author_name.charAt(0).toUpperCase()}
                                            </span>
                                        </div>
                                    )}
                                    <div>
                                        <p className="font-medium">{ann.author_name}</p>
                                        <p className="text-xs text-muted-foreground">{formatDate(ann.created_at)}</p>
                                    </div>
                                    {index === 0 && (
                                        <span className="ml-auto text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">
                                            Latest
                                        </span>
                                    )}
                                </div>
                                <p className="text-foreground whitespace-pre-wrap">{ann.content}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
