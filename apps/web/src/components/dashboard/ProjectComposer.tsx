'use client';

import { useState, useEffect } from 'react';
import { useToast } from '../ui/Toast';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { FloatingLabelTextarea } from '../ui/FloatingLabelTextarea';
import { ImagePlus, X, Loader2 } from 'lucide-react';
import Image from 'next/image';

interface ProjectComposerProps {
    onClose: () => void;
    onCreated: () => void;
}

export function ProjectComposer({ onClose, onCreated }: ProjectComposerProps) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [isPosting, setIsPosting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const { showToast } = useToast();

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            showToast('Please select an image file', 'error');
            return;
        }

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
        if (!title.trim()) {
            showToast('Please enter a project title', 'error');
            return;
        }

        setIsPosting(true);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/projects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    title: title.trim(),
                    description: description.trim() || null,
                    image_url: imageUrl,
                }),
            });

            if (!res.ok) {
                if (res.status === 401) throw new Error('Please log in');
                throw new Error('Failed to create project');
            }

            showToast('Project created!', 'success');
            onCreated();
            onClose();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to create project';
            showToast(message, 'error');
        } finally {
            setIsPosting(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="relative w-full max-w-lg bg-card rounded-xl border border-border shadow-xl">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border">
                    <h2 className="text-lg font-semibold">New Project</h2>
                    <button
                        onClick={onClose}
                        className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-4 space-y-4">
                    <FloatingLabelInput
                        id="project-title"
                        label="Project title (required)"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                    />

                    <FloatingLabelTextarea
                        id="project-description"
                        label="Description (optional)"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="min-h-[100px]"
                    />

                    {/* Image Upload */}
                    <div>
                        <label className="inline-flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border border-input hover:bg-secondary transition-colors text-sm text-muted-foreground">
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleImageUpload}
                                className="hidden"
                                disabled={isUploading}
                            />
                            {isUploading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <ImagePlus className="w-4 h-4" />
                            )}
                            Add image
                        </label>

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
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end p-4 border-t border-border">
                    <button
                        onClick={handleSubmit}
                        disabled={isPosting || !title.trim()}
                        className="cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isPosting ? 'Creating...' : 'Create Project'}
                    </button>
                </div>
            </div>
        </div>
    );
}
