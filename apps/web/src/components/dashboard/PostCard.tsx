'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getProfileImageUrl } from '@/lib/utils';
import { Card } from '@/components/ui/card';

interface PostCardProps {
    post: {
        id: string;
        content: string;
        image_url: string | null;
        created_at: string;
        author_id: string;
        author_name: string;
        author_username: string;
        author_avatar: string | null;
    };
}

export function PostCard({ post }: PostCardProps) {
    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    return (
        <Card className="p-4">
            {/* Author Header */}
            <div className="flex items-center gap-3 mb-3">
                <Link href={`/${post.author_username}`}>
                    <Avatar>
                        <AvatarImage src={getProfileImageUrl(post.author_avatar)} alt={post.author_name} />
                        <AvatarFallback>{post.author_name.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                </Link>
                <div className="flex-1 min-w-0">
                    <Link href={`/${post.author_username}`} className="font-medium hover:underline truncate block">
                        {post.author_name}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                        @{post.author_username} · {formatDate(post.created_at)}
                    </p>
                </div>
            </div>

            {/* Content */}
            <p className="text-foreground whitespace-pre-wrap mb-3">{post.content}</p>

            {/* Image */}
            {post.image_url && (
                <div className="relative rounded-lg overflow-hidden">
                    <Image
                        src={post.image_url}
                        alt="Post image"
                        width={600}
                        height={400}
                        className="w-full h-auto object-cover"
                    />
                </div>
            )}
        </Card>
    );
}
