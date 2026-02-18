'use client';

import { useState } from 'react';
import { useToast } from '../ui/Toast';
import { FloatingLabelTextarea } from '../ui/FloatingLabelTextarea';
import { ImagePlus, X, Loader2, Briefcase } from 'lucide-react';
import Image from 'next/image';
import { ProjectComposer } from './ProjectComposer';

interface PostComposerProps {
    onPostCreated: () => void;
}

export function PostComposer({ onPostCreated }: PostComposerProps) {
    const [content, setContent] = useState('');
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [isPosting, setIsPosting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
    const { showToast } = useToast();

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            showToast('Please select an image file', 'error');
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            showToast('Image must be less than 5MB', 'error');
            return;
        }

        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);

            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/upload`, {
                method: 'POST',
                credentials: 'include',
                body: formData,
            });

            if (!res.ok) throw new Error('Upload failed');

            const data = await res.json();
            setImageUrl(data.url);
        } catch (error) {
            console.error('Upload error:', error);
            showToast('Failed to upload image', 'error');
        } finally {
            setIsUploading(false);
        }
    };

    const handleSubmit = async () => {
        if (!content.trim()) {
            showToast('Please write something', 'error');
            return;
        }

        setIsPosting(true);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/posts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    content: content.trim(),
                    image_url: imageUrl,
                }),
            });

            if (!res.ok) {
                if (res.status === 401) throw new Error('Please log in to post');
                throw new Error('Failed to create post');
            }

            showToast('Post created!', 'success');
            setContent('');
            setImageUrl(null);
            onPostCreated();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to create post';
            showToast(message, 'error');
        } finally {
            setIsPosting(false);
        }
    };

    return (
        <>
        <div className="rounded-xl border border-border p-4 bg-card">
            <FloatingLabelTextarea
                id="post-content"
                label="What's on your mind?"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[100px]"
            />

            {/* Image Preview */}
            {imageUrl && (
                <div className="relative mt-3 inline-block">
                    <Image
                        src={imageUrl}
                        alt="Upload preview"
                        width={200}
                        height={150}
                        className="rounded-lg object-cover"
                    />
                    <button
                        onClick={() => setImageUrl(null)}
                        className="absolute -top-2 -right-2 p-1 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive/90"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsProjectModalOpen(true)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-secondary text-sm text-muted-foreground transition-colors cursor-pointer"
                    >
                        <Briefcase className="w-4 h-4" />
                        New Project
                    </button>
                    <label className="cursor-pointer p-2 rounded-lg hover:bg-secondary transition-colors">
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            className="hidden"
                            disabled={isUploading}
                        />
                        {isUploading ? (
                            <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
                        ) : (
                            <ImagePlus className="w-5 h-5 text-muted-foreground" />
                        )}
                    </label>
                </div>

                <button
                    onClick={handleSubmit}
                    disabled={isPosting || !content.trim()}
                    className="cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isPosting ? 'Posting...' : 'Post'}
                </button>
            </div>
        </div>

        {isProjectModalOpen && (
            <ProjectComposer
                onClose={() => setIsProjectModalOpen(false)}
                onCreated={onPostCreated}
            />
        )}
        </>
    );
}
