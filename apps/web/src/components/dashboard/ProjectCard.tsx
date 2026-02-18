'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Briefcase } from 'lucide-react';

interface ProjectCardProps {
    project: {
        id: string;
        slug: string;
        title: string;
        description: string | null;
        image_url: string | null;
        status: string;
        created_at: string;
        owner_id: string;
        owner_name: string;
        owner_username: string;
        owner_avatar: string | null;
    };
}

export function ProjectCard({ project }: ProjectCardProps) {
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

    const statusColors: Record<string, string> = {
        open: 'bg-green-500/20 text-green-400 border-green-500/30',
        closed: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
        completed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    };

    return (
        <div className="rounded-xl border border-border p-4 bg-card">
            {/* Project Badge */}
            <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                    <Briefcase className="w-3 h-3" />
                    Project
                </span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium border ${statusColors[project.status] || statusColors.open}`}>
                    {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                </span>
            </div>

            {/* Title */}
            <h3 className="text-lg font-semibold mb-2">
                <Link href={`/${project.owner_username}/${project.slug}`} className="hover:underline">
                    {project.title}
                </Link>
            </h3>

            {/* Description */}
            {project.description && (
                <p className="text-muted-foreground mb-3 line-clamp-3">{project.description}</p>
            )}

            {/* Image */}
            {project.image_url && (
                <div className="relative rounded-lg overflow-hidden mb-3">
                    <Image
                        src={project.image_url}
                        alt={project.title}
                        width={600}
                        height={300}
                        className="w-full h-auto object-cover"
                    />
                </div>
            )}

            {/* Owner Footer */}
            <div className="flex items-center gap-2 pt-3 border-t border-border">
                <Link href={`/${project.owner_username}`}>
                    {project.owner_avatar ? (
                        <Image
                            src={project.owner_avatar}
                            alt={project.owner_name}
                            width={24}
                            height={24}
                            className="rounded-full"
                        />
                    ) : (
                        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                            <span className="text-xs font-medium text-primary">
                                {project.owner_name.charAt(0).toUpperCase()}
                            </span>
                        </div>
                    )}
                </Link>
                <Link href={`/${project.owner_username}`} className="text-sm hover:underline">
                    {project.owner_name}
                </Link>
                <span className="text-sm text-muted-foreground">· {formatDate(project.created_at)}</span>
            </div>
        </div>
    );
}
