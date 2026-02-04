/**
 * Dashboard Page - Premium Redesign
 * 
 * Route: /exam/[sessionId]/dashboard
 * Displays session summary with glassmorphism, animations, and dark aesthetics.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { fetchDashboardSummary, fetchDevToken, DEV_MODE } from '../../../lib/api';

// Secure Image Component
function EvidenceImage({ evidenceId, jwt, className }) {
    const [imageUrl, setImageUrl] = useState(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        let objectUrl = null;

        async function fetchImage() {
            try {
                const resp = await fetch(`${DEV_MODE ? 'http://localhost:8082' : ''}/proctoring/evidence/${evidenceId}`, {
                    headers: { 'Authorization': `Bearer ${jwt}` }
                });
                if (!resp.ok) throw new Error('Failed to load image');
                const blob = await resp.blob();
                objectUrl = URL.createObjectURL(blob);
                setImageUrl(objectUrl);
            } catch (e) {
                console.error('Image load failed:', e);
                setError(true);
            }
        }

        if (evidenceId && jwt) {
            fetchImage();
        }

        return () => {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [evidenceId, jwt]);

    if (error) {
        return (
            <div className={`flex items-center justify-center bg-gray-800/50 text-gray-500 text-xs ${className}`}>
                <span className="opacity-50">Error</span>
            </div>
        );
    }

    if (!imageUrl) {
        return (
            <div className={`animate-pulse bg-white/5 ${className}`} />
        );
    }

    return (
        <img src={imageUrl} alt={evidenceId} className={`object-cover ${className}`} />
    );
}

export default function Dashboard() {
    const router = useRouter();
    const { sessionId } = router.query;

    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [jwt, setJwt] = useState(null);

    useEffect(() => {
        if (!sessionId) return;

        async function loadSummary() {
            try {
                setLoading(true);
                setError(null);
                let token = localStorage.getItem('proctoring_jwt');

                // Only fetch new token if we absolutely don't have one. 
                // Creating a new token creates a NEW user, which won't match the old session.
                if (!token && DEV_MODE) {
                    console.warn("No token found. Generating new Dev token (Warning: This may not match the session owner).");
                    token = await fetchDevToken();
                    if (token) localStorage.setItem('proctoring_jwt', token);
                }

                if (!token) throw new Error('No authentication token available');
                setJwt(token);

                try {
                    const data = await fetchDashboardSummary(token, sessionId);
                    setSummary(data);
                } catch (apiError) {
                    if (apiError.message.includes('401') || apiError.message.includes('403')) {
                        // 401/403 means token is bad or mismatches the session owner.
                        // We cannot fix this by getting a new token (as it would be a new user).
                        // We must ask user to start over.
                        localStorage.removeItem('proctoring_jwt'); // Clear bad token
                        throw new Error("Session expired or unauthorized. Please start a new exam.");
                    }
                    throw apiError;
                }
            } catch (e) {
                console.error('Failed to load dashboard summary:', e);
                setError(e.message);
            } finally {
                setLoading(false);
            }
        }

        loadSummary();
    }, [sessionId]);

    const formatTime = (isoString) => {
        if (!isoString) return 'N/A';
        return new Date(isoString).toLocaleString(undefined, {
            weekday: 'short', hour: '2-digit', minute: '2-digit'
        });
    };

    const getTrustScoreColor = (score) => {
        if (score >= 80) return 'text-emerald-400';
        if (score >= 60) return 'text-yellow-400';
        return 'text-rose-500';
    };

    const getTrustScoreGradient = (score) => {
        if (score >= 80) return 'from-emerald-400 to-cyan-400';
        if (score >= 60) return 'from-yellow-400 to-orange-400';
        return 'from-rose-500 to-pink-500';
    };

    return (
        <>
            <Head>
                <title>Exam Result | Proctoring</title>
            </Head>

            <div className="min-h-screen bg-[#0a0a0f] text-white font-sans selection:bg-purple-500/30">
                {/* Background Ambient Glow */}
                <div className="fixed inset-0 pointer-events-none">
                    <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl opacity-50 mix-blend-screen" />
                    <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl opacity-50 mix-blend-screen" />
                </div>

                <div className="max-w-7xl mx-auto p-8 relative z-10">

                    {/* Header */}
                    <div className="flex flex-col md:flex-row justify-between items-center mb-12 border-b border-white/5 pb-6">
                        <div className="text-center md:text-left">
                            <h1 className="text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 tracking-tight mb-2">
                                Session Report
                            </h1>
                            <p className="text-gray-400 font-mono text-xs tracking-wider uppercase opacity-70">
                                ID: {sessionId || 'Loading...'}
                            </p>
                        </div>
                        <button
                            onClick={() => router.push('/')}
                            className="mt-6 md:mt-0 px-6 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-sm font-medium transition-all hover:scale-105 active:scale-95"
                        >
                            Back to Home
                        </button>
                    </div>

                    {/* Content */}
                    {loading && (
                        <div className="flex flex-col items-center justify-center py-20">
                            <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-6" />
                            <span className="text-gray-500 text-sm tracking-widest uppercase animate-pulse">Generating Analytics...</span>
                        </div>
                    )}

                    {error && (
                        <div className="max-w-xl mx-auto bg-red-500/10 border border-red-500/30 rounded-2xl p-8 text-center backdrop-blur-xl">
                            <div className="text-3xl mb-4">⚠️</div>
                            <h3 className="text-xl font-bold text-red-400 mb-2">Unable to Load Report</h3>
                            <p className="text-gray-400 mb-6 text-sm">{error}</p>
                            <button
                                onClick={() => router.push('/')}
                                className="px-8 py-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded-lg text-red-200 transition-all font-bold"
                            >
                                Start New Exam
                            </button>
                        </div>
                    )}

                    {summary && !loading && (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                            {/* Left Column: Stats & Score */}
                            <div className="lg:col-span-4 space-y-6">

                                {/* Trust Score Card */}
                                <div className="bg-gray-900/40 backdrop-blur-xl border border-white/10 rounded-3xl p-8 relative overflow-hidden group">
                                    <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${getTrustScoreGradient(summary.trustScorePercent)}`} />

                                    <h2 className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-6">Trust Score</h2>

                                    <div className="flex items-baseline">
                                        <span className={`text-7xl font-black bg-clip-text text-transparent bg-gradient-to-br ${getTrustScoreGradient(summary.trustScorePercent)}`}>
                                            {summary.trustScorePercent}
                                        </span>
                                        <span className="text-2xl text-gray-500 font-medium ml-2">/100</span>
                                    </div>

                                    <div className="mt-8 space-y-4">
                                        <div className="flex justify-between text-sm py-2 border-b border-white/5">
                                            <span className="text-gray-500">Status</span>
                                            <span className={`font-bold ${getTrustScoreColor(summary.trustScorePercent)}`}>
                                                {summary.trustScorePercent >= 80 ? 'Excellent' : summary.trustScorePercent >= 60 ? 'Review Needed' : 'Flagged'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Candidate Details */}
                                <div className="bg-gray-900/40 backdrop-blur-xl border border-white/10 rounded-3xl p-8">
                                    <h3 className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-6">Candidate</h3>
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-lg font-bold">
                                                {summary.userName ? summary.userName[0] : 'U'}
                                            </div>
                                            <div>
                                                <div className="font-bold text-lg">{summary.userName || 'Unknown'}</div>
                                                <div className="text-xs text-gray-500 font-mono">ID: {summary.userId?.substring(0, 8)}...</div>
                                            </div>
                                        </div>
                                        <div className="pt-4 border-t border-white/5 space-y-2 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">Started</span>
                                                <span className="text-gray-300 font-mono">{formatTime(summary.startedAt)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">Submitted</span>
                                                <span className="text-gray-300 font-mono">{formatTime(summary.submittedAt)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* System Info (Compact) */}
                                {summary.deviceInfo && (
                                    <div className="bg-gray-900/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6">
                                        <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-4">System</h3>
                                        <div className="grid grid-cols-1 gap-2 text-xs font-mono text-gray-500">
                                            {Object.entries(summary.deviceInfo).slice(0, 3).map(([k, v]) => (
                                                <div key={k} className="flex justify-between">
                                                    <span>{k}</span>
                                                    <span className="text-gray-400 truncate max-w-[120px]">{String(v)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Right Column: Evidence & Alerts */}
                            <div className="lg:col-span-8 space-y-6">

                                {/* Alert Grid */}
                                {summary.alertSummary && (
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        {summary.alertSummary.map((alert, idx) => (
                                            <div key={idx} className="bg-gray-800/30 border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center transition-all hover:bg-gray-800/50 hover:scale-105">
                                                <div className="text-3xl font-bold text-white mb-1">{alert.totalCount}</div>
                                                <div className="text-[10px] uppercase tracking-wider text-gray-500 text-center font-bold">
                                                    {alert.alertType.replace(/_/g, ' ')}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Evidence Gallery */}
                                <div className="bg-gray-900/40 backdrop-blur-xl border border-white/10 rounded-3xl p-8">
                                    <div className="flex justify-between items-end mb-6">
                                        <h3 className="text-xl font-bold">Evidence Gallery</h3>
                                        <span className="text-sm text-gray-500">{summary.evidenceSummary?.length || 0} Captures</span>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                                        {summary.evidenceSummary?.map((evidence, idx) => (
                                            <div key={idx} className="group relative aspect-video bg-black rounded-xl overflow-hidden border border-white/5 shadow-2xl transition-all hover:border-blue-500/50 hover:scale-105">
                                                <EvidenceImage
                                                    evidenceId={evidence.evidenceId}
                                                    jwt={jwt}
                                                    className="w-full h-full opacity-60 group-hover:opacity-100 transition-opacity duration-500"
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
                                                    <span className="text-[10px] text-gray-300 font-mono">
                                                        {new Date(evidence.createdAt).toLocaleTimeString()}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <style jsx global>{`
                    .custom-scrollbar::-webkit-scrollbar {
                        width: 6px;
                    }
                    .custom-scrollbar::-webkit-scrollbar-track {
                        background: rgba(255, 255, 255, 0.05);
                        border-radius: 4px;
                    }
                    .custom-scrollbar::-webkit-scrollbar-thumb {
                        background: rgba(255, 255, 255, 0.2);
                        border-radius: 4px;
                    }
                `}</style>
            </div>
        </>
    );
}
