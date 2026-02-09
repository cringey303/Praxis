'use client';

import { useState, useEffect, useCallback } from 'react';
import { PostCard } from './PostCard';
import { ProjectCard } from './ProjectCard';
import { PostComposer } from './PostComposer';
import { Loader2 } from 'lucide-react';

interface FeedItem {
    id: string;
    type: string;
    content: string | null;
    title: string | null;
    description: string | null;
    image_url: string | null;
    status: string | null;
    created_at: string;
    author_id: string;
    author_name: string;
    author_username: string;
    author_avatar: string | null;
}

interface FeedWidgetProps {
    user: { display_name: string; username: string } | null;
}

type FilterType = 'all' | 'posts' | 'projects';

export function FeedWidget({ user }: FeedWidgetProps) {
    const [feed, setFeed] = useState<FeedItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState<FilterType>('all');

    const fetchFeed = useCallback(async () => {
        setIsLoading(true);
        try {
            const typeParam = filter === 'all' ? '' : `?type=${filter}`;
            const res = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/feed${typeParam}`
            );
            if (res.ok) {
                const data = await res.json();
                setFeed(data);
            }
        } catch (error) {
            console.error('Failed to fetch feed:', error);
        } finally {
            setIsLoading(false);
        }
    }, [filter]);

    useEffect(() => {
        fetchFeed();
    }, [fetchFeed]);

    const filterTabs: { label: string; value: FilterType }[] = [
        { label: 'All', value: 'all' },
        { label: 'Posts', value: 'posts' },
        { label: 'Projects', value: 'projects' },
    ];

    return (
        <div className="space-y-4">
            {/* Post Composer - only show if logged in */}
            {user && <PostComposer onPostCreated={fetchFeed} />}

            {/* Filter Tabs */}
            <div className="flex gap-1 p-1 bg-secondary/50 rounded-lg w-fit">
                {filterTabs.map((tab) => (
                    <button
                        key={tab.value}
                        onClick={() => setFilter(tab.value)}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                            filter === tab.value
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Feed Items */}
            {isLoading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
            ) : feed.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                    <p>No {filter === 'all' ? 'posts or projects' : filter} yet.</p>
                    {user && <p className="text-sm mt-1">Be the first to share something!</p>}
                </div>
            ) : (
                <div className="space-y-4">
                    {feed.map((item) =>
                        item.type === 'post' ? (
                            <PostCard
                                key={item.id}
                                post={{
                                    id: item.id,
                                    content: item.content || '',
                                    image_url: item.image_url,
                                    created_at: item.created_at,
                                    author_id: item.author_id,
                                    author_name: item.author_name,
                                    author_username: item.author_username,
                                    author_avatar: item.author_avatar,
                                }}
                            />
                        ) : (
                            <ProjectCard
                                key={item.id}
                                project={{
                                    id: item.id,
                                    title: item.title || '',
                                    description: item.description,
                                    image_url: item.image_url,
                                    status: item.status || 'open',
                                    created_at: item.created_at,
                                    owner_id: item.author_id,
                                    owner_name: item.author_name,
                                    owner_username: item.author_username,
                                    owner_avatar: item.author_avatar,
                                }}
                            />
                        )
                    )}
                </div>
            )}
        </div>
    );
}
