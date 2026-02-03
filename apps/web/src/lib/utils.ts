import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function getProfileImageUrl(url: string | undefined | null): string | undefined {
    if (!url) return undefined;

    // If it's a blob URL (local preview), keep it
    if (url.startsWith('blob:')) return url;

    // If it's a full HTTPS URL (R2 or external like Google), return as-is
    if (url.startsWith('https://')) return url;

    // Legacy support: Handle old /uploads/... paths
    // These are served via Next.js rewrite to the API
    if (url.startsWith('/uploads')) {
        return url;
    }

    // Handle legacy localhost URLs (from old database entries)
    try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

        // Check if the URL starts with our API URL
        if (url.startsWith(apiUrl)) {
            return url.replace(apiUrl, '');
        }

        // Fallback for hardcoded localhost:8080 if env var differs but data is old
        if (url.startsWith('http://localhost:8080')) {
            return url.replace('http://localhost:8080', '');
        }

        // If it's some other full URL, return as is
        return url;

    } catch (e) {
        console.error('Error parsing profile image URL:', e);
        return url;
    }
}
