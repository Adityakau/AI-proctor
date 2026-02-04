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
import { getFrameBuffer, destroyFrameBuffer } from '../lib/frameBuffer';
import QuestionCard from '../components/QuestionCard';
import ProctoringStatusIcons from '../components/ProctoringStatusIcons';
import WarningModal from '../components/WarningModal';

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
    // Frame buffer ref
    const frameBufferRef = useRef(null);

    // Initialize evidence scheduler and frame buffer
    useEffect(() => {
        schedulerRef.current = getEvidenceScheduler();
        frameBufferRef.current = getFrameBuffer();

        // Start frame buffer when webcam is ready
        if (videoRef.current) {
            frameBufferRef.current.start(videoRef.current, screenVideoRef.current);
        }

        return () => {
            destroyEvidenceScheduler();
            destroyFrameBuffer();
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
            // Update frame buffer with screen video ref
            if (frameBufferRef.current) {
                frameBufferRef.current.setScreenVideo(screenVideoRef.current);
            }
        }
    }, [screenShare.stream]);

    // Start frame buffer when webcam becomes ready
    useEffect(() => {
        if (videoRef.current && webcam.stream && frameBufferRef.current) {
            frameBufferRef.current.start(videoRef.current, screenVideoRef.current);
        }
    }, [webcam.stream]);

    // 3. Load stored violations on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem('proctoring_violations');
            if (stored) setViolations(JSON.parse(stored));
        } catch (e) {
            console.error("Failed to load violations", e);
        }
    }, []);

    // 4. Evidence capture using FRAME BUFFER (instant, reliable)
    const captureEvidence = useCallback((type, preference = 'webcam') => {
        // Confidence map
        const confidenceMap = {
            MULTI_PERSON: 0.95,
            FACE_MISSING: 0.90,
            TAB_SWITCH: 0.99,
            LOW_LIGHT: 0.70,
            LOOK_AWAY: 0.85,
            CAMERA_BLOCKED: 0.95,
        };

        // Get frame from buffer (instant - already captured)
        const frame = frameBufferRef.current?.getFrame(preference);
        const thumbnailBase64 = frame?.base64 || null;

        // Send to backend
        const eventId = eventBatcher.addEvent(
            type,
            confidenceMap[type] || 0.8,
            {},
            thumbnailBase64
        );

        // Update local violations for UI display
        if (frame) {
            const newViolation = {
                id: Date.now(),
                timestamp: new Date().toLocaleTimeString(),
                type,
                eventId,
                image: frame.dataUrl,
            };

            setViolations(prev => {
                const updated = [newViolation, ...prev].slice(0, 5);
                localStorage.setItem('proctoring_violations', JSON.stringify(updated));
                return updated;
            });
            console.log(`[Evidence] Captured ${type} from buffer`);
        } else {
            console.warn(`[Evidence] No frame in buffer for ${type}`);
        }
    }, [eventBatcher]);

    const clearViolations = useCallback(() => {
        setViolations([]);
        localStorage.removeItem('proctoring_violations');
    }, []);

    // 5. Tab Focus Monitoring - Composite capture (webcam + screen merged)
    const tabSwitchCooldownRef = useRef(0);
    const TAB_SWITCH_COOLDOWN_MS = 10000; // 10s cooldown

    useEffect(() => {
        if (!windowFocus.isFocused) {
            // Tab switched away - show warning
            addFlag('TAB_SWITCH');
            setFocusModal(true);

            // Check cooldown and capture
            const now = Date.now();
            if (now - tabSwitchCooldownRef.current >= TAB_SWITCH_COOLDOWN_MS) {
                tabSwitchCooldownRef.current = now;

                try {
                    const webcamVideo = videoRef.current;
                    const screenVideo = screenVideoRef.current;
                    const hasWebcam = webcamVideo && webcamVideo.readyState >= 2;
                    const hasScreen = screenShare.isSharing && screenVideo && screenVideo.readyState >= 2;

                    if (hasWebcam || hasScreen) {
                        // Create composite canvas: webcam on left (small), screen on right (larger)
                        const webcamWidth = 160;
                        const webcamHeight = 90;
                        const screenWidth = hasScreen ? 320 : 0;
                        const screenHeight = 180;
                        const totalWidth = webcamWidth + screenWidth;
                        const totalHeight = screenHeight;

                        const canvas = document.createElement('canvas');
                        canvas.width = totalWidth;
                        canvas.height = totalHeight;
                        const ctx = canvas.getContext('2d');

                        // Fill background
                        ctx.fillStyle = '#1a1a1a';
                        ctx.fillRect(0, 0, totalWidth, totalHeight);

                        // Draw webcam on left (centered vertically)
                        if (hasWebcam) {
                            const webcamY = (totalHeight - webcamHeight) / 2;
                            ctx.drawImage(webcamVideo, 0, webcamY, webcamWidth, webcamHeight);

                            // Add label
                            ctx.fillStyle = 'rgba(0,0,0,0.6)';
                            ctx.fillRect(0, webcamY, webcamWidth, 16);
                            ctx.fillStyle = '#fff';
                            ctx.font = '10px Arial';
                            ctx.fillText('Webcam', 4, webcamY + 12);
                        }

                        // Draw screen on right
                        if (hasScreen) {
                            ctx.drawImage(screenVideo, webcamWidth, 0, screenWidth, screenHeight);

                            // Add label
                            ctx.fillStyle = 'rgba(0,0,0,0.6)';
                            ctx.fillRect(webcamWidth, 0, screenWidth, 16);
                            ctx.fillStyle = '#fff';
                            ctx.font = '10px Arial';
                            ctx.fillText('Screen', webcamWidth + 4, 12);
                        }

                        const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
                        const base64 = dataUrl.split(',')[1];

                        // Send to backend
                        const eventId = eventBatcher.addEvent('TAB_SWITCH', 0.99, {}, base64);

                        // Add to violations UI
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
                        console.log('[TabSwitch] Composite screenshot captured');
                    } else {
                        eventBatcher.addEvent('TAB_SWITCH', 0.99, {}, null);
                        console.warn('[TabSwitch] No video sources ready');
                    }
                } catch (err) {
                    console.error('[TabSwitch] Capture failed:', err);
                    eventBatcher.addEvent('TAB_SWITCH', 0.99, {}, null);
                }
            }
        } else {
            removeFlag('TAB_SWITCH');
        }
    }, [windowFocus.isFocused, addFlag, removeFlag, eventBatcher, screenShare.isSharing]);

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
                // Skip screenshot for LOOK_AWAY (just send event)
                if (event.type === 'LOOK_AWAY') {
                    eventBatcher.addEvent('LOOK_AWAY', 0.85, {}, null);
                } else {
                    captureEvidence(event.type);
                }

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
    }, [consumePendingEvents, captureEvidence, eventBatcher, faceModal, multipleModal, lightingModal, blockedModal]);

    const [instantFaceMissing, setInstantFaceMissing] = useState(false);

    // 9. Frame Analysis
    const handleAnalysisResult = useCallback((results) => {
        setModelLoading(false);
        setInstantFaceMissing(results.faceCount === 0);
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
                                instantFaceMissing={instantFaceMissing}
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
                        {
                            DEBUG_MODE && (
                                <div className="bg-gray-900 text-green-400 p-3 rounded-lg text-xs font-mono">
                                    <div>Processing: {lastProcessingTime?.toFixed(0)}ms</div>
                                    <div>Flags: {Object.keys(flags).join(', ') || 'none'}</div>
                                </div>
                            )
                        }
                    </div >

                </div >

            </main >

            {/* BLOCKING MODALS */}

            {/* BLOCKING MODALS */}

            {/* Fullscreen Required */}
            <WarningModal
                isOpen={!isFullscreen}
                type="fullscreen"
                title="Fullscreen Required"
                message="Please return to full screen mode to continue the exam."
                onDismiss={enterFullscreen}
                actionText="Return to Full Screen"
                severity="critical"
            />

            {/* Screen Share Required */}
            <WarningModal
                isOpen={isFullscreen && !screenShare.isSharing}
                type="screenshare"
                title="Screen Share Required"
                message="You must share your entire screen to continue."
                onDismiss={screenShare.startScreenShare}
                actionText="Share Entire Screen"
                severity="critical"
            />

            {/* Face Not Visible */}
            <WarningModal
                isOpen={faceModal}
                type="FACE_MISSING"
                title="Face Not Visible"
                message="Your face has been out of frame. This incident has been recorded."
                onDismiss={() => setFaceModal(false)}
                actionText="Continue Exam"
                severity="high"
            />

            {/* Multiple Faces */}
            <WarningModal
                isOpen={multipleModal}
                type="MULTI_PERSON"
                title="Multiple People Detected"
                message="We detected multiple people in your camera. Ensure you are alone."
                onDismiss={() => setMultipleModal(false)}
                actionText="I Understand"
                severity="high"
            />

            {/* Tab Switch */}
            <WarningModal
                isOpen={focusModal}
                type="TAB_SWITCH"
                title="Focus Lost"
                message="You switched tabs or windows. This has been recorded."
                onDismiss={() => setFocusModal(false)}
                actionText="Continue Exam"
                severity="medium"
            />

            {/* Low Light */}
            <WarningModal
                isOpen={lightingModal}
                type="LOW_LIGHT"
                title="Poor Lighting"
                message="The lighting is too low. Please improve your lighting conditions."
                onDismiss={() => setLightingModal(false)}
                actionText="I've Fixed It"
                severity="low"
            />

            {/* Camera Blocked */}
            <WarningModal
                isOpen={blockedModal}
                type="CAMERA_BLOCKED"
                title="Camera Blocked"
                message="Your camera appears to be blocked or covered. Please uncover it."
                onDismiss={() => setBlockedModal(false)}
                actionText="Camera is Clear"
                severity="critical"
            />
        </>
    );
}
