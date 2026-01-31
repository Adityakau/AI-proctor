/**
 * Exam Dashboard Page
 * 
 * Active proctoring environment.
 * Consumes global media streams from ProctoringContext.
 */

import { useCallback, useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useProctoring } from '../context/ProctoringProvider';
import { useFrameAnalyzer } from '../hooks/useFrameAnalyzer';
import StatusPanel from '../components/StatusPanel';
import { useFullscreen } from '../hooks/useFullscreen';

export default function Exam() {
    const router = useRouter();
    const { webcam, screenShare, proctoring, windowFocus, eventBatcher } = useProctoring();
    const { isFullscreen, enterFullscreen } = useFullscreen();
    const {
        flags, messageLog, analysisEnabled, disableReason, lastProcessingTime,
        updateFromAnalysis, getConsecutiveMissing, addFlag, removeFlag
    } = proctoring;

    const videoRef = useRef(null);
    const screenVideoRef = useRef(null);
    const [modelLoading, setModelLoading] = useState(true);
    const [violations, setViolations] = useState([]);

    // Track previous flags to trigger new violation captures
    const prevFlagsRef = useRef({});

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

    // 3. Load Violations
    useEffect(() => {
        try {
            const stored = localStorage.getItem('proctoring_violations');
            if (stored) setViolations(JSON.parse(stored));
        } catch (e) {
            console.error("Failed to load violations", e);
        }
    }, []);

    // 4. Capture Violation Helper - Now sends to backend via eventBatcher
    const captureViolation = useCallback((type) => {
        if (!videoRef.current) return;

        try {
            // Capture webcam image (for UI display)
            let webcamImage = null;
            let thumbnailBase64 = null;

            if (webcam.isActive && videoRef.current) {
                const canvas = document.createElement('canvas');
                canvas.width = 320;
                canvas.height = 240;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
                webcamImage = canvas.toDataURL('image/jpeg', 0.6);
                thumbnailBase64 = webcamImage.split(',')[1]; // Raw base64 for backend
            }

            // Capture screen image for TAB_SWITCH
            let screenImage = null;
            if (type === 'TAB_SWITCH' && screenShare.isSharing && screenVideoRef.current) {
                const canvas = document.createElement('canvas');
                const w = Math.min(screenVideoRef.current.videoWidth || 640, 640);
                const h = Math.min(screenVideoRef.current.videoHeight || 360, 360);
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(screenVideoRef.current, 0, 0, w, h);
                screenImage = canvas.toDataURL('image/jpeg', 0.6);
                // For TAB_SWITCH, send screen image to backend instead of webcam
                thumbnailBase64 = screenImage.split(',')[1];
            }

            // Determine confidence based on type
            const confidenceMap = {
                MULTI_PERSON: 0.95,
                FACE_MISSING: 0.90,
                TAB_SWITCH: 0.99,
                LOW_LIGHT: 0.70,
                LOOK_AWAY: 0.85,
            };

            // Send to backend via eventBatcher
            const eventId = eventBatcher.addEvent(
                type,
                confidenceMap[type] || 0.8,
                {},
                thumbnailBase64
            );

            // Store for local UI display (with full dataURL images)
            const newViolation = {
                id: Date.now(),
                timestamp: new Date().toLocaleTimeString(),
                type,
                eventId,
                image: webcamImage,       // Full dataURL for UI
                screenImage: screenImage, // Full dataURL for UI
            };

            setViolations(prev => {
                const updated = [newViolation, ...prev].slice(0, 5);
                localStorage.setItem('proctoring_violations', JSON.stringify(updated));
                return updated;
            });
        } catch (err) {
            console.error("Violation capture failed", err);
        }
    }, [webcam.isActive, screenShare.isSharing, eventBatcher]);

    const clearViolations = useCallback(() => {
        setViolations([]);
        localStorage.removeItem('proctoring_violations');
    }, []);

    // 5. Monitoring Logic (Tab Focus) - Uses TAB_SWITCH
    useEffect(() => {
        if (!windowFocus.isFocused) {
            addFlag('TAB_SWITCH');
            setFocusModal(true);
            // Wait 500ms for screen share stream to update
            const timer = setTimeout(() => {
                captureViolation('TAB_SWITCH');
            }, 500);
            return () => clearTimeout(timer);
        } else {
            removeFlag('TAB_SWITCH');
        }
    }, [windowFocus.isFocused, addFlag, removeFlag, captureViolation]);

    // 6. Monitoring Logic (Screen Share)
    useEffect(() => {
        if (screenShare.isSharing) {
            addFlag('SCREEN_SHARE_ACTIVE');
        } else {
            removeFlag('SCREEN_SHARE_ACTIVE');
        }
    }, [screenShare.isSharing, addFlag, removeFlag]);

    // 7. Logic: Face Flags Capture
    // 7. Logic: Face Flags Capture (10s Persistence)
    // 7. Logic: Face Flags Capture & Warnings

    // Explicit Modals requiring interaction
    const [faceModal, setFaceModal] = useState(false);
    const [multipleModal, setMultipleModal] = useState(false);
    const [focusModal, setFocusModal] = useState(false);

    // Face Missing (5s timer)
    useEffect(() => {
        let timer;
        // Only run timer if flag is active AND modal is NOT ALREADY showing
        if (flags.FACE_MISSING && !faceModal) {
            timer = setTimeout(() => {
                captureViolation('FACE_MISSING');
                setFaceModal(true);
            }, 5000);
        }
        return () => clearTimeout(timer);
    }, [flags.FACE_MISSING, faceModal, captureViolation]);

    // Multiple Faces (10s timer) - Uses MULTI_PERSON
    useEffect(() => {
        let timer;
        if (flags.MULTI_PERSON && !multipleModal) {
            timer = setTimeout(() => {
                captureViolation('MULTI_PERSON');
                setMultipleModal(true);
            }, 10000);
        }
        return () => clearTimeout(timer);
    }, [flags.MULTI_PERSON, multipleModal, captureViolation]);


    // 8. Frame Analysis
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
                <title>Exam In Progress - Proctoring</title>
            </Head>

            {/* Split Screen Layout */}
            <main className="flex h-screen bg-white overflow-hidden">

                {/* LEFT COLUMN: Camera Feed (Dominant) */}
                <div className="flex-1 flex flex-col items-center justify-center relative p-4 bg-white">
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="max-h-[80vh] max-w-4xl w-full rounded-lg shadow-2xl border border-gray-800"
                        style={{ boxShadow: '0 0 50px rgba(0,0,0,0.5)' }}
                    />
                    <div className="absolute top-6 left-6 text-white/50 text-sm font-light">
                        User Feed • Live
                    </div>

                    {/* Hidden Screen Video used for Capture (Must be in DOM/sized to play) */}
                    <video
                        ref={screenVideoRef}
                        className="absolute top-0 left-0 w-px h-px opacity-0 pointer-events-none"
                        autoPlay
                        playsInline
                        muted
                    />
                </div>

                {/* RIGHT COLUMN: Dashboard Tools */}
                <div className="w-96 bg-white border-l border-gray-200 flex flex-col shadow-xl z-10">
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                        <h1 className="text-lg font-bold text-gray-800">Exam Monitor</h1>
                        <span className="text-[10px] text-gray-400 font-mono">ID: 8X29-A1</span>
                    </div>

                    {/* Status Panel (Top) */}
                    <div className="p-4 border-b border-gray-100">
                        <StatusPanel
                            flags={flags}
                            messageLog={messageLog}
                            analysisEnabled={analysisEnabled}
                            disableReason={disableReason}
                            processingTime={lastProcessingTime}
                            isModelLoading={modelLoading}
                        />
                    </div>

                    {/* Violation Gallery (Remaining Height) */}
                    <div className="flex-1 overflow-y-auto p-4 bg-gray-50/30">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="font-semibold text-gray-700 text-sm flex items-center gap-2">
                                <span>Recorded Incidents</span>
                                {violations.length > 0 && (
                                    <span className="bg-red-100 text-red-600 text-[10px] px-1.5 py-0.5 rounded-full font-bold">{violations.length}</span>
                                )}
                            </h3>
                            {violations.length > 0 && (
                                <button onClick={clearViolations} className="text-[10px] text-gray-400 hover:text-red-500 uppercase tracking-wider font-medium">
                                    Clear All
                                </button>
                            )}
                        </div>

                        {violations.length === 0 ? (
                            <div className="h-32 flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
                                <span className="text-2xl mb-1">🛡️</span>
                                <span className="text-xs">No violations detected</span>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {violations.map(v => (
                                    <div key={v.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden group hover:border-red-300 transition-colors">
                                        <div className="bg-red-50 px-3 py-1.5 border-b border-red-100 flex justify-between items-center">
                                            <span className="text-[10px] font-bold text-red-700 uppercase tracking-wide">
                                                {v.type === 'TAB_SWITCH' ? 'Tab Switch' : v.type.replace('_', ' ')}
                                            </span>
                                            <span className="text-[10px] text-red-400 font-mono">{v.timestamp}</span>
                                        </div>
                                        <div className="p-2 grid grid-cols-2 gap-2">
                                            {/* Always show User Image */}
                                            <div className="relative">
                                                <img src={v.image} alt="User" className="w-full rounded bg-black aspect-video object-cover" />
                                                <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[9px] px-1 rounded">Webcam</div>
                                            </div>
                                            {/* Show Screen if available */}
                                            {v.screenImage ? (
                                                <div className="relative">
                                                    <img src={v.screenImage} alt="Screen" className="w-full rounded bg-gray-100 border border-gray-100 aspect-video object-cover" />
                                                    <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[9px] px-1 rounded">Screen</div>
                                                </div>
                                            ) : (
                                                <div className="bg-gray-100 rounded flex items-center justify-center text-[10px] text-gray-400">
                                                    No Screen
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Fullscreen Violation Modal */}
            {!isFullscreen && (
                <div className="fixed inset-0 z-50 bg-white/50 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md text-center border border-red-100">
                        <div className="text-6xl mb-4">⚠️</div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">Fullscreen Required</h2>
                        <p className="text-gray-600 mb-6">Permission to continue the exam is paused. Please return to full screen mode immediately.</p>
                        <button
                            onClick={enterFullscreen}
                            className="w-full py-3 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors shadow-lg"
                        >
                            Return to Full Screen
                        </button>
                    </div>
                </div>
            )}

            {/* Screen Share Violation Modal */}
            {isFullscreen && !screenShare.isSharing && (
                <div className="fixed inset-0 z-50 bg-white/50 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md text-center border border-orange-100">
                        <div className="text-6xl mb-4">🖥️</div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">Screen Share Stopped</h2>
                        <p className="text-gray-600 mb-6">You must share your entire screen to continue the exam.</p>
                        <button
                            onClick={screenShare.startScreenShare}
                            className="w-full py-3 bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-700 transition-colors shadow-lg"
                        >
                            Share Entire Screen
                        </button>
                    </div>
                </div>
            )}
            {/* Face Visibility Warning Modal (Blocking + Manual Dismiss) */}
            {faceModal && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md text-center border-4 border-red-500 animate-pulse-slow">
                        <div className="text-6xl mb-4">🚫</div>
                        <h2 className="text-2xl font-bold text-red-600 mb-2">Face Not Visible</h2>
                        <p className="text-gray-700 font-medium mb-6">
                            You have been away from the camera for more than 5 seconds.
                            <br /><br />
                            We have recorded this incident. Please stay in the frame.
                        </p>
                        <button
                            onClick={() => setFaceModal(false)}
                            className="bg-red-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-red-700 transition-transform transform active:scale-95 shadow-lg"
                        >
                            I'm Back, Continue Exam
                        </button>
                    </div>
                </div>
            )}

            {/* Multiple Faces Warning Modal (Blocking + Manual Dismiss) */}
            {multipleModal && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md text-center border-4 border-orange-500 animate-pulse-slow">
                        <div className="text-6xl mb-4">👥</div>
                        <h2 className="text-2xl font-bold text-orange-600 mb-2">Multiple Faces Detected</h2>
                        <p className="text-gray-700 font-medium mb-6">
                            We detected multiple people in your camera feed.
                            <br /><br />
                            This is a strict violation. Ensure you are alone.
                        </p>
                        <button
                            onClick={() => setMultipleModal(false)}
                            className="bg-orange-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-orange-700 transition-transform transform active:scale-95 shadow-lg"
                        >
                            I Understand, Continue
                        </button>
                    </div>
                </div>
            )}

            {/* Tab Focus Loss Warning Modal (Blocking + Manual Dismiss) */}
            {focusModal && (
                <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md text-center border-4 border-indigo-500 animate-pulse-slow">
                        <div className="text-6xl mb-4">⚠️</div>
                        <h2 className="text-2xl font-bold text-indigo-600 mb-2">Focus Lost!</h2>
                        <p className="text-gray-700 font-medium mb-6">
                            You switched tabs or minimized the browser window.
                            <br /><br />
                            This has been recorded as a violation. Please stay on this screen.
                        </p>
                        <button
                            onClick={() => setFocusModal(false)}
                            className="bg-indigo-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-indigo-700 transition-transform transform active:scale-95 shadow-lg"
                        >
                            I'm Back, Continue Exam
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
