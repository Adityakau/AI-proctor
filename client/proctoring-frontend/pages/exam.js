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
import { useFullscreen } from '../hooks/useFullscreen';
import QuestionCard from '../components/QuestionCard';
import ProctoringStatusIcons from '../components/ProctoringStatusIcons';

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

    // 3. Load Violations (Background Functionality only ?)
    // User requested to remove recorded incidents component, but we keep logic just in case
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
    // Track last focus loss time to prevent duplicate captures
    const lastFocusLossRef = useRef(null);

    useEffect(() => {
        if (!windowFocus.isFocused) {
            addFlag('TAB_SWITCH');
            setFocusModal(true);

            // Capture violation after 500ms delay (to let screen share show the other tab)
            // Use ref to track, so returning to tab doesn't cancel capture
            const captureTime = Date.now();
            lastFocusLossRef.current = captureTime;

            setTimeout(() => {
                // Only capture if this is still the most recent focus loss
                if (lastFocusLossRef.current === captureTime) {
                    captureViolation('TAB_SWITCH');
                }
            }, 500);
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
    // Explicit Modals requiring interaction
    const [faceModal, setFaceModal] = useState(false);
    const [multipleModal, setMultipleModal] = useState(false);
    const [focusModal, setFocusModal] = useState(false);
    const [lightingModal, setLightingModal] = useState(false);

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

    // Multiple Faces (5s timer - updated)
    useEffect(() => {
        let timer;
        if (flags.LOW_LIGHT && !lightingModal) {
            timer = setTimeout(() => {
                captureViolation('MULTIPLE_FACES');
                setMultipleModal(true);
            }, 5000);
        }
        return () => clearTimeout(timer);
    }, [flags.LOW_LIGHT, lightingModal, captureViolation]);


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
                <title>Exam In Progress</title>
                {/* Ensure Material Icons are available for the status tool */}
                <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet" />
            </Head>

            {/* Hidden Video Elements for Logic */}
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

                {/* Top Subject Bar */}
                <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center">
                    <button className="bg-blue-400 text-white px-6 py-2 rounded-lg font-bold shadow-md hover:bg-blue-500 transition-colors">
                        Subject 1
                    </button>
                    {/* Add more subjects if needed */}
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex p-6 gap-6 max-w-7xl mx-auto w-full">

                    {/* Left: Question Area */}
                    <div className="flex-1">
                        <QuestionCard />
                    </div>

                    {/* Right: Sidebar */}
                    <div className="w-80 flex flex-col gap-6">

                        {/* 1. Status Icons (Proctoring) */}
                        <div className="flex justify-end">
                            <ProctoringStatusIcons
                                flags={flags}
                                screenShareActive={screenShare.isSharing}
                            />
                        </div>

                        {/* 2. Controls */}
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

                        {/* 3. Question Palette */}
                        <div className="bg-blue-50/50 rounded-xl p-4">
                            <h3 className="text-blue-400 font-bold mb-4 text-sm">Subject 1</h3>
                            <div className="grid grid-cols-6 gap-2">
                                {/* Dummy Grid 1-30 */}
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

                        {/* 4. Violation Gallery (Restored) */}
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
                                                    {(() => {
                                                        switch (v.type) {
                                                            case 'TAB_FOCUS_LOST': return 'Tab Focus Lost';
                                                            case 'FACE_MISSING': return 'Face Missing';
                                                            case 'MULTIPLE_FACES': return 'Multiple Faces';
                                                            case 'SCREEN_SHARE_STOPPED': return 'Screen Share Stopped';
                                                            default: return v.type.replace(/_/g, ' ');
                                                        }
                                                    })()}
                                                </span>
                                                <span className="text-[9px] text-red-400 font-mono">{v.timestamp}</span>
                                            </div>
                                            <div className="p-1.5 flex gap-1.5">
                                                <img src={v.image} alt="User" className="w-1/2 rounded bg-black aspect-video object-cover" />
                                                {v.screenImage ? (
                                                    <img src={v.screenImage} alt="Screen" className="w-1/2 rounded bg-gray-100 border border-gray-100 aspect-video object-cover" />
                                                ) : (
                                                    <div className="w-1/2 bg-gray-100 rounded flex items-center justify-center text-[8px] text-gray-400 aspect-video">
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

                </div>

            </main>

            {/* BLOCKING MODALS */}

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

            {/* Face Visibility Warning Modal */}
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

            {/* Multiple Faces Warning Modal */}
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

            {/* Tab Focus Loss Warning Modal */}
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

            {/* Low Light Warning Modal */}
            {lightingModal && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md text-center border-4 border-yellow-500 animate-pulse-slow">
                        <div className="text-6xl mb-4">💡</div>
                        <h2 className="text-2xl font-bold text-yellow-600 mb-2">Poor Lighting Detected</h2>
                        <p className="text-gray-700 font-medium mb-6">
                            The lighting in your room is too low for the proctoring AI.
                            <br /><br />
                            Please turn on a light or face a light source.
                        </p>
                        <button
                            onClick={() => setLightingModal(false)}
                            className="bg-yellow-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-yellow-700 transition-transform transform active:scale-95 shadow-lg"
                        >
                            I've Improved Lighting
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
