'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Loader2, Camera, MapPin, Link as LinkIcon, Edit3 } from 'lucide-react';
import { NavBar } from '@/components/dashboard/NavBar';
import { FloatingLabelInput } from '../../../components/ui/FloatingLabelInput';
import { FloatingLabelTextarea } from '../../../components/ui/FloatingLabelTextarea';
import { useToast } from "@/components/ui/Toast";
import { ImageCropper } from '@/components/ui/ImageCropper';
import { Skeleton } from '@/components/ui/Skeleton';
import { getProfileImageUrl } from '@/lib/utils';


interface UserProfile {
    id: string;
    username: string;
    display_name: string;
    email?: string;
    avatar_url?: string;
    bio?: string;
    location?: string;
    pronouns?: string;
    website?: string;
    banner_url?: string;
    avatar_original_url?: string;
    banner_original_url?: string;
    avatar_crop_x?: number;
    avatar_crop_y?: number;
    avatar_zoom?: number;
    banner_crop_x?: number;
    banner_crop_y?: number;
    banner_zoom?: number;
    created_at?: string;
}

export default function ProfilePage() {
    const router = useRouter();
    const [user, setUser] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const { showToast } = useToast();

    // Form state
    const [formData, setFormData] = useState({
        username: '',
        display_name: '',
        bio: '',
        location: '',
        pronouns: '',
        website: '',
        avatar_url: '',
        banner_url: '',
        avatar_original_url: '',
        banner_original_url: '',
        avatar_crop_x: 0,
        avatar_crop_y: 0,
        avatar_zoom: 1,
        banner_crop_x: 0,
        banner_crop_y: 0,
        banner_zoom: 1,
    });

    const [errors, setErrors] = useState({
        username: '',
        display_name: '',
        website: '',
    });

    // Cropper State
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [originalFile, setOriginalFile] = useState<File | null>(null);
    const [cropAspect, setCropAspect] = useState(1);
    const [cropType, setCropType] = useState<'avatar_url' | 'banner_url' | null>(null);
    const [initialCrop, setInitialCrop] = useState<{ x: number, y: number } | undefined>(undefined);
    const [initialZoom, setInitialZoom] = useState<number | undefined>(undefined);

    useEffect(() => {
        console.log('[Debug] originalFile state changed:', originalFile ? `${originalFile.name} (${originalFile.size})` : 'null');
    }, [originalFile]);

    // Fetch user data on mount
    useEffect(() => {
        const fetchUser = async () => {
            try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/user/me`, {
                    credentials: 'include',
                });
                if (!res.ok) {
                    if (res.status === 401) {
                        router.push('/login');
                        return;
                    }
                    throw new Error('Failed to load profile');
                }
                const data = await res.json();
                console.log('[Debug] fetchUser data:', data);
                setUser(data);
                setFormData({
                    username: data.username || '',
                    display_name: data.display_name || '',
                    bio: data.bio || '',
                    location: data.location || '',
                    pronouns: data.pronouns || '',
                    website: data.website || '',
                    avatar_url: data.avatar_url || '',
                    banner_url: data.banner_url || '',
                    avatar_original_url: data.avatar_original_url || '',
                    banner_original_url: data.banner_original_url || '',
                    avatar_crop_x: data.avatar_crop_x || 0,
                    avatar_crop_y: data.avatar_crop_y || 0,
                    avatar_zoom: data.avatar_zoom || 1,
                    banner_crop_x: data.banner_crop_x || 0,
                    banner_crop_y: data.banner_crop_y || 0,
                    banner_zoom: data.banner_zoom || 1,
                });
            } catch (err) {
                console.error(err);
                showToast('Could not load profile data.', 'error');
            } finally {
                setLoading(false);
            }
        };

        fetchUser();
    }, [router]);

    const handleLogout = async () => {
        setLoading(true);
        try {
            await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/auth/logout`, {
                method: 'POST',
                credentials: 'include',
            });
            // Redirect to home page
            router.push('/');
        } catch (error) {
            console.error('Logout failed:', error);
            setLoading(false);
        }
    };

    const validateField = (name: string, value: string) => {
        if (name === 'username') {
            if (!value.trim()) return 'Username is required';
        }
        if (name === 'website' && value) {
            // site validation
            const urlPattern = /^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(\/.*)?$/;

            if (!urlPattern.test(value)) {
                return 'Please enter a valid website (e.g., example.com)';
            }
        }
        return '';
    };

    const saveChanges = async () => {
        console.log('UseProfile: Saving changes', formData);
        setUpdating(true);

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/user/profile`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(formData),
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(text || 'Update failed');
            }

            // Success - silently update local state
            // Refresh local user data to reflect changes so next strict comparison works
            setUser((prev) => prev ? { ...prev, ...formData } : null);

            // Clear backend errors if they resolve
            setErrors(prev => ({ ...prev, website: '', username: '' }));

        } catch (err: unknown) {
            console.error('UseProfile: Update failed', err);

            let errorMessage = 'An unexpected error occurred';
            if (err instanceof Error) {
                errorMessage = err.message;
            } else if (typeof err === 'string') {
                errorMessage = err;
            }

            if (errorMessage === 'Website could not be reached') {
                setErrors((prev) => ({ ...prev, website: 'Website could not be reached' }));
                // Optional: show toast if you want attention, but field error is good
                showToast('Website validation failed.', 'error');
            } else if (errorMessage.includes("Username already taken")) {
                setErrors((prev) => ({ ...prev, username: 'Username already taken' }));
            } else {
                showToast(errorMessage, 'error');
            }
        } finally {
            setUpdating(false);
        }
    };

    const handleEditClick = (type: 'avatar_url' | 'banner_url') => {
        // Automatically open the cropper with the existing image if available, or just set type to allow upload
        // Prefer original image if available
        const originalKey = type === 'avatar_url' ? 'avatar_original_url' : 'banner_original_url';
        console.log(`[Debug] Checking original for ${type}. Original Key: ${originalKey}`);
        console.log(`[Debug] Values:`, { cropped: formData[type], original: formData[originalKey] });

        const existingImage = formData[originalKey] || formData[type]; // Fallback to cropped if original not found
        console.log(`[Debug] Selected Image Source:`, existingImage);

        if (existingImage) {
            setImageSrc(existingImage);
            setOriginalFile(null); // Clear any pending new file since we are editing existing
            setCropAspect(type === 'avatar_url' ? 1 : 3);
            setCropType(type);

            // Restore crop state
            const cropXKey = type === 'avatar_url' ? 'avatar_crop_x' : 'banner_crop_x';
            const cropYKey = type === 'avatar_url' ? 'avatar_crop_y' : 'banner_crop_y';
            const zoomKey = type === 'avatar_url' ? 'avatar_zoom' : 'banner_zoom';

            // Retrieve values correctly, defaulting if missing
            const x = formData[cropXKey] || 0;
            const y = formData[cropYKey] || 0;
            const zoom = formData[zoomKey] || 1;

            console.log(`[Debug] Restoring crop state: x=${x}, y=${y}, zoom=${zoom}`);
            setInitialCrop({ x, y });
            setInitialZoom(zoom);
        } else {
            // No image exists, trigger upload directly
            setCropType(type); // track which type we are uploading for
            setInitialCrop(undefined); // Reset for new upload
            setInitialZoom(undefined);
            setTimeout(() => {
                const inputId = type === 'avatar_url' ? 'avatar_upload_hidden' : 'banner_upload_hidden';
                document.getElementById(inputId)?.click();
            }, 0);
        }
    };

    const handleTriggerUpload = () => {
        if (!cropType) return;

        const type = cropType;
        // Close cropper to allow file selection
        setImageSrc(null);

        // Find and click the hidden file input
        const inputId = type === 'avatar_url' ? 'avatar_upload_hidden' : 'banner_upload_hidden';
        document.getElementById(inputId)?.click();
    };

    const handleRemoveImage = async () => {
        if (!cropType) return;
        const type = cropType;

        setUpdating(true);
        handleCropCancel(); // Close modal

        try {
            const originalInfo = type === 'avatar_url' ? 'avatar_original_url' : 'banner_original_url';
            const updatedFormData = { ...formData, [type]: '', [originalInfo]: '' };
            setFormData(updatedFormData);

            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/user/profile`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(updatedFormData),
            });

            if (!res.ok) throw new Error('Failed to remove image');

            setUser((prev) => prev ? { ...prev, [type]: '', [originalInfo]: '' } : null);
            showToast('Image removed successfully', 'success');
        } catch (err) {
            console.error(err);
            showToast('Failed to remove image', 'error');
            // Revert on error if needed, or just let the user try again
        } finally {
            setUpdating(false);
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar_url' | 'banner_url') => {
        const file = e.target.files?.[0];
        if (!file) return;

        console.log('[Debug] handleImageUpload: File selected', file.name, file.size, file.type);

        // Basic validation
        if (!file.type.startsWith('image/')) {
            showToast('Please upload an image file', 'error');
            return;
        }

        // Set aspect ratio based on type
        const aspect = type === 'avatar_url' ? 1 : 3; // 3:1 for banner, 1:1 for avatar

        setOriginalFile(file);

        const reader = new FileReader();
        reader.addEventListener('load', () => {
            setImageSrc(reader.result as string);
            setCropAspect(aspect);
            setCropType(type);
            // Reset the input value so the same file can be selected again if cancelled
            e.target.value = '';
        });
        reader.readAsDataURL(file);
    };

    const handleCropSave = async (croppedBlob: Blob, crop: { x: number, y: number }, zoom: number) => {
        console.log('[Debug] handleCropSave called');
        console.log('[Debug] cropType:', cropType);
        console.log('[Debug] originalFile:', originalFile ? `${originalFile.name} (${originalFile.size} bytes)` : 'null');
        console.log('[Debug] Crop State:', crop, 'Zoom:', zoom);

        if (!cropType) return;

        const type = cropType;
        const originalInfo = type === 'avatar_url' ? 'avatar_original_url' : 'banner_original_url';
        const cropXKey = type === 'avatar_url' ? 'avatar_crop_x' : 'banner_crop_x';
        const cropYKey = type === 'avatar_url' ? 'avatar_crop_y' : 'banner_crop_y';
        const zoomKey = type === 'avatar_url' ? 'avatar_zoom' : 'banner_zoom';

        setImageSrc(null); // Close cropper
        setUpdating(true);

        try {
            // 1. Upload Cropped Image
            const croppedFormData = new FormData();
            const ext = croppedBlob.type.split('/')[1] || 'jpg';
            const filename = `cropped_image.${ext}`;
            croppedFormData.append('file', croppedBlob, filename);

            const resCropped = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/upload`, {
                method: 'POST',
                credentials: 'include',
                body: croppedFormData,
            });

            if (!resCropped.ok) throw new Error('Upload failed for cropped image');
            const dataCropped = await resCropped.json();
            const croppedUrl = dataCropped.url;


            // 2. Upload Original Image (if new file was selected)
            let originalUrl = undefined;
            if (originalFile) {
                const originalFormData = new FormData();
                originalFormData.append('file', originalFile);

                const resOriginal = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/upload`, {
                    method: 'POST',
                    credentials: 'include',
                    body: originalFormData,
                });

                if (!resOriginal.ok) throw new Error('Upload failed for original image');
                const dataOriginal = await resOriginal.json();
                originalUrl = dataOriginal.url;
            }

            const updatePayload: any = {
                ...formData,
                [type]: croppedUrl,
                [cropXKey]: crop.x,
                [cropYKey]: crop.y,
                [zoomKey]: zoom,
            };

            console.log('[Debug] Sending updatePayload:', updatePayload);

            if (originalUrl) {
                updatePayload[originalInfo] = originalUrl;
            }

            // Save Profile
            const resSave = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/user/profile`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(updatePayload),
            });

            if (!resSave.ok) throw new Error('Failed to save profile with new image');

            // Update form data and user state
            setFormData(prev => {
                const updated = {
                    ...prev,
                    [type]: croppedUrl,
                    [cropXKey]: crop.x,
                    [cropYKey]: crop.y,
                    [zoomKey]: zoom
                };
                if (originalUrl) {
                    // @ts-ignore
                    updated[originalInfo] = originalUrl;
                }
                return updated;
            });

            setUser(prev => {
                if (!prev) return null;
                const updated = {
                    ...prev,
                    [type]: croppedUrl,
                    [cropXKey]: crop.x,
                    [cropYKey]: crop.y,
                    [zoomKey]: zoom
                };
                if (originalUrl) {
                    // @ts-ignore
                    updated[originalInfo] = originalUrl;
                }
                return updated;
            });

            showToast('Image uploaded successfully', 'success');

        } catch (err) {
            console.error(err);
            showToast('Failed to upload image', 'error');
        } finally {
            setUpdating(false);
            setCropType(null);
            setOriginalFile(null);
        }
    };

    const handleCropCancel = () => {
        setImageSrc(null);
        setCropType(null);
    };

    const handleBlur = async (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { id, value } = e.target;

        // 1. Validate
        let error = '';
        if (Object.keys(errors).includes(id)) {
            error = validateField(id, value);
            setErrors((prev) => ({ ...prev, [id]: error }));
        }

        if (error) return;

        // 2. Check for changes against original user data
        // Helper to safely get property from user object or empty string
        const originalValue = user ? (user[id as keyof UserProfile] as string || '') : '';
        const currentValue = formData[id as keyof typeof formData];

        if (currentValue !== originalValue) {
            await saveChanges();
        }
    };


    if (loading) {
        return (
            <div className="min-h-screen bg-background text-foreground">
                <NavBar user={null} onLogout={handleLogout} isLoggingOut={false} />

                <div className="p-3">
                    <div className="w-full grid grid-cols-1 md:grid-cols-12 gap-3">

                        {/* Sidebar Skeleton */}
                        <aside className="md:col-span-3 space-y-4">
                            <nav className="flex flex-col gap-1">
                                <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-primary/5 border border-primary/10">
                                    <Skeleton className="h-5 w-5 rounded-full" />
                                    <Skeleton className="h-4 w-24" />
                                </div>
                                <div className="flex items-center gap-3 px-4 py-3">
                                    <Skeleton className="h-5 w-5 rounded-full" />
                                    <Skeleton className="h-4 w-20" />
                                </div>
                                <div className="flex items-center gap-3 px-4 py-3">
                                    <Skeleton className="h-5 w-5 rounded-full" />
                                    <Skeleton className="h-4 w-24" />
                                </div>
                            </nav>
                        </aside>

                        {/* Main Content Skeleton */}
                        <main className="md:col-span-9 bg-card">
                            <div className="space-y-6">
                                <div className="max-w-[700px] flex items-end justify-between mb-4">
                                    <Skeleton className="h-9 w-48" />
                                    <Skeleton className="h-5 w-32" />
                                </div>

                                <div className="w-full max-w-[700px] border border-border rounded-xl shadow-sm overflow-hidden bg-background">

                                    {/* Banner Skeleton */}
                                    <div className="relative w-full aspect-3/1 bg-secondary/30">
                                        <Skeleton className="w-full h-full" />
                                    </div>

                                    <div className="px-6 pb-4">
                                        <div className="flex flex-row gap-4 md:gap-6 relative">

                                            {/* Avatar Skeleton */}
                                            <div className="relative -mt-12 shrink-0 w-32 md:w-auto">
                                                <div className="h-32 w-32 md:h-40 md:w-40 rounded-full border-4 border-background bg-secondary shadow-xl overflow-hidden shrink-0 relative z-10">
                                                    <Skeleton className="w-full h-full" />
                                                </div>

                                                {/* Metadata Skeleton */}
                                                <div className="mt-2 space-y-2 flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <Skeleton className="h-4 w-4 rounded-full" />
                                                        <Skeleton className="h-4 w-24" />
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Skeleton className="h-4 w-4 rounded-full" />
                                                        <Skeleton className="h-4 w-32" />
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Skeleton className="h-4 w-4 rounded-full" />
                                                        <Skeleton className="h-4 w-20" />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Profile Details Skeleton */}
                                            <div className="flex-1 mt-8 md:mt-6 md:pt-2 flex flex-col h-full gap-4">

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <Skeleton className="h-4 w-20" />
                                                        <Skeleton className="h-12 w-full rounded-md" />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Skeleton className="h-4 w-20" />
                                                        <Skeleton className="h-12 w-full rounded-md" />
                                                    </div>
                                                </div>

                                                <div className="pt-2 flex flex-col flex-1 space-y-2">
                                                    <Skeleton className="h-4 w-10" />
                                                    <Skeleton className="h-32 w-full rounded-md" />
                                                </div>

                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Account Settings Skeleton */}
                                <div className="pt-6">
                                    <Skeleton className="h-6 w-32 mb-4" />
                                    <div className="max-w-[700px] p-6 rounded-xl border border-border bg-card/50">
                                        <div className="max-w-md space-y-4">
                                            <div className="space-y-2">
                                                <Skeleton className="h-4 w-24" />
                                                <Skeleton className="h-12 w-full rounded-md" />
                                                <Skeleton className="h-3 w-48 mt-1" />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                            </div>
                        </main>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground">
            <NavBar user={user} onLogout={handleLogout} isLoggingOut={loading} />

            <div className="p-3">
                <div className="w-full grid grid-cols-1 md:grid-cols-12 gap-3">

                    {/* Sidebar Navigation */}
                    <aside className="md:col-span-3 space-y-4">
                        <nav className="flex flex-col gap-1">
                            <Link
                                href="/settings/profile"
                                className="flex items-center gap-3 px-4 py-3 rounded-lg bg-primary/10 border border-primary/20 text-primary transition-all group"
                            >
                                <div className="h-5 w-5 flex items-center justify-center">
                                    {/* User Icon */}
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                                </div>
                                <span className="text-sm font-medium">Profile</span>
                            </Link>

                            <Link
                                href="/settings/security"
                                className="flex items-center gap-3 px-4 py-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 border border-transparent transition-all group"
                            >
                                <div className="h-5 w-5 flex items-center justify-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                                </div>
                                <span className="text-sm font-medium">Security</span>
                            </Link>


                            <button className="flex items-center gap-3 px-4 py-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 border border-transparent transition-all group cursor-not-allowed opacity-60">
                                <div className="h-5 w-5 flex items-center justify-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
                                </div>
                                <span className="text-sm font-medium">Notifications</span>
                            </button>
                        </nav>
                    </aside>

                    {/* Main Content */}
                    <main className="md:col-span-9 bg-card">
                        <div className="space-y-6">
                            <div className="max-w-[700px] flex items-end justify-between mb-4">
                                <h1 className="text-3xl font-semibold tracking-tight">Public Profile</h1>
                                <div className="text-sm text-muted-foreground">
                                    {updating ? (
                                        <div className="flex items-center gap-2">
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                            <span>Saving...</span>
                                        </div>
                                    ) : (
                                        <span>All changes saved</span>
                                    )}
                                </div>
                            </div>

                            <div className="w-full max-w-[700px] border border-border rounded-xl shadow-sm overflow-hidden bg-background">

                                {/* Banner Area (Preview Style) */}
                                <div
                                    className="relative w-full aspect-3/1 bg-secondary/30 overflow-hidden cursor-pointer group "
                                    onClick={() => handleEditClick('banner_url')}
                                >
                                    {formData.banner_url ? (
                                        <Image
                                            src={getProfileImageUrl(formData.banner_url) || ''}
                                            alt="Profile Banner"
                                            fill
                                            className="object-cover transition-opacity group-hover:opacity-90"
                                            unoptimized
                                        />
                                    ) : (
                                        <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-10"></div>
                                    )}
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <div className="flex items-center gap-2 text-white font-medium">
                                            <span>Edit</span>
                                        </div>
                                    </div>

                                </div>

                                <div className="px-6 pb-4">
                                    <div className="flex flex-row gap-4 md:gap-6 relative">

                                        {/* Avatar (Preview Style) */}
                                        <div className="relative -mt-12 shrink-0 w-32 md:w-auto">
                                            <div
                                                className="h-32 w-32 md:h-40 md:w-40 rounded-full border-4 border-background bg-secondary shadow-xl flex items-center justify-center overflow-hidden shrink-0 relative z-10 group cursor-pointer"
                                                onClick={() => handleEditClick('avatar_url')}
                                            >
                                                {formData.avatar_url ? (
                                                    <Image
                                                        src={getProfileImageUrl(formData.avatar_url) || ''}
                                                        alt={formData.username}
                                                        fill
                                                        className="object-cover transition-opacity group-hover:opacity-90"
                                                        unoptimized
                                                    />
                                                ) : (
                                                    <span className="text-4xl font-bold text-foreground">
                                                        {user?.display_name?.[0] || user?.username?.[0] || '?'}
                                                    </span>
                                                )}
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                                    <div className="flex items-center gap-2 text-white font-medium">
                                                        <span>Edit</span>
                                                    </div>
                                                </div>
                                            </div>


                                            {/* Metadata under avatar */}
                                            <div className="mt-2 space-y-2 flex flex-col">
                                                <div className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                                                    <MapPin className="h-4 w-4 shrink-0" />
                                                    <input
                                                        type="text"
                                                        id="location"
                                                        value={formData.location}
                                                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                                        onBlur={handleBlur}
                                                        className="bg-transparent border-none hover:bg-secondary/30 focus:bg-secondary/30 rounded px-1.5 py-0.5 -ml-1.5 focus:ring-0 w-full placeholder-muted-foreground/50"
                                                        placeholder="Add location"
                                                        maxLength={30}
                                                        onClick={(e) => e.stopPropagation()}
                                                    />
                                                </div>

                                                <div className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                                                    <LinkIcon className="h-4 w-4 shrink-0" />
                                                    <input
                                                        type="text"
                                                        id="website"
                                                        value={formData.website}
                                                        onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                                                        onBlur={handleBlur}
                                                        className="bg-transparent border-none hover:bg-secondary/30 focus:bg-secondary/30 rounded px-1.5 py-0.5 -ml-1.5 focus:ring-0 w-full placeholder-muted-foreground/50"
                                                        placeholder="Add website"
                                                        maxLength={30}
                                                        onClick={(e) => e.stopPropagation()}
                                                    />
                                                </div>
                                                {errors.website && <p className="text-xs text-destructive">{errors.website}</p>}

                                                <div className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                                                    <svg
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        width="16"
                                                        height="16"
                                                        viewBox="0 0 24 24"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="2"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        className="h-4 w-4 shrink-0"
                                                    >
                                                        <circle cx="8" cy="8" r="6" />
                                                        <circle cx="16" cy="8" r="6" />
                                                        <circle cx="12" cy="16" r="6" />
                                                    </svg>
                                                    <input
                                                        type="text"
                                                        id="pronouns"
                                                        value={formData.pronouns}
                                                        onChange={(e) => setFormData({ ...formData, pronouns: e.target.value })}
                                                        onBlur={handleBlur}
                                                        className="bg-transparent border-none hover:bg-secondary/30 focus:bg-secondary/30 rounded px-1.5 py-0.5 -ml-1.5 focus:ring-0 w-full placeholder-muted-foreground/50"
                                                        placeholder="Add pronouns"
                                                        maxLength={10}
                                                        onClick={(e) => e.stopPropagation()}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Profile Details (Inline Inputs) */}
                                        <div className="flex-1 mt-8 md:mt-6 md:pt-2 flex flex-col h-full gap-4">

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-1">
                                                    <FloatingLabelInput
                                                        id="display_name"
                                                        type="text"
                                                        label="Display Name"
                                                        value={formData.display_name}
                                                        onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                                                        onBlur={handleBlur}
                                                        error={errors.display_name}
                                                        maxLength={20}
                                                    />
                                                </div>

                                                <div className="space-y-1">
                                                    <FloatingLabelInput
                                                        id="username"
                                                        type="text"
                                                        label="Username"
                                                        value={formData.username}
                                                        onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase() })}
                                                        onBlur={handleBlur}
                                                        error={errors.username}
                                                        maxLength={20}
                                                    />
                                                </div>
                                            </div>

                                            <div className="pt-2 flex flex-col flex-1">
                                                <FloatingLabelTextarea
                                                    id="bio"
                                                    label="Bio"
                                                    value={formData.bio}
                                                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                                                    onBlur={handleBlur}
                                                    maxLength={200}
                                                    className="h-full leading-relaxed"
                                                    wrapperClassName="flex-1 h-full"
                                                />
                                            </div>


                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Account Settings Section */}
                            <div className="pt-6">
                                <h2 className="text-lg font-medium mb-4 px-1">Account Settings</h2>
                                <div className="max-w-[700px] p-6 rounded-xl border border-border bg-card/50">
                                    <div className="max-w-md space-y-4">
                                        <div className="space-y-2">
                                            <FloatingLabelInput
                                                id="email"
                                                label="Email Address"
                                                type="text"
                                                disabled
                                                className="cursor-not-allowed bg-secondary/50 text-muted-foreground"
                                                value={user?.email || 'No email visible'}
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                Subject to change? Contact support.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </main>
                </div>
            </div>

            {/* Hidden Inputs moved here to prevent bubbling loops */}
            <input
                type="file"
                id="banner_upload_hidden"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleImageUpload(e, 'banner_url')}
            />
            <input
                type="file"
                id="avatar_upload_hidden"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleImageUpload(e, 'avatar_url')}
            />

            {imageSrc && (
                <ImageCropper
                    image={imageSrc}
                    aspect={cropAspect}
                    onCropComplete={handleCropSave}
                    onCancel={handleCropCancel}
                    onRemove={handleRemoveImage}
                    onUploadSelect={handleTriggerUpload}
                    initialCrop={initialCrop}
                    initialZoom={initialZoom}
                />
            )}
        </div>
    );
}
