'use client';

import { useState, useEffect } from 'react';
import { useToast } from '../ui/Toast';
import { FloatingLabelTextarea } from '../ui/FloatingLabelTextarea';

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

export function WelcomeWidget({ user }: WelcomeWidgetProps) {
    const [announcement, setAnnouncement] = useState<Announcement | null>(null);
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
        } catch (error: any) {
            showToast(error.message, 'error');
        } finally {
            setIsPosting(false);
        }
    };

    return (
        <div className="col-span-full md:col-span-2 rounded-xl border border-border p-6 shadow-sm bg-card relative overflow-hidden">
            <div className="relative z-10">
                <h2 className="text-xl mb-2 font-semibold">
                    Welcome Back{user ? `, ${user.display_name}` : ''}
                </h2>

                {/* Announcement Display */}
                <div className="mt-4 p-4 rounded-lg bg-secondary/50 border border-border/50">
                    <h3 className="text-sm font-medium text-primary mb-2 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5c0-5 5-5 10 0Z" /><path d="M8 9h.01" /><path d="M16 9h.01" /><path d="M12 16c1.5 0 3-.6 3-1.5" /></svg>
                        Latest Announcement
                    </h3>
                    {announcement ? (
                        <p className="text-foreground whitespace-pre-wrap">{announcement.content}</p>
                    ) : (
                        <p className="text-muted-foreground italic">No announcements yet.</p>
                    )}
                </div>

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
                                    className="cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
