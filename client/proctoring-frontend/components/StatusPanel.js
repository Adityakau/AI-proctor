/**
 * StatusPanel - Displays proctoring flags and message history
 * 
 * Simple, functional UI with:
 * - Current flag status with color coding
 * - Processing time display
 * - Timestamped message log
 * - Analysis disabled warning
 */

import React from 'react';

/**
 * Color classes for each flag type
 */
const FLAG_STYLES = {
    FACE_OK: 'bg-green-100 text-green-800 border-green-300',
    FACE_MISSING: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    MULTIPLE_FACES: 'bg-red-100 text-red-800 border-red-300',
    LOW_LIGHT: 'bg-orange-100 text-orange-800 border-orange-300',
    LOW_LIGHT: 'bg-orange-100 text-orange-800 border-orange-300',
    HEAD_ROTATED: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    TAB_FOCUS_LOST: 'bg-red-100 text-red-800 border-red-300',
    SCREEN_SHARE_ACTIVE: 'bg-blue-100 text-blue-800 border-blue-300'
};

/**
 * Human-readable labels
 */
const FLAG_LABELS = {
    FACE_OK: '✓ Face OK',
    FACE_MISSING: '⚠ Face Missing',
    MULTIPLE_FACES: '✕ Multiple Faces',
    LOW_LIGHT: '◐ Low Light',
    TAB_FOCUS_LOST: '⚠ Tab Focus Lost',
    SCREEN_SHARE_ACTIVE: '⎘ Screen Shared'
};

/**
 * Format timestamp for display (HH:MM:SS)
 */
function formatTime(isoString) {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

/**
 * StatusPanel Component
 * 
 * @param {Object} props
 * @param {Object} props.flags - Current active flags (object keys)
 * @param {Array} props.messageLog - Timestamped message history
 * @param {boolean} props.analysisEnabled - Whether analysis is running
 * @param {string|null} props.disableReason - Reason if analysis disabled
 * @param {number} props.processingTime - Last processing time in ms
 * @param {boolean} props.isModelLoading - Whether model is loading
 */
export default function StatusPanel({
    flags = {},
    messageLog = [],
    analysisEnabled = true,
    disableReason = null,
    processingTime = 0,
    isModelLoading = false
}) {
    const activeFlags = Object.keys(flags);

    return (
        <div className="w-full border-2 border-gray-300 rounded-lg bg-white shadow-sm">
            {/* Header */}
            <div className="px-4 py-2 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                <h2 className="text-sm font-semibold text-gray-700">Proctoring Status</h2>
                <div className="text-xs text-gray-500">
                    {isModelLoading ? (
                        <span className="text-blue-600">Loading model...</span>
                    ) : (
                        <span>Processing: {processingTime.toFixed(0)}ms</span>
                    )}
                </div>
            </div>

            {/* Analysis Disabled Warning */}
            {!analysisEnabled && (
                <div className="px-4 py-2 bg-red-50 border-b border-red-200">
                    <p className="text-sm text-red-700 font-medium">
                        ⚠ Analysis Disabled
                    </p>
                    <p className="text-xs text-red-600">
                        {disableReason || 'Safety mechanism triggered'}
                    </p>
                </div>
            )}

            {/* Current Flags */}
            <div className="px-4 py-3">
                <div className="flex flex-wrap gap-2">
                    {activeFlags.length === 0 ? (
                        <span className="text-sm text-green-600 font-medium">System Nominal</span>
                    ) : (
                        activeFlags.map(flag => (
                            <span
                                key={flag}
                                className={`px-2 py-1 text-xs font-medium rounded border ${FLAG_STYLES[flag] || 'bg-gray-100 text-gray-700'}`}
                            >
                                {FLAG_LABELS[flag] || flag}
                            </span>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
