'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
    id: number;
    message: string;
    type: ToastType;
    isExiting: boolean;
}

interface ToastContextType {
    showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const removeToast = useCallback((id: number) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const startExit = useCallback((id: number) => {
        setToasts((prev) =>
            prev.map((t) => (t.id === id ? { ...t, isExiting: true } : t))
        );
        // Wait for animation to finish before actual removal
        setTimeout(() => removeToast(id), 300);
    }, [removeToast]);

    const showToast = useCallback((message: string, type: ToastType = 'success') => {
        setToasts((prev) => {
            // Prevent duplicates: Check if same message exists and isn't already exiting
            const isDuplicate = prev.some(
                (t) => t.message === message && t.type === type && !t.isExiting
            );

            if (isDuplicate) return prev;

            const id = Date.now();

            // Auto-dismiss after 2 seconds
            setTimeout(() => {
                startExit(id);
            }, 2000);

            return [...prev, { id, message, type, isExiting: false }];
        });
    }, [startExit]);

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <div className="fixed top-6 left-1/2 z-50 flex flex-col gap-2 pointer-events-none">
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        onClick={() => startExit(toast.id)}
                        className={`
                            pointer-events-auto
                            flex items-center gap-2 px-3 py-3 rounded-md shadow-2xl backdrop-blur-md border
                            transition-all duration-300 transform
                            ${toast.isExiting ? 'animate-toast-out' : 'animate-toast-in'}
                            ${toast.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-500' : ''}
                            ${toast.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-500' : ''}
                            ${toast.type === 'info' ? 'bg-blue-500/10 border-blue-500/20 text-blue-500' : ''}
                            cursor-pointer hover:bg-opacity-20
                        `}
                        style={{ transform: 'translateX(-50%)' }}
                    >
                        {toast.type === 'success' && (
                            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                        )}
                        {toast.type === 'error' && (
                            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                        )}
                        {toast.type === 'info' && (
                            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        )}
                        <span className="text-sm font-medium whitespace-nowrap">{toast.message}</span>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}
