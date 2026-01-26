import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function getApiUrl() {
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
}

export function getImageUrl(path: string | undefined | null) {
    if (!path) return undefined;
    if (path.startsWith('http') || path.startsWith('blob:')) return path;
    const apiUrl = getApiUrl();
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${apiUrl}${cleanPath}`;
}
