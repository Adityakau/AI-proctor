/**
 * ProctoringStatusIcons
 * 
 * Displays compact status icons for proctoring checks.
 * - Face: Green (OK) / Red (Missing)
 * - People: Green (1) / Red (Multiple)
 * - Screen: Green (Sharing) / Red (Not sharing)
 * - Light: Green (OK) / Yellow (Low)
 */
import React from 'react';

export default function ProctoringStatusIcons({ flags, screenShareActive, instantFaceMissing }) {
    // Show RED if face is genuinely missing right now, OR if the flag is set
    const isFaceMissing = instantFaceMissing || flags.FACE_MISSING;
    const isMultipleFaces = flags.MULTI_PERSON;
    const isLowLight = flags.LOW_LIGHT;

    // Status helpers
    const getStatusColor = (isError, isWarning = false) => {
        if (isError) return 'text-red-500 bg-red-50 border-red-200';
        if (isWarning) return 'text-yellow-500 bg-yellow-50 border-yellow-200';
        return 'text-green-500 bg-green-50 border-green-200';
    };

    return (
        <div className="flex gap-2 bg-white p-2 rounded-lg border border-gray-200 shadow-sm relative z-20">
            {/* Face Presence */}
            <div className={`group relative flex items-center justify-center w-8 h-8 rounded border ${getStatusColor(isFaceMissing)} transition-colors duration-200`}>
                <span className="material-icons text-sm">face</span>
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-max px-2 py-1 bg-gray-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-30">
                    {isFaceMissing ? "Face Missing" : "Face Detected"}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
                </div>
            </div>

            {/* Multiple Faces */}
            <div className={`group relative flex items-center justify-center w-8 h-8 rounded border ${getStatusColor(isMultipleFaces)}`}>
                <span className="material-icons text-sm">groups</span>
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-max px-2 py-1 bg-gray-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-30">
                    {isMultipleFaces ? "Multiple Faces Detected" : "Single Face"}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
                </div>
            </div>

            {/* Screen Share */}
            <div className={`group relative flex items-center justify-center w-8 h-8 rounded border ${getStatusColor(!screenShareActive)}`}>
                <span className="material-icons text-sm">screen_share</span>
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-max px-2 py-1 bg-gray-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-30">
                    {screenShareActive ? "Screen Sharing Active" : "Screen Share Stopped"}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
                </div>
            </div>

            {/* Lighting */}
            <div className={`group relative flex items-center justify-center w-8 h-8 rounded border ${getStatusColor(false, isLowLight)}`}>
                <span className="material-icons text-sm">lightbulb</span>
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-max px-2 py-1 bg-gray-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-30">
                    {isLowLight ? "Low Light" : "Lighting OK"}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
                </div>
            </div>

            {/* Add Material Icons CDN if not present in project, or use emoji fallbacks if preferred */}
            <style jsx>{`
                /* Simple CSS fallback for icons if material icons not loaded */
                .material-icons {
                    font-family: 'Material Icons', sans-serif;
                    font-weight: normal;
                    font-style: normal;
                    font-size: 18px;
                    line-height: 1;
                    letter-spacing: normal;
                    text-transform: none;
                    display: inline-block;
                    white-space: nowrap;
                    word-wrap: normal;
                    direction: ltr;
                }
            `}</style>
        </div>
    );
}

// Icon SVG Fallbacks (in case Font is missing)
const FaceIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);
