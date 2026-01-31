/**
 * Dashboard Page - Read-only session summary
 * 
 * Route: /exam/[sessionId]/dashboard
 * Displays session summary after exam completion.
 * NO proctoring logic, NO camera access, safe to refresh.
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
            <div className={`flex items-center justify-center bg-gray-800 text-gray-500 text-xs ${className}`}>
                Image Error
            </div>
        );
    }

    if (!imageUrl) {
        return (
            <div className={`animate-pulse bg-gray-700 ${className}`} />
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

                // Get JWT (in dev mode, fetch a new token)
                let token = localStorage.getItem('proctoring_jwt');

                // If in dev mode and no token, OR if explicit dev token fetch is needed
                // Note: For dashboard, we usually want the SAME token used for the exam.
                // But if that's lost, we might need a dev token to view it (if allowed).
                if (!token && DEV_MODE) {
                    token = await fetchDevToken();
                    if (token) localStorage.setItem('proctoring_jwt', token);
                }

                if (!token) {
                    throw new Error('No authentication token available');
                }
                setJwt(token);

                const data = await fetchDashboardSummary(token, sessionId);
                setSummary(data);
            } catch (e) {
                console.error('Failed to load dashboard summary:', e);
                setError(e.message);
            } finally {
                setLoading(false);
            }
        }

        loadSummary();
    }, [sessionId]);

    // Format timestamp for display
    const formatTime = (isoString) => {
        if (!isoString) return 'N/A';
        return new Date(isoString).toLocaleString();
    };

    // Get trust score color
    const getTrustScoreColor = (score) => {
        if (score >= 80) return 'text-green-600';
        if (score >= 60) return 'text-yellow-600';
        return 'text-red-600';
    };

    return (
        <>
            <Head>
                <title>Exam Dashboard | Proctoring</title>
            </Head>

            <div className="min-h-screen bg-gray-900 text-white p-8">
                <div className="max-w-6xl mx-auto">
                    {/* Header */}
                    <div className="mb-8 flex justify-between items-center">
                        <div>
                            <h1 className="text-3xl font-bold mb-2">Exam Dashboard</h1>
                            <p className="text-gray-400">Session ID: {sessionId}</p>
                        </div>
                        <button
                            onClick={() => router.push('/')}
                            className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded text-sm"
                        >
                            Back to Home
                        </button>
                    </div>

                    {/* Loading State */}
                    {loading && (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                            <span className="ml-4 text-gray-400">Loading summary...</span>
                        </div>
                    )}

                    {/* Error State */}
                    {error && (
                        <div className="bg-red-900/50 border border-red-500 rounded-lg p-6 mb-6">
                            <h3 className="text-red-400 font-semibold mb-2">Error Loading Dashboard</h3>
                            <p className="text-gray-300">{error}</p>
                            <button
                                onClick={() => router.reload()}
                                className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white"
                            >
                                Retry
                            </button>
                        </div>
                    )}

                    {/* Summary Content */}
                    {summary && !loading && (
                        <div className="space-y-6">
                            {/* Candidate Info & Trust Score */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                                    <h2 className="text-lg font-semibold mb-4 text-gray-300">Candidate Information</h2>
                                    <div className="space-y-3">
                                        <p className="flex justify-between border-b border-gray-700 pb-2">
                                            <span className="text-gray-400">Name:</span>
                                            <span className="font-mono">{summary.userName || 'N/A'}</span>
                                        </p>
                                        <p className="flex justify-between border-b border-gray-700 pb-2">
                                            <span className="text-gray-400">Started:</span>
                                            <span className="font-mono">{formatTime(summary.startedAt)}</span>
                                        </p>
                                        <p className="flex justify-between">
                                            <span className="text-gray-400">Ended:</span>
                                            <span className="font-mono">{formatTime(summary.submittedAt)}</span>
                                        </p>
                                    </div>
                                </div>

                                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 flex flex-col items-center justify-center">
                                    <h2 className="text-lg font-semibold mb-2 text-gray-300">Trust Score</h2>
                                    <div className={`text-6xl font-bold ${getTrustScoreColor(summary.trustScorePercent)}`}>
                                        {summary.trustScorePercent}%
                                    </div>
                                    <p className="text-sm text-gray-500 mt-2">Based on detected anomalies</p>
                                </div>
                            </div>

                            {/* Alert Summary */}
                            {summary.alertSummary && summary.alertSummary.length > 0 && (
                                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                                    <h2 className="text-lg font-semibold mb-4 text-gray-300">Detected Anomalies</h2>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        {summary.alertSummary.map((alert, idx) => (
                                            <div key={idx} className="bg-gray-700/50 rounded-lg p-4 text-center border border-gray-600">
                                                <div className="text-3xl font-bold text-yellow-400">{alert.totalCount}</div>
                                                <div className="text-xs text-gray-400 mt-1 uppercase tracking-wider">{alert.alertType.replace(/_/g, ' ')}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Evidence Gallery */}
                            {summary.evidenceSummary && summary.evidenceSummary.length > 0 && (
                                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                                    <h2 className="text-lg font-semibold mb-4 text-gray-300">Evidence Gallery ({summary.evidenceSummary.length})</h2>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                        {summary.evidenceSummary.map((evidence, idx) => (
                                            <div key={idx} className="bg-gray-700 rounded-lg overflow-hidden flex flex-col h-48 border border-gray-600 transition hover:border-blue-500">
                                                <EvidenceImage
                                                    evidenceId={evidence.evidenceId}
                                                    jwt={jwt}
                                                    className="w-full h-32"
                                                />
                                                <div className="p-2 flex-1 flex flex-col justify-between">
                                                    <div className="text-[10px] text-gray-400 truncate" title={evidence.evidenceId}>
                                                        ID: {evidence.evidenceId.substring(0, 8)}...
                                                    </div>
                                                    <div className="text-[10px] text-gray-300">
                                                        {new Date(evidence.createdAt).toLocaleTimeString()}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Device Info */}
                            {summary.deviceInfo && Object.keys(summary.deviceInfo).length > 0 && (
                                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                                    <h2 className="text-lg font-semibold mb-4 text-gray-300">System Information</h2>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
                                        {Object.entries(summary.deviceInfo).map(([key, value]) => (
                                            <div key={key} className="bg-gray-900 p-2 rounded border border-gray-700">
                                                <span className="text-gray-500 block mb-1 uppercase text-[10px]">{key}</span>
                                                <span className="text-gray-300 truncate block text-ellipsis">{String(value)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
