'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Calendar, MapPin, Link as LinkIcon, Share2, Edit3, MessageSquare } from 'lucide-react';
import { NavBar } from '@/components/dashboard/NavBar';
import { useToast } from "@/components/ui/Toast";
import { getProfileImageUrl } from '@/lib/utils';
import { PostCard } from '@/components/dashboard/PostCard';


interface PublicUserProfile {
    username: string;
    display_name: string;
    avatar_url?: string;
    bio?: string;
    location?: string;
    website?: string;
    banner_url?: string;
    pronouns?: string;
    created_at?: string;
}

interface CurrentUser {
    id: string;
    username: string;
    display_name: string;
    avatar_url?: string;
}

interface Post {
    id: string;
    content: string;
    image_url: string | null;
    created_at: string;
    author_id: string;
    author_name: string;
    author_username: string;
    author_avatar: string | null;
}

export default function PublicProfilePage() {
    const params = useParams();
    const username = params.username as string;
    const router = useRouter();
    const { showToast } = useToast();

    const [profile, setProfile] = useState<PublicUserProfile | null>(null);
    const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [posts, setPosts] = useState<Post[]>([])


    useEffect(() => {
        const fetchData = async () => {
            try {
                // 1. Fetch Public Profile
                const profileRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/user/profile/${username}`);
                if (!profileRes.ok) {
                    if (profileRes.status === 404) {
                        // Handle 404
                    }
                    throw new Error('Profile not found');
                }
                const profileData = await profileRes.json();
                setProfile(profileData);

                // 2. Fetch Current User (for NavBar and Edit button)
                const meRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/user/me`, {
                    credentials: 'include',
                });
                if (meRes.ok) {
                    const meData = await meRes.json();
                    setCurrentUser(meData);
                }
                const postRes = await fetch(
                    `${process.env.NEXT_PUBLIC_API_URL || 
                        'http://localhost:8080'}/posts/user/${username}`
                );
                if (postRes.ok){
                    const postsData = await postRes.json();
                    setPosts(postsData);
                }
            } catch (err) {
                console.error(err);
                // showToast('Failed to load profile', 'error');
            } finally {
                setLoading(false);
            }
        };

        if (username) {
            fetchData();
        }
    }, [username]);

    const handleLogout = async () => {
        setIsLoggingOut(true);
        try {
            await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/auth/logout`, {
                method: 'POST',
                credentials: 'include',
            });
            router.push('/');
        } catch (error) {
            console.error('Logout failed:', error);
        } finally {
            setIsLoggingOut(false);
        }
    };

    const handleShare = () => {
        navigator.clipboard.writeText(window.location.href);
        showToast('Profile link copied to clipboard', 'success');
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="flex flex-col items-center gap-4 animate-pulse">
                    <div className="h-24 w-24 rounded-full bg-muted"></div>
                    <div className="h-6 w-32 bg-muted rounded"></div>
                    <div className="h-4 w-48 bg-muted rounded"></div>
                </div>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="min-h-screen bg-background flex flex-col">
                <NavBar user={currentUser} onLogout={handleLogout} isLoggingOut={isLoggingOut} />
                <div className="flex-1 flex flex-col items-center justify-center space-y-4">
                    <h1 className="text-2xl font-bold">User not found</h1>
                    <p className="text-muted-foreground">The user @{username} does not exist.</p>
                    <Link href="/dashboard" className="text-primary hover:underline">Return to Dashboard</Link>
                </div>
            </div>
        );
    }

    const isOwnProfile = currentUser?.username === profile.username;

    return (
        <div className="min-h-screen bg-background text-foreground pb-20">
            <NavBar user={currentUser} onLogout={handleLogout} isLoggingOut={isLoggingOut} />

            <div className="w-full max-w-[7000px] mx-auto border-x border-border min-h-screen">
                {/* Banner Area */}
                <div className="relative w-full aspect-3/1 bg-secondary/30 overflow-hidden">
                    {profile.banner_url ? (
                        <img
                            src={getProfileImageUrl(profile.banner_url)}
                            alt="Profile Banner"
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-10"></div>
                    )}
                </div>

                <main className="px-6 relative z-10 -mt-12">
                    <div className="flex flex-col md:flex-row gap-6 md:items-start">
                        {/* Avatar */}
                        <div className="relative h-32 w-32 md:h-40 md:w-40 rounded-full border-4 border-background bg-secondary shadow-xl flex items-center justify-center overflow-hidden shrink-0">
                            {profile.avatar_url ? (
                                <img src={getProfileImageUrl(profile.avatar_url)} alt={profile.username} className="h-full w-full object-cover" />
                            ) : (
                                <span className="text-4xl font-bold text-foreground">
                                    {profile.display_name?.[0] || profile.username?.[0]}
                                </span>
                            )}
                        </div>

                        {/* Profile Info */}
                        <div className="flex-1">
                            <div className="pt-16 flex flex-col md:flex-row md:items-start justify-between gap-4">
                                <div>
                                    <h1 className="text-3xl font-bold tracking-tight">{profile.display_name}</h1>
                                    <p className="text-lg text-muted-foreground">@{profile.username}</p>
                                </div>

                                <div className="flex items-center gap-3">
                                    {isOwnProfile ? (
                                        <Link
                                            href="/settings/profile"
                                            className="flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors font-medium text-sm"
                                        >
                                            <Edit3 className="h-4 w-4" />
                                            Edit Profile
                                        </Link>
                                    ) : (
                                        <button
                                            onClick={() => { }}
                                            className="cursor-not-allowed flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-opacity font-medium text-sm"
                                        >
                                            <MessageSquare className="h-4 w-4" />
                                            Message
                                        </button>
                                    )}
                                    <button
                                        onClick={handleShare}
                                        className="p-2 rounded-full border border-border bg-card hover:bg-secondary hover:text-foreground transition-colors cursor-pointer text-muted-foreground"
                                        aria-label="Share profile"
                                    >
                                        <Share2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>

                            {(profile.bio || ' ') && (
                                <div className="mt-4 max-w-2xl">
                                    <p className="text-foreground/90 whitespace-pre-wrap leading-relaxed break-words">
                                        {profile.bio || ' '}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Content Area */}
                    <div className="mt-8 flex flex-col md:flex-row gap-8 items-start">
                        {/* Left Column: Metadata */}
                        <div className="flex flex-col gap-6 shrink-0 w-full md:w-auto">
                            <div className="space-y-4 pt-1 whitespace-nowrap">


                                {profile.location && (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <MapPin className="h-4 w-4" />
                                        <span>{profile.location}</span>
                                    </div>
                                )}

                                {profile.website && (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <LinkIcon className="h-4 w-4" />
                                        <a
                                            href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="hover:text-primary transition-colors"
                                        >
                                            {profile.website.replace(/^https?:\/\//, '')}
                                        </a>
                                    </div>
                                )}

                                {profile.pronouns && (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            width="16"
                                            height="16"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            className="h-4 w-4 shrink-0"
                                        >
                                            <circle cx="8" cy="8" r="6" />
                                            <circle cx="16" cy="8" r="6" />
                                            <circle cx="12" cy="16" r="6" />
                                        </svg>
                                        <span>{profile.pronouns}</span>
                                    </div>
                                )}

                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Calendar className="h-4 w-4" />
                                    <span>Joined {profile.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'recently'}</span>
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Posts */}
                        <div className="flex-1 w-full max-w-full">
                            <div className="space-y-4">
                                {posts.length > 0 ? (
                                    posts.map((post) => (
                                        <PostCard key={post.id} post={post} />
                                    ))
                                ) : (
                                    <div className="rounded-xl border border-border border-dashed p-12 flex flex-col items-center justify-center text-center text-muted-foreground bg-secondary/20">
                                        <h3 className="text-lg font-medium text-foreground">No posts yet</h3>
                                        <p className="text-sm max-w-sm mt-1">
                                            {profile.display_name} hasn't published any content yet.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
