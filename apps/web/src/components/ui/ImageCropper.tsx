import React, { useState, useCallback, useEffect } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import { Upload, Trash2 } from 'lucide-react';
import getCroppedImg from '@/lib/cropImage';

interface ImageCropperProps {
    image: string;
    aspect: number;
    initialCrop?: { x: number, y: number };
    initialZoom?: number;
    onCropComplete: (croppedImage: Blob, crop: { x: number, y: number }, zoom: number) => void;
    onCancel: () => void;
    onRemove?: () => void;
    onUploadSelect?: () => void;
}

export const ImageCropper: React.FC<ImageCropperProps> = ({
    image,
    aspect,
    initialCrop = { x: 0, y: 0 },
    initialZoom = 1,
    onCropComplete,
    onCancel,
    onRemove,
    onUploadSelect
}) => {
    const [crop, setCrop] = useState(initialCrop);
    const [zoom, setZoom] = useState(initialZoom);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

    useEffect(() => {
        console.log('[Debug] ImageCropper mounted/updated');
        console.log('[Debug] Props - initialCrop:', initialCrop);
        console.log('[Debug] Props - initialZoom:', initialZoom);
        setCrop(initialCrop);
        setZoom(initialZoom);
    }, [initialCrop, initialZoom]);

    const onCropChange = (crop: { x: number; y: number }) => {
        setCrop(crop);
    };

    const onZoomChange = (zoom: number) => {
        setZoom(zoom);
    };

    const onCropCompleteInternal = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const handleSave = async () => {
        try {
            if (!croppedAreaPixels) return;

            // Check if image is a GIF (animated)
            // We cannot crop GIFs in the browser without losing animation (canvas converts to static)
            // So we pass the original blob instead
            if (image.startsWith('data:image/gif') || image.toLowerCase().endsWith('.gif')) {
                const response = await fetch(image);
                const blob = await response.blob();
                onCropComplete(blob, crop, zoom);
                return;
            }

            const croppedImage = await getCroppedImg(image, croppedAreaPixels);
            if (croppedImage) {
                onCropComplete(croppedImage, crop, zoom);
            }
        } catch (e) {
            console.error('Error cropping image:', e);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
            <div className="relative w-full max-w-2xl bg-background rounded-lg shadow-xl overflow-hidden flex flex-col h-[80vh] md:h-[600px]">
                <div className="p-4 border-b border-border flex justify-between items-center bg-card">
                    <h3 className="text-lg font-semibold">Crop Image</h3>
                    <button onClick={onCancel} className="text-muted-foreground hover:text-foreground cursor-pointer">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>

                <div className="relative flex-1 bg-black">
                    <Cropper
                        image={image}
                        crop={crop}
                        zoom={zoom}
                        aspect={aspect}
                        onCropChange={onCropChange}
                        onZoomChange={onZoomChange}
                        onCropComplete={onCropCompleteInternal}
                    />
                </div>

                <div className="p-4 bg-card border-t border-border space-y-4">
                    <div className="flex items-center gap-4">
                        <span className="text-sm font-medium">Zoom</span>
                        <input
                            type="range"
                            value={zoom}
                            min={1}
                            max={3}
                            step={0.02}
                            aria-labelledby="Zoom"
                            onChange={(e) => setZoom(Number(e.target.value))}
                            className="
                            w-full h-4 bg-primary/20 rounded-lg appearance-none cursor-pointer focus:outline-none
                            [&::-webkit-slider-thumb]:appearance-none 
                            [&::-webkit-slider-thumb]:rounded-full
                            [&::-webkit-slider-thumb]:h-4 
                            [&::-webkit-slider-thumb]:w-4 
                            [&::-webkit-slider-thumb]:bg-primary

                            [&::-moz-range-thumb]:appearance-none 
                            [&::-moz-range-thumb]:h-4 
                            [&::-moz-range-thumb]:w-4 
                            [&::-moz-range-thumb]:bg-primary
                            [&::-moz-range-thumb]:border-0
                            "
                        />
                    </div>

                    <div className="flex flex-col md:flex-row justify-between gap-3 pt-2">
                        <div className="flex flex-col gap-1">
                            {(image.startsWith('data:image/gif') || image.toLowerCase().endsWith('.gif')) && (
                                <p className="text-xs text-amber-500 font-medium">
                                    Note: Animated GIFs will be saved as-is to preserve animation.
                                </p>
                            )}
                            {onUploadSelect && (
                                <p className="text-xs text-muted-foreground">JPG, GIF or PNG. 10MB max.</p>
                            )}
                            <div className="flex gap-2">
                                {onUploadSelect && (
                                    <button
                                        onClick={onUploadSelect}
                                        className="flex items-center gap-2 px-3 py-2 bg-secondary text-secondary-foreground rounded-md text-sm font-medium hover:bg-secondary/80 transition-colors cursor-pointer"
                                    >
                                        <Upload className="h-4 w-4" />
                                        <span className="hidden sm:inline">Upload New</span>
                                    </button>
                                )}
                                {onRemove && (
                                    <button
                                        onClick={onRemove}
                                        className="flex items-center gap-2 px-3 py-2 bg-destructive/10 text-destructive rounded-md text-sm font-medium hover:bg-destructive/20 transition-colors cursor-pointer"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                        <span className="hidden sm:inline">Remove</span>
                                    </button>
                                )}

                            </div>
                        </div>

                        <div className="flex flex-col justify-end gap-1">
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={onCancel}
                                    className="px-4 py-2 border border-input rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors cursor-pointer"
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
