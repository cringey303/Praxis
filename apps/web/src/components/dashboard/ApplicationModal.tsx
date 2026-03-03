'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Minus } from 'lucide-react';
import { useToast } from '../ui/Toast';
import { FloatingLabelTextarea } from '../ui/FloatingLabelTextarea';
import Link from 'next/link';

interface ApplicationModalProps {
    projectId: string;
    applicantMajor?: string;
    onClose: () => void;
}

export function ApplicationModal({ projectId, applicantMajor, onClose }: ApplicationModalProps) {
    const [message, setMessage] = useState('');
    const [links, setLinks] = useState<string[]>(['']);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { showToast } = useToast();

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const addLink = () => {
        if (links.length < 3) setLinks([...links, '']);
    };

    const removeLink = (index: number) => {
        setLinks(links.filter((_, i) => i !== index));
    };

    const updateLink = (index: number, value: string) => {
        const updated = [...links];
        updated[index] = value;
        setLinks(updated);
    };

    const handleSubmit = async () => {
        if (!message.trim()) {
            showToast('Please write a message', 'error');
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/projects/${projectId}/apply`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        message: message.trim(),
                        links: links.filter(Boolean),
                    }),
                }
            );

            if (res.status === 201) {
                showToast('Application sent!', 'success');
                onClose();
            } else if (res.status === 409) {
                showToast("You've already applied to this project", 'error');
            } else if (res.status === 401) {
                showToast('Please log in', 'error');
            } else {
                showToast('Failed to submit application', 'error');
            }
        } catch {
            showToast('Failed to submit application', 'error');
        } finally {
            setIsSubmitting(false);
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
                    <h2 className="text-lg font-semibold">Apply to Project</h2>
                    <button
                        onClick={onClose}
                        className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-4 space-y-4">
                    {/* Major chip */}
                    <div>
                        {applicantMajor ? (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-500/10 text-purple-400 border border-purple-500/30">
                                {applicantMajor}
                            </span>
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                Your major is not set.{' '}
                                <Link href="/settings/profile" className="text-primary hover:underline">
                                    Add it in settings
                                </Link>
                                {' '}to help project owners know your background.
                            </p>
                        )}
                    </div>

                    {/* Message */}
                    <FloatingLabelTextarea
                        id="application-message"
                        label="Why are you interested? (required)"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className="min-h-[120px]"
                    />

                    {/* Links */}
                    <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Supporting links (portfolio, GitHub, etc.)</p>
                        {links.map((link, index) => (
                            <div key={index} className="flex items-center gap-2">
                                <input
                                    type="url"
                                    value={link}
                                    onChange={(e) => updateLink(index, e.target.value)}
                                    placeholder={`Link ${index + 1}`}
                                    className="flex-1 px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                />
                                {links.length > 1 && (
                                    <button
                                        onClick={() => removeLink(index)}
                                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                                    >
                                        <Minus className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        ))}
                        {links.length < 3 && (
                            <button
                                onClick={addLink}
                                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                            >
                                <Plus className="w-4 h-4" />
                                Add link
                            </button>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end p-4 border-t border-border">
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || !message.trim()}
                        className="cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? 'Submitting...' : 'Submit Application'}
                    </button>
                </div>
            </div>
        </div>
    );
}
