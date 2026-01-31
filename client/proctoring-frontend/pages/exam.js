/**
 * Exam Page - Production-Ready Proctoring
 * 
 * Active proctoring environment with:
 * - Hysteresis-based detection (no single-frame triggers)
 * - Visibility-aware evidence capture
 * - Rate-limited event emission
 * - Clean UX (no dev controls)
 */

import { useCallback, useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useProctoring } from '../context/ProctoringProvider';
import { useFrameAnalyzer } from '../hooks/useFrameAnalyzer';
import { useFullscreen } from '../hooks/useFullscreen';
import { getEvidenceScheduler, destroyEvidenceScheduler } from '../lib/evidenceScheduler';
import QuestionCard from '../components/QuestionCard';
import ProctoringStatusIcons from '../components/ProctoringStatusIcons';

// Debug mode via environment variable
const DEBUG_MODE = process.env.NEXT_PUBLIC_PROCTOR_DEBUG === 'true';

export default function Exam() {
    const router = useRouter();
    const { webcam, screenShare, proctoring, windowFocus, eventBatcher, session } = useProctoring();
    const { isFullscreen, enterFullscreen } = useFullscreen();
    const {
        flags, messageLog, analysisEnabled, lastProcessingTime,
        updateFromAnalysis, getConsecutiveMissing, consumePendingEvents, addFlag, removeFlag
    } = proctoring;

    const videoRef = useRef(null);
    const screenVideoRef = useRef(null);
    const [modelLoading, setModelLoading] = useState(true);
    const [violations, setViolations] = useState([]);

    // Evidence scheduler ref
    const schedulerRef = useRef(null);

    // Initialize evidence scheduler
    useEffect(() => {
        schedulerRef.current = getEvidenceScheduler();
        return () => {
            destroyEvidenceScheduler();
        };
    }, []);

    // 1. Safety Check: If no camera, redirect to system check
    useEffect(() => {
        if (!webcam.isActive) {
            router.replace('/');
        }
    }, [webcam.isActive, router]);

    // 2. Attach Streams to Video Elements
    useEffect(() => {
        if (videoRef.current && webcam.stream) {
            videoRef.current.srcObject = webcam.stream;
        }
    }, [webcam.stream]);

    useEffect(() => {
        if (screenVideoRef.current && screenShare.stream) {
            screenVideoRef.current.srcObject = screenShare.stream;
        }
    }, [screenShare.stream]);

    // 3. Load stored violations on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem('proctoring_violations');
            if (stored) setViolations(JSON.parse(stored));
        } catch (e) {
            console.error("Failed to load violations", e);
        }
    }, []);

    // 4. Evidence capture using scheduler (visibility-aware, rate-limited)
    const captureEvidence = useCallback((type, videoElement = null) => {
        if (!schedulerRef.current) return;

        const targetVideo = videoElement || videoRef.current;
        if (!targetVideo) {
            // No video, still send event without thumbnail
            eventBatcher.addEvent(type, 0.8, {}, null);
            return;
        }

        // Confidence map
        const confidenceMap = {
            MULTI_PERSON: 0.95,
            FACE_MISSING: 0.90,
            TAB_SWITCH: 0.99,
            LOW_LIGHT: 0.70,
            LOOK_AWAY: 0.85,
            CAMERA_BLOCKED: 0.95,
        };

        schedulerRef.current.queue(
            type,
            targetVideo,
            (thumbnailBase64) => {
                // Send to backend
                const eventId = eventBatcher.addEvent(
                    type,
                    confidenceMap[type] || 0.8,
                    {},
                    thumbnailBase64
                );

                // Update local violations for UI
                if (thumbnailBase64) {
                    const newViolation = {
                        id: Date.now(),
                        timestamp: new Date().toLocaleTimeString(),
                        type,
                        eventId,
                        image: `data:image/jpeg;base64,${thumbnailBase64}`,
                    };

                    setViolations(prev => {
                        const updated = [newViolation, ...prev].slice(0, 5);
                        localStorage.setItem('proctoring_violations', JSON.stringify(updated));
                        return updated;
                    });
                }
            },
            { allowWithoutSnapshot: true }
        );
    }, [eventBatcher]);

    const clearViolations = useCallback(() => {
        setViolations([]);
        localStorage.removeItem('proctoring_violations');
    }, []);

    // 5. Tab Focus Monitoring - Capture when LEAVING to get screenshot of other tab
    const tabSwitchCooldownRef = useRef(0);
    const TAB_SWITCH_COOLDOWN_MS = 10000; // 10s cooldown

    // Direct capture function for TAB_SWITCH - Higher quality: 320x180 at 0.75
    const captureTabSwitch = useCallback((videoElement) => {
        if (!videoElement || videoElement.readyState < 2) {
            console.warn('[TabSwitch] Video not ready for capture');
            eventBatcher.addEvent('TAB_SWITCH', 0.99, {}, null);
            return;
        }

        try {
            const canvas = document.createElement('canvas');
            canvas.width = 320;   // Higher resolution
            canvas.height = 180;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(videoElement, 0, 0, 320, 180);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.75);  // Better quality
            const thumbnailBase64 = dataUrl.split(',')[1];

            const eventId = eventBatcher.addEvent('TAB_SWITCH', 0.99, {}, thumbnailBase64);

            const newViolation = {
                id: Date.now(),
                timestamp: new Date().toLocaleTimeString(),
                type: 'TAB_SWITCH',
                eventId,
                image: dataUrl,
            };

            setViolations(prev => {
                const updated = [newViolation, ...prev].slice(0, 5);
                localStorage.setItem('proctoring_violations', JSON.stringify(updated));
                return updated;
            });

            console.log('[TabSwitch] Screenshot captured successfully');
        } catch (err) {
            console.error('[TabSwitch] Capture failed:', err);
            eventBatcher.addEvent('TAB_SWITCH', 0.99, {}, null);
        }
    }, [eventBatcher]);

    useEffect(() => {
        const now = Date.now();

        if (!windowFocus.isFocused) {
            // Tab switched AWAY - capture the OTHER tab via screen share
            addFlag('TAB_SWITCH');
            setFocusModal(true);

            // Check cooldown before capturing
            if (now - tabSwitchCooldownRef.current >= TAB_SWITCH_COOLDOWN_MS) {
                tabSwitchCooldownRef.current = now;

                // Capture with 500ms delay (screen share needs time to show other tab)
                setTimeout(() => {
                    const targetVideo = screenShare.isSharing && screenVideoRef.current
                        ? screenVideoRef.current
                        : videoRef.current;
                    captureTabSwitch(targetVideo);
                }, 500);
            }
        } else {
            removeFlag('TAB_SWITCH');
        }
    }, [windowFocus.isFocused, addFlag, removeFlag, captureTabSwitch, screenShare.isSharing]);

    // 6. Screen Share Monitoring
    useEffect(() => {
        if (screenShare.isSharing) {
            addFlag('SCREEN_SHARE_ACTIVE');
        } else {
            removeFlag('SCREEN_SHARE_ACTIVE');
        }
    }, [screenShare.isSharing, addFlag, removeFlag]);

    // 7. Modal States
    const [faceModal, setFaceModal] = useState(false);
    const [multipleModal, setMultipleModal] = useState(false);
    const [focusModal, setFocusModal] = useState(false);
    const [lightingModal, setLightingModal] = useState(false);
    const [blockedModal, setBlockedModal] = useState(false);

    // 8. Process pending anomaly events from detection state
    useEffect(() => {
        const events = consumePendingEvents();

        for (const event of events) {
            if (event.shouldEmit) {
                captureEvidence(event.type);

                // Show appropriate modal
                switch (event.type) {
                    case 'MULTI_PERSON':
                        if (!multipleModal) setMultipleModal(true);
                        break;
                    case 'FACE_MISSING':
                        if (!faceModal && event.reason !== 'CAMERA_BLOCKED') setFaceModal(true);
                        if (event.reason === 'CAMERA_BLOCKED' && !blockedModal) setBlockedModal(true);
                        break;
                    case 'LOW_LIGHT':
                        if (!lightingModal) setLightingModal(true);
                        break;
                }
            }
        }
    }, [consumePendingEvents, captureEvidence, faceModal, multipleModal, lightingModal, blockedModal]);

    // 9. Frame Analysis
    const handleAnalysisResult = useCallback((results) => {
        setModelLoading(false);
        updateFromAnalysis(results);
    }, [updateFromAnalysis]);

    useFrameAnalyzer({
        videoRef,
        isActive: webcam.isActive,
        analysisEnabled,
        onAnalysisResult: handleAnalysisResult,
        getConsecutiveMissing
    });

    if (!webcam.isActive) return null;

    return (
        <>
            <Head>
                <title>Exam In Progress</title>
                <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet" />
            </Head>

            {/* Hidden Video Elements for Detection */}
            <div className="fixed top-0 left-0 w-1 h-1 opacity-0 pointer-events-none overflow-hidden">
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    width="320"
                    height="240"
                />
                <video
                    ref={screenVideoRef}
                    autoPlay
                    playsInline
                    muted
                />
            </div>

            <main className="min-h-screen bg-gray-50 flex flex-col font-sans">

                {/* Top Bar */}
                <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
                    <button className="bg-blue-400 text-white px-6 py-2 rounded-lg font-bold shadow-md hover:bg-blue-500 transition-colors">
                        Subject 1
                    </button>

                    {/* Proctoring Status (compact) */}
                    <div className="flex items-center gap-4">
                        {modelLoading && (
                            <span className="text-xs text-gray-400 animate-pulse">Loading AI...</span>
                        )}
                        {!modelLoading && (
                            <span className="text-xs text-green-600 font-medium">✓ Proctoring Active</span>
                        )}
                    </div>

                    {/* End Test Button */}
                    <button
                        onClick={async () => {
                            if (session.sessionId) {
                                await session.end();
                                router.push(`/exam/${session.sessionId}/dashboard`);
                            }
                        }}
                        className="bg-red-500 text-white px-6 py-2 rounded-lg font-bold shadow-md hover:bg-red-600 transition-colors"
                    >
                        End Test
                    </button>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex p-6 gap-6 max-w-7xl mx-auto w-full">

                    {/* Left: Question Area */}
                    <div className="flex-1">
                        <QuestionCard />
                    </div>

                    {/* Right: Sidebar */}
                    <div className="w-80 flex flex-col gap-6">

                        {/* Status Icons */}
                        <div className="flex justify-end">
                            <ProctoringStatusIcons
                                flags={flags}
                                screenShareActive={screenShare.isSharing}
                            />
                        </div>

                        {/* Controls */}
                        <div className="flex gap-2">
                            <button className="flex-1 bg-white border border-gray-200 py-2 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50">
                                Instructions
                            </button>
                            <div className="relative">
                                <button className="bg-white border border-gray-200 py-2 px-4 rounded-lg text-sm font-semibold text-gray-700 flex items-center gap-2 hover:bg-gray-50">
                                    English <span>⌄</span>
                                </button>
                            </div>
                        </div>

                        {/* Question Palette */}
                        <div className="bg-blue-50/50 rounded-xl p-4">
                            <h3 className="text-blue-400 font-bold mb-4 text-sm">Subject 1</h3>
                            <div className="grid grid-cols-6 gap-2">
                                {Array.from({ length: 30 }, (_, i) => i + 1).map(num => (
                                    <button
                                        key={num}
                                        className={`
                                            w-8 h-8 rounded-lg text-xs font-bold flex items-center justify-center transition-colors
                                            ${num === 1 ? 'bg-blue-500 text-white shadow-lg' : 'bg-white text-gray-600 border border-transparent hover:border-gray-300'}
                                        `}
                                    >
                                        {num}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Incident Gallery */}
                        <div className="flex-1 overflow-y-auto bg-gray-50/50 rounded-xl p-4 border border-gray-100">
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="font-semibold text-gray-700 text-xs flex items-center gap-2">
                                    <span>Incidents</span>
                                    {violations.length > 0 && (
                                        <span className="bg-red-100 text-red-600 text-[10px] px-1.5 py-0.5 rounded-full font-bold">{violations.length}</span>
                                    )}
                                </h3>
                                {violations.length > 0 && (
                                    <button onClick={clearViolations} className="text-[10px] text-gray-400 hover:text-red-500 uppercase tracking-wider font-medium">
                                        Clear
                                    </button>
                                )}
                            </div>

                            {violations.length === 0 ? (
                                <div className="h-20 flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
                                    <span className="text-xl mb-1">🛡️</span>
                                    <span className="text-[10px]">Clean Record</span>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {violations.map(v => (
                                        <div key={v.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                                            <div className="bg-red-50 px-2 py-1 border-b border-red-100 flex justify-between items-center">
                                                <span className="text-[9px] font-bold text-red-700 uppercase">
                                                    {v.type.replace(/_/g, ' ')}
                                                </span>
                                                <span className="text-[9px] text-red-400 font-mono">{v.timestamp}</span>
                                            </div>
                                            {v.image && (
                                                <div className="p-1.5">
                                                    <img src={v.image} alt="Evidence" className="w-full rounded bg-black aspect-video object-cover" />
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Debug Overlay (only in debug mode) */}
                        {DEBUG_MODE && (
                            <div className="bg-gray-900 text-green-400 p-3 rounded-lg text-xs font-mono">
                                <div>Processing: {lastProcessingTime?.toFixed(0)}ms</div>
                                <div>Flags: {Object.keys(flags).join(', ') || 'none'}</div>
                            </div>
                        )}
                    </div>

                </div>

            </main>

            {/* BLOCKING MODALS */}

            {/* Fullscreen Required */}
            {!isFullscreen && (
                <div className="fixed inset-0 z-50 bg-white/50 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md text-center border border-red-100">
                        <div className="text-6xl mb-4">⚠️</div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">Fullscreen Required</h2>
                        <p className="text-gray-600 mb-6">Please return to full screen mode to continue the exam.</p>
                        <button
                            onClick={enterFullscreen}
                            className="w-full py-3 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors shadow-lg"
                        >
                            Return to Full Screen
                        </button>
                    </div>
                </div>
            )}

            {/* Screen Share Required */}
            {isFullscreen && !screenShare.isSharing && (
                <div className="fixed inset-0 z-50 bg-white/50 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md text-center border border-orange-100">
                        <div className="text-6xl mb-4">🖥️</div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">Screen Share Required</h2>
                        <p className="text-gray-600 mb-6">You must share your entire screen to continue.</p>
                        <button
                            onClick={screenShare.startScreenShare}
                            className="w-full py-3 bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-700 transition-colors shadow-lg"
                        >
                            Share Entire Screen
                        </button>
                    </div>
                </div>
            )}

            {/* Face Not Visible */}
            {faceModal && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md text-center border-4 border-red-500">
                        <div className="text-6xl mb-4">🚫</div>
                        <h2 className="text-2xl font-bold text-red-600 mb-2">Face Not Visible</h2>
                        <p className="text-gray-700 mb-6">
                            Your face has been out of frame. This incident has been recorded.
                        </p>
                        <button
                            onClick={() => setFaceModal(false)}
                            className="bg-red-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-red-700 shadow-lg"
                        >
                            Continue Exam
                        </button>
                    </div>
                </div>
            )}

            {/* Multiple Faces */}
            {multipleModal && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md text-center border-4 border-orange-500">
                        <div className="text-6xl mb-4">👥</div>
                        <h2 className="text-2xl font-bold text-orange-600 mb-2">Multiple People Detected</h2>
                        <p className="text-gray-700 mb-6">
                            We detected multiple people in your camera. Ensure you are alone.
                        </p>
                        <button
                            onClick={() => setMultipleModal(false)}
                            className="bg-orange-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-orange-700 shadow-lg"
                        >
                            I Understand
                        </button>
                    </div>
                </div>
            )}

            {/* Tab Switch */}
            {focusModal && (
                <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md text-center border-4 border-indigo-500">
                        <div className="text-6xl mb-4">⚠️</div>
                        <h2 className="text-2xl font-bold text-indigo-600 mb-2">Focus Lost</h2>
                        <p className="text-gray-700 mb-6">
                            You switched tabs or windows. This has been recorded.
                        </p>
                        <button
                            onClick={() => setFocusModal(false)}
                            className="bg-indigo-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-indigo-700 shadow-lg"
                        >
                            Continue Exam
                        </button>
                    </div>
                </div>
            )}

            {/* Low Light */}
            {lightingModal && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md text-center border-4 border-yellow-500">
                        <div className="text-6xl mb-4">💡</div>
                        <h2 className="text-2xl font-bold text-yellow-600 mb-2">Poor Lighting</h2>
                        <p className="text-gray-700 mb-6">
                            The lighting is too low. Please improve your lighting conditions.
                        </p>
                        <button
                            onClick={() => setLightingModal(false)}
                            className="bg-yellow-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-yellow-700 shadow-lg"
                        >
                            I've Fixed It
                        </button>
                    </div>
                </div>
            )}

            {/* Camera Blocked */}
            {blockedModal && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md text-center border-4 border-red-600">
                        <div className="text-6xl mb-4">📷</div>
                        <h2 className="text-2xl font-bold text-red-600 mb-2">Camera Blocked</h2>
                        <p className="text-gray-700 mb-6">
                            Your camera appears to be blocked or covered. Please uncover it.
                        </p>
                        <button
                            onClick={() => setBlockedModal(false)}
                            className="bg-red-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-red-700 shadow-lg"
                        >
                            Camera is Clear
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
