'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Briefcase, Edit3, XCircle } from 'lucide-react';
import { NavBar } from '@/components/dashboard/NavBar';
import { getProfileImageUrl } from '@/lib/utils';

interface Project {
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
}

interface CurrentUser {
    id: string;
    username: string;
    display_name: string;
    avatar_url?: string;
}

const statusColors: Record<string, string> = {
    open: 'bg-green-500/20 text-green-400 border-green-500/30',
    closed: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    completed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

export default function ProjectDetailPage() {
    const params = useParams();
    const username = params.username as string;
    const projectname = params.projectname as string;
    const router = useRouter();

    const [project, setProject] = useState<Project | null>(null);
    const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [projectRes, meRes] = await Promise.all([
                    fetch(
                        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/projects/user/${username}/${projectname}`
                    ),
                    fetch(
                        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/user/me`,
                        { credentials: 'include' }
                    ),
                ]);

                if (!projectRes.ok) {
                    if (projectRes.status === 404) {
                        router.replace('/dashboard');
                        return;
                    }
                    throw new Error('Failed to fetch project');
                }

                const projectData = await projectRes.json();
                setProject(projectData);

                if (meRes.ok) {
                    const meData = await meRes.json();
                    setCurrentUser(meData);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        if (username && projectname) {
            fetchData();
        }
    }, [username, projectname, router]);

    const handleLogout = async () => {
        await fetch(
            `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/auth/logout`,
            { method: 'POST', credentials: 'include' }
        );
        router.push('/');
    };

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

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="flex flex-col items-center gap-4 animate-pulse">
                    <div className="h-8 w-64 bg-muted rounded"></div>
                    <div className="h-4 w-48 bg-muted rounded"></div>
                    <div className="h-4 w-96 bg-muted rounded"></div>
                </div>
            </div>
        );
    }

    if (!project) {
        return null;
    }

    const isOwner = currentUser?.id === project.owner_id;

    return (
        <div className="min-h-screen bg-background text-foreground pb-20">
            <NavBar user={currentUser} onLogout={handleLogout} isLoggingOut={false} />

            <div className="w-full max-w-3xl mx-auto px-4 py-8">
                {/* Banner image */}
                {project.image_url && (
                    <div className="relative w-full rounded-xl overflow-hidden mb-6" style={{ aspectRatio: '16/7' }}>
                        <Image
                            src={project.image_url}
                            alt={project.title}
                            fill
                            className="object-cover"
                        />
                    </div>
                )}

                {/* Header row */}
                <div className="flex flex-wrap items-start gap-3 mb-2">
                    <h1 className="text-3xl font-bold tracking-tight flex-1">{project.title}</h1>
                    <div className="flex items-center gap-2 pt-1">
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                            <Briefcase className="w-3 h-3" />
                            Project
                        </span>
                        <span
                            className={`px-2 py-1 rounded-full text-xs font-medium border ${statusColors[project.status] || statusColors.open}`}
                        >
                            {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                        </span>
                    </div>
                </div>

                {/* Owner row */}
                <div className="flex items-center gap-2 mb-6 text-sm text-muted-foreground">
                    <Link href={`/${project.owner_username}`} className="flex items-center gap-2 hover:opacity-80">
                        {project.owner_avatar ? (
                            <Image
                                src={getProfileImageUrl(project.owner_avatar) || ''}
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
                        <span className="hover:underline font-medium text-foreground">{project.owner_name}</span>
                    </Link>
                    <span>· {formatDate(project.created_at)}</span>
                </div>

                {/* Description */}
                {project.description && (
                    <p className="text-foreground/90 leading-relaxed whitespace-pre-wrap mb-8">
                        {project.description}
                    </p>
                )}

                {/* Owner actions */}
                {isOwner && (
                    <div className="flex items-center gap-3 pt-4 border-t border-border">
                        <button
                            disabled
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-card text-muted-foreground text-sm font-medium cursor-not-allowed opacity-60"
                        >
                            <Edit3 className="w-4 h-4" />
                            Edit Project
                        </button>
                        <button
                            disabled
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-card text-muted-foreground text-sm font-medium cursor-not-allowed opacity-60"
                        >
                            <XCircle className="w-4 h-4" />
                            Close Project
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
