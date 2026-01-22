import React from 'react';
import { Upload, Trash2, X } from 'lucide-react';

interface ImageEditDialogProps {
    isOpen: boolean;
    type: 'avatar_url' | 'banner_url' | null;
    onClose: () => void;
    onUploadConfig: () => void;
    onRemove: () => void;
}

export const ImageEditDialog: React.FC<ImageEditDialogProps> = ({
    isOpen,
    type,
    onClose,
    onUploadConfig,
    onRemove,
}) => {
    if (!isOpen || !type) return null;

    const label = type === 'avatar_url' ? 'Profile picture' : 'Banner';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
            <div className="relative w-full max-w-sm bg-card rounded-xl shadow-xl overflow-hidden border border-border">
                <div className="p-6 space-y-6">
                    <div className="text-center space-y-2">
                        <h3 className="text-xl font-semibold">Edit {label}</h3>
                        <p className="text-sm text-muted-foreground">
                            Choose an action for your {label.toLowerCase()}.
                        </p>
                    </div>

                    <div className="grid gap-3">
                        <button
                            onClick={() => {
                                onUploadConfig();
                            }}
                            className="flex items-center justify-center gap-3 w-full px-4 py-3 bg-secondary/50 hover:bg-secondary text-foreground rounded-lg transition-colors font-medium group"
                        >
                            <Upload className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                            Upload new image
                        </button>

                        <button
                            onClick={onRemove}
                            className="flex items-center justify-center gap-3 w-full px-4 py-3 bg-destructive/10 hover:bg-destructive/20 text-destructive rounded-lg transition-colors font-medium"
                        >
                            <Trash2 className="h-5 w-5" />
                            Remove {label.toLowerCase()}
                        </button>
                    </div>
                </div>

                <div className="p-4 border-t border-border bg-muted/20">
                    <button
                        onClick={onClose}
                        className="w-full px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};
