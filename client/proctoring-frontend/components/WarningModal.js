/**
 * Warning Modal Component
 * 
 * Reusable modal for proctoring warnings (Face Missing, Tab Switch, etc.)
 * Uses glassmorphism and modern UI.
 */
import { useEffect, useState } from 'react';

export default function WarningModal({
    isOpen,
    type,
    title,
    message,
    onDismiss,
    autoDismissMs = 0,
    severity = 'high', // low, medium, high, critical
    actionText = 'I Understand'
}) {
    const [timeLeft, setTimeLeft] = useState(autoDismissMs > 0 ? autoDismissMs / 1000 : 0);

    useEffect(() => {
        if (!isOpen) return;

        if (autoDismissMs > 0) {
            setTimeLeft(autoDismissMs / 1000);
            const timer = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) {
                        clearInterval(timer);
                        if (onDismiss) onDismiss();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [isOpen, autoDismissMs, onDismiss]);

    if (!isOpen) return null;

    const getColors = () => {
        switch (severity) {
            case 'critical': return { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-500', icon: 'text-red-500' };
            case 'high': return { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-500', icon: 'text-orange-500' };
            case 'medium': return { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400', icon: 'text-yellow-400' };
            case 'low': return { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', icon: 'text-blue-400' };
            default: return { bg: 'bg-gray-800', border: 'border-gray-700', text: 'text-white', icon: 'text-white' };
        }
    };

    const colors = getColors();

    const icons = {
        FACE_MISSING: (
            <svg className="w-16 h-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
        ),
        MULTI_PERSON: (
            <svg className="w-16 h-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
        ),
        TAB_SWITCH: (
            <svg className="w-16 h-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
        ),
        CAMERA_BLOCKED: (
            <svg className="w-16 h-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
        ),
        LOW_LIGHT: (
            <svg className="w-16 h-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
        )
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Glassmorphism Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity" />

            {/* Modal Content */}
            <div className={`
                relative z-10 w-full max-w-md p-8 rounded-2xl shadow-2xl text-center
                transform transition-all duration-300 scale-100
                bg-gray-900/90 backdrop-blur-xl border border-white/10
                flex flex-col items-center
                ${colors.border}
            `}>
                <div className={`${colors.icon} animate-bounce-slow`}>
                    {icons[type] || icons.FACE_MISSING}
                </div>

                <h3 className={`text-2xl font-bold mb-2 ${colors.text}`}>
                    {title}
                </h3>

                <p className="text-gray-300 mb-8 leading-relaxed">
                    {message}
                </p>

                {onDismiss && (
                    <button
                        onClick={onDismiss}
                        className={`
                            px-8 py-3 rounded-xl font-semibold text-white
                            transition-all duration-200
                            hover:scale-105 active:scale-95
                            bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500
                            shadow-lg shadow-blue-500/20
                        `}
                    >
                        {actionText}
                    </button>
                )}

                {autoDismissMs > 0 && (
                    <div className="mt-4 text-xs text-gray-500">
                        Dismissing in {Math.ceil(timeLeft)}s...
                    </div>
                )}
            </div>
        </div>
    );
}
