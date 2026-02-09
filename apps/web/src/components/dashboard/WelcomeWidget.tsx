'use client';

import { useState, useEffect } from 'react';
import { useToast } from '../ui/Toast';
import { FloatingLabelTextarea } from '../ui/FloatingLabelTextarea';
import { Megaphone, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

interface WelcomeWidgetProps {
    user: {
        display_name: string;
        role: string;
    } | null;
}

interface Announcement {
    id: string;
    content: string;
    created_at: string;
}

interface AnnouncementWithAuthor {
    id: string;
    content: string;
    created_at: string;
    author_name: string;
    author_avatar: string | null;
}

export function WelcomeWidget({ user }: WelcomeWidgetProps) {
    const [announcement, setAnnouncement] = useState<Announcement | null>(null);
    const [pastAnnouncements, setPastAnnouncements] = useState<AnnouncementWithAuthor[]>([]);
    const [showPast, setShowPast] = useState(false);
    const [newAnnouncement, setNewAnnouncement] = useState('');
    const [isPosting, setIsPosting] = useState(false);
    const { showToast } = useToast();

    // Fetch latest announcement
    useEffect(() => {
        const fetchAnnouncement = async () => {
            try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/announcement`);
                if (res.ok) {
                    const data = await res.json();
                    setAnnouncement(data);
                }
            } catch (error) {
                console.error('Failed to fetch announcement');
            }
        };

        fetchAnnouncement();
    }, []);

    // Fetch past announcements when expanded
    useEffect(() => {
        if (!showPast || pastAnnouncements.length > 0) return;

        const fetchPast = async () => {
            try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/announcements/recent`);
                if (res.ok) {
                    const data = await res.json();
                    setPastAnnouncements(data);
                }
            } catch (error) {
                console.error('Failed to fetch past announcements');
            }
        };

        fetchPast();
    }, [showPast, pastAnnouncements.length]);

    const handlePost = async () => {
        if (!newAnnouncement.trim()) return;

        setIsPosting(true);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/announcement`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ content: newAnnouncement }),
            });

            if (!res.ok) {
                if (res.status === 403) throw new Error('Only admins can post announcements');
                throw new Error('Failed to post announcement');
            }

            showToast('Announcement posted!', 'success');
            setNewAnnouncement('');
            // Refresh announcement immediately
            setAnnouncement({
                id: 'temp',
                content: newAnnouncement,
                created_at: new Date().toISOString(),
            });
            // Clear past to force refetch
            setPastAnnouncements([]);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to post announcement';
            showToast(message, 'error');
        } finally {
            setIsPosting(false);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    return (
        <div className="col-span-full md:col-span-2 rounded-xl border border-border p-6 shadow-sm bg-card relative overflow-hidden min-h-[320px]">
            <div className="relative z-10">
                <h2 className="text-xl mb-2 font-semibold">
                    Welcome Back{user ? `, ${user.display_name}` : ''}
                </h2>

                {/* Announcement Display */}
                <div className="mt-4 p-4 rounded-lg bg-secondary/50 border border-border/50">
                    <h3 className="text-sm font-medium text-primary mb-2 flex items-center gap-2">
                        <Megaphone className="w-4 h-4" />
                        Latest Announcement
                    </h3>
                    {announcement ? (
                        <p className="text-foreground whitespace-pre-wrap">{announcement.content}</p>
                    ) : (
                        <p className="text-muted-foreground italic">No announcements yet.</p>
                    )}
                </div>

                {/* Past Announcements Toggle */}
                <button
                    onClick={() => setShowPast(!showPast)}
                    className="mt-3 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                    {showPast ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    {showPast ? 'Hide' : 'View'} Past Announcements
                </button>

                {/* Past Announcements List */}
                {showPast && (
                    <div className="mt-3 space-y-3">
                        {pastAnnouncements.slice(1).map((ann) => (
                            <div key={ann.id} className="p-3 rounded-lg bg-secondary/30 border border-border/30">
                                <div className="flex items-center gap-2 mb-2">
                                    {ann.author_avatar ? (
                                        <Image
                                            src={ann.author_avatar}
                                            alt={ann.author_name}
                                            width={24}
                                            height={24}
                                            className="rounded-full"
                                        />
                                    ) : (
                                        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                                            <span className="text-xs font-medium text-primary">
                                                {ann.author_name.charAt(0).toUpperCase()}
                                            </span>
                                        </div>
                                    )}
                                    <span className="text-sm font-medium">{ann.author_name}</span>
                                    <span className="text-xs text-muted-foreground">• {formatDate(ann.created_at)}</span>
                                </div>
                                <p className="text-sm text-foreground/80 whitespace-pre-wrap">{ann.content}</p>
                            </div>
                        ))}

                        {pastAnnouncements.length > 1 && (
                            <Link
                                href="/announcements"
                                className="block text-center text-sm text-primary hover:text-primary/80 transition-colors py-2"
                            >
                                View All Announcements →
                            </Link>
                        )}

                        {pastAnnouncements.length <= 1 && (
                            <p className="text-sm text-muted-foreground text-center py-2">No older announcements.</p>
                        )}
                    </div>
                )}

                {/* Admin Input Area */}
                {user?.role === 'admin' && (
                    <div className="mt-6 pt-4 border-t border-border">
                        <label className="text-sm font-medium mb-2 block">Post New Announcement</label>
                        <div className="relative">
                            <FloatingLabelTextarea
                                id="announcement-input"
                                label="Write something..."
                                value={newAnnouncement}
                                onChange={(e) => setNewAnnouncement(e.target.value)}
                                className="min-h-[100px] pr-24"
                            />
                            <div className="absolute bottom-2 right-2">
                                <button
                                    onClick={handlePost}
                                    disabled={isPosting || !newAnnouncement.trim()}
                                    className="cursor-pointer bg-primary text-primary-foreground hover:bg-primary/80 px-4 py-2 rounded-sm text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isPosting ? 'Posting...' : 'Post'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Contextual Background Decoration */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
        </div>
    );
}

