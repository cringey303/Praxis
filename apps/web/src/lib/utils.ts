import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function getProfileImageUrl(url: string | undefined | null): string | undefined {
    if (!url) return undefined;

    // If it's a blob URL (local preview), keep it
    if (url.startsWith('blob:')) return url;

    // If it's an external URL (e.g. Google), keep it.
    // We assume our uploads are always in /uploads/
    // But wait, the current issue is that we saved "http://localhost:8080/uploads/..." in the DB.
    // So we need to detect that specific pattern or the API_URL pattern.

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

        // If it is already relative (starts with /uploads), precise check?
        if (url.startsWith('/uploads')) {
            return url;
        }

        // If it's some other full URL, return as is (e.g. Google Auth picture)
        return url;

    } catch (e) {
        console.error('Error parsing profile image URL:', e);
        return url;
    }
}
