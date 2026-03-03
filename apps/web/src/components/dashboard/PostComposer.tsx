'use client';

import { useState } from 'react';
import { useToast } from '../ui/Toast';
import { FloatingLabelTextarea } from '../ui/FloatingLabelTextarea';
import { ImagePlus, X, Loader2, Send } from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface PostComposerProps {
    onPostCreated: () => void;
}

export function PostComposer({ onPostCreated }: PostComposerProps) {
    const [content, setContent] = useState('');
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [isPosting, setIsPosting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
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
        <Card className="p-4">
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
                        className="rounded-lg object-cover border border-border"
                    />
                    <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => setImageUrl(null)}
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full shadow-md"
                    >
                        <X className="w-3 h-3" />
                    </Button>
                </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        asChild
                        className="cursor-pointer"
                        disabled={isUploading}
                    >
                        <label>
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
                                <ImagePlus className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
                            )}
                        </label>
                    </Button>
                </div>

                <Button
                    onClick={handleSubmit}
                    disabled={isPosting || !content.trim()}
                    className="min-w-[80px]"
                >
                    {isPosting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Post'}
                </Button>
            </div>
        </Card>
    );
}
