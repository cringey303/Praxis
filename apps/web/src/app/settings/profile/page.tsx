'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Loader2 } from 'lucide-react';
import { NavBar } from '@/components/dashboard/NavBar';
import { FloatingLabelInput } from '../../../components/ui/FloatingLabelInput';
import { FloatingLabelTextarea } from '../../../components/ui/FloatingLabelTextarea';
import { useToast } from "@/components/ui/Toast";
import { ImageCropper } from '@/components/ui/ImageCropper';

interface UserProfile {
    id: string;
    username: string;
    display_name: string;
    email?: string;
    avatar_url?: string;
    bio?: string;
    location?: string;
    website?: string;
    banner_url?: string;
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
        website: '',
        avatar_url: '',
        banner_url: '',
    });

    const [errors, setErrors] = useState({
        username: '',
        display_name: '',
        website: '',
    });

    // Cropper State
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [cropAspect, setCropAspect] = useState(1);
    const [cropType, setCropType] = useState<'avatar_url' | 'banner_url' | null>(null);

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
                setUser(data);
                setFormData({
                    username: data.username || '',
                    display_name: data.display_name || '',
                    bio: data.bio || '',
                    location: data.location || '',
                    website: data.website || '',
                    avatar_url: data.avatar_url || '',
                    banner_url: data.banner_url || '',
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
            const urlPattern = /^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}$/;

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

        } catch (err: any) {
            console.error('UseProfile: Update failed', err);

            if (err.message === 'Website could not be reached') {
                setErrors((prev) => ({ ...prev, website: 'Website could not be reached' }));
                // Optional: show toast if you want attention, but field error is good
                showToast('Website validation failed.', 'error');
            } else if (err.message.includes("Username already taken")) {
                setErrors((prev) => ({ ...prev, username: 'Username already taken' }));
            } else {
                showToast(err.message, 'error');
            }
        } finally {
            setUpdating(false);
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar_url' | 'banner_url') => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Basic validation
        if (!file.type.startsWith('image/')) {
            showToast('Please upload an image file', 'error');
            return;
        }

        // Set aspect ratio based on type
        const aspect = type === 'avatar_url' ? 1 : 3; // 3:1 for banner, 1:1 for avatar

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

    const handleCropSave = async (croppedBlob: Blob) => {
        if (!cropType) return;

        setImageSrc(null); // Close cropper
        setUpdating(true);

        const uploadFormData = new FormData();
        // Append blob with a filename
        uploadFormData.append('file', croppedBlob, 'cropped_image.jpg');

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/upload`, {
                method: 'POST',
                credentials: 'include',
                body: uploadFormData,
            });

            if (!res.ok) throw new Error('Upload failed');

            const data = await res.json();
            const fullUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}${data.url}`;

            // Update form data
            setFormData(prev => {
                const updated = { ...prev, [cropType]: fullUrl };
                return updated;
            });

            // Save Profile
            const resSave = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/user/profile`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ ...formData, [cropType]: fullUrl }),
            });

            if (!resSave.ok) throw new Error('Failed to save profile with new image');

            // Update local user state
            setUser(prev => prev ? { ...prev, [cropType]: fullUrl } : null);
            showToast('Image uploaded successfully', 'success');

        } catch (err) {
            console.error(err);
            showToast('Failed to upload image', 'error');
        } finally {
            setUpdating(false);
            setCropType(null);
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
            <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
                <div className="animate-pulse flex flex-col items-center">
                    <div className="h-12 w-12 rounded-full bg-muted mb-4"></div>
                    <div className="h-4 w-32 bg-muted rounded"></div>
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

                            <button className="flex items-center gap-3 px-4 py-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 border border-transparent transition-all group cursor-not-allowed opacity-60">
                                <div className="h-5 w-5 flex items-center justify-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                                </div>
                                <span className="text-sm font-medium">Security</span>
                            </button>


                            <button className="flex items-center gap-3 px-4 py-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 border border-transparent transition-all group cursor-not-allowed opacity-60">
                                <div className="h-5 w-5 flex items-center justify-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
                                </div>
                                <span className="text-sm font-medium">Notifications</span>
                            </button>
                        </nav>
                    </aside>

                    {/* Main Content */}
                    <main className="md:col-span-9 rounded-xl border border-border p-6 shadow-sm bg-card">
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <h1 className="text-3xl font-semibold tracking-tight">Profile</h1>
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

                            <div className="border-t border-border my-6"></div>

                            <form
                                className="space-y-8 max-w-2xl"
                                autoComplete="off"
                                data-lpignore="true"
                                onSubmit={(e) => e.preventDefault()}
                            >

                                {/* Profile Picture Section */}
                                <div className="space-y-4">
                                    <label className="block text-sm font-medium">Profile picture</label>
                                    <div className="flex items-center gap-6">
                                        <div className="relative h-24 w-24 rounded-full overflow-hidden border border-border bg-secondary flex items-center justify-center text-2xl font-bold uppercase text-foreground">
                                            {formData.avatar_url ? (
                                                <Image
                                                    src={formData.avatar_url}
                                                    alt={formData.username}
                                                    fill
                                                    className="object-cover"
                                                />
                                            ) : (
                                                <span>{user?.display_name?.[0] || user?.username?.[0] || '?'}</span>
                                            )}
                                        </div>
                                        <div>
                                            <input
                                                type="file"
                                                id="avatar_upload"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={(e) => handleImageUpload(e, 'avatar_url')}
                                            />
                                            <label
                                                htmlFor="avatar_upload"
                                                className="cursor-pointer px-4 py-2 border border-input rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors inline-block"
                                            >
                                                Upload new picture
                                            </label>
                                            <p className="text-xs text-muted-foreground mt-2">JPG, GIF or PNG. 1MB max.</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Banner Section */}
                                <div className="space-y-4">
                                    <label className="block text-sm font-medium">Banner</label>
                                    <div className="relative h-32 w-full rounded-lg overflow-hidden border border-border bg-secondary flex items-center justify-center">
                                        {formData.banner_url ? (
                                            <Image
                                                src={formData.banner_url}
                                                alt="Profile Banner"
                                                fill
                                                className="object-cover"
                                            />
                                        ) : (
                                            <span className="text-muted-foreground text-sm">No banner uploaded</span>
                                        )}
                                        <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <input
                                                type="file"
                                                id="banner_upload"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={(e) => handleImageUpload(e, 'banner_url')}
                                            />
                                            <label
                                                htmlFor="banner_upload"
                                                className="cursor-pointer px-4 py-2 bg-background/80 hover:bg-background text-foreground rounded-md text-sm font-medium transition-colors"
                                            >
                                                Change Banner
                                            </label>
                                        </div>
                                    </div>
                                    {!formData.banner_url && (
                                        <div>
                                            <input
                                                type="file"
                                                id="banner_upload_btn"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={(e) => handleImageUpload(e, 'banner_url')}
                                            />
                                            <label
                                                htmlFor="banner_upload_btn"
                                                className="cursor-pointer px-4 py-2 border border-input rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors inline-block"
                                            >
                                                Upload banner
                                            </label>
                                        </div>
                                    )}
                                </div>

                                {/* Name Input */}
                                <div className="space-y-2">
                                    <FloatingLabelInput
                                        id="display_name"
                                        label="Display Name"
                                        type="text"
                                        value={formData.display_name}
                                        autoComplete="off"
                                        data-lpignore="true"
                                        error={errors.display_name}
                                        onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                                        onBlur={handleBlur}
                                    />

                                </div>

                                {/* Location Input */}
                                <div className="space-y-2">
                                    <FloatingLabelInput
                                        id="location"
                                        label="Location"
                                        type="text"
                                        value={formData.location}
                                        autoComplete="off"
                                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                        onBlur={handleBlur}
                                        maxLength={100}
                                    />
                                </div>

                                {/* Website Input */}
                                <div className="space-y-2">
                                    <FloatingLabelInput
                                        id="website"
                                        label="Website"
                                        type="text"
                                        value={formData.website}
                                        autoComplete="off"
                                        error={errors.website}
                                        onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                                        onBlur={handleBlur}
                                        maxLength={100}
                                    />
                                </div>

                                {/* Bio Input */}
                                <div className="space-y-2">
                                    <FloatingLabelTextarea
                                        id="bio"
                                        label="Bio"
                                        rows={4}
                                        value={formData.bio}
                                        onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                                        onBlur={handleBlur}
                                        maxLength={200}
                                    />
                                </div>

                                {/* Username Input */}
                                <div className="space-y-2">
                                    <FloatingLabelInput
                                        id="username"
                                        label="Username"
                                        type="text"
                                        value={formData.username}
                                        autoComplete="off"
                                        data-lpignore="true"
                                        error={errors.username}
                                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                        onBlur={handleBlur}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        URL: praxis.com/<b>{formData.username || 'username'}</b>
                                    </p>
                                </div>

                                {/* Email Input (Read Only) */}
                                <div className="space-y-2">
                                    <FloatingLabelInput
                                        id="email"
                                        label="Email"
                                        type="text"
                                        disabled
                                        className="cursor-not-allowed bg-secondary/50 text-muted-foreground"
                                        value={user?.email || 'No email visible'}
                                    />
                                    <p className="text-xs text-muted-foreground">To change your email, please contact support.</p>
                                </div>



                            </form>
                        </div>
                    </main>
                </div>
            </div>
            {imageSrc && (
                <ImageCropper
                    image={imageSrc}
                    aspect={cropAspect}
                    onCropComplete={handleCropSave}
                    onCancel={handleCropCancel}
                />
            )}
        </div>
    );
}
