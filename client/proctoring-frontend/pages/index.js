/**
 * Landing Page - System Check
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useProctoring } from '../context/ProctoringProvider';
import { useFullscreen } from '../hooks/useFullscreen';

export default function Home() {
  const router = useRouter();
  const { webcam, screenShare, session } = useProctoring();
  const [isStarting, setIsStarting] = useState(false);

  const videoRef = useRef(null);
  const screenPreviewRef = useRef(null);

  /* Fullscreen Logic */
  const { isFullscreen, enterFullscreen } = useFullscreen();

  // Attach webcam stream to video element
  useEffect(() => {
    if (videoRef.current && webcam.stream) {
      videoRef.current.srcObject = webcam.stream;
    }
  }, [webcam.stream]);

  const handleStartExam = async () => {
    if (!webcam.isActive || !isFullscreen || !screenShare.isSharing) {
      alert("Please complete all system checks.");
      return;
    }

    setIsStarting(true);
    try {
      // Initialize session (fetches dev token + starts session)
      const result = await session.initialize({
        maxLookAwaySeconds: 5,
        maxLookAwayWindowSeconds: 30,
      });

      if (result) {
        router.push('/exam');
      } else {
        alert("Failed to start session. Please try again.");
      }
    } catch (e) {
      console.error("Session start error:", e);
      alert("Failed to connect to server.");
    } finally {
      setIsStarting(false);
    }
  };

  const allChecksPassed = webcam.isActive && isFullscreen && screenShare.isSharing;

  return (
    <div className="min-h-screen flex flex-col">
      <Head><title>System Check - Proctoring</title></Head>

      <header className="bg-white border-b px-6 py-4">
        <h1 className="text-xl font-bold text-gray-800">System Check</h1>
      </header>

      <main className="flex-1 flex items-center justify-center overflow-hidden">
        {/* Left: Video Preview */}
        <div className="w-5/12 bg-white flex items-center justify-center relative p-6">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full rounded-lg object-contain ${webcam.isActive ? 'block' : 'hidden'}`}
          />
          {!webcam.isActive && (
            <div className="text-gray-500 flex flex-col items-center">
              <span className="text-4xl mb-2">📹</span>
              <span>Camera Preview</span>
            </div>
          )}
        </div>

        {/* Right: Instructions */}
        <div className="w-1/2 p-8 overflow-y-auto">
          <h2 className="text-2xl font-semibold mb-6">Before we start...</h2>
          <div className="space-y-6">

            {/* Step 1: Camera */}
            <div className={`p-4 rounded-lg border-2 ${webcam.isActive ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold">1. Enable Camera</h3>
                {webcam.isActive && <span className="text-green-600 font-bold">✓ Ready</span>}
              </div>
              <p className="text-sm text-gray-600 mb-3">We need to see you during the exam. Position yourself in the center.</p>
              {!webcam.isActive && (
                <button
                  onClick={webcam.startCamera}
                  disabled={webcam.isLoading}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {webcam.isLoading ? 'Starting...' : 'Enable Camera'}
                </button>
              )}
              {webcam.error && <div className="text-red-500 text-xs mt-2">{webcam.error}</div>}
            </div>

            {/* Step 2: Full Screen */}
            <div className={`p-4 rounded-lg border-2 ${isFullscreen ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold">2. Full Screen Mode</h3>
                {isFullscreen && <span className="text-green-600 font-bold">✓ Ready</span>}
              </div>
              <p className="text-sm text-gray-600 mb-3">The exam must be taken in full screen mode.</p>
              {!isFullscreen && (
                <button
                  onClick={enterFullscreen}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  Enter Full Screen
                </button>
              )}
            </div>

            {/* Step 3: Screen Share */}
            <div className={`p-4 rounded-lg border-2 ${screenShare.isSharing ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold">3. Share Entire Screen</h3>
                {screenShare.isSharing && <span className="text-green-600 font-bold">✓ Ready</span>}
              </div>
              <p className="text-sm text-gray-600 mb-3">
                You must share your <strong>Entire Screen</strong>. Sharing a tab or window is not allowed.
              </p>
              {screenShare.isSharing && (
                <div className="bg-blue-50 text-blue-800 text-xs p-3 rounded-lg mb-3 border border-blue-100 flex gap-2">
                  <span className="text-lg">💡</span>
                  <div>
                    <strong>Tip:</strong> You can click <strong>"Hide"</strong> on the floating toolbar at the bottom of your screen to keep it out of the way.
                  </div>
                </div>
              )}
              {!screenShare.isSharing && (
                <button
                  onClick={screenShare.startScreenShare}
                  className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
                >
                  Share Screen
                </button>
              )}
              {screenShare.error && <div className="text-red-500 text-xs mt-2 font-bold">{screenShare.error}</div>}
            </div>

            {/* Start Button */}
            <div className="pt-6">
              <button
                onClick={handleStartExam}
                disabled={!allChecksPassed || isStarting}
                className={`w-full py-4 rounded-lg text-lg font-bold transition-all ${allChecksPassed && !isStarting
                  ? 'bg-green-600 text-white hover:bg-green-700 shadow-lg transform hover:-translate-y-1'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
              >
                {isStarting ? 'Connecting...' : 'Start Exam'}
              </button>
              {!allChecksPassed && (
                <p className="text-center text-xs text-gray-500 mt-2">Complete all steps above to proceed</p>
              )}
              {session.error && (
                <p className="text-center text-xs text-red-500 mt-2">{session.error}</p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
