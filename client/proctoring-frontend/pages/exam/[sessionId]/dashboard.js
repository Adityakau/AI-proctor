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

export default function Dashboard() {
    const router = useRouter();
    const { sessionId } = router.query;

    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!sessionId) return;

        async function loadSummary() {
            try {
                setLoading(true);
                setError(null);

                // Get JWT (in dev mode, fetch a new token)
                let jwt = localStorage.getItem('proctoring_jwt');
                if (!jwt && DEV_MODE) {
                    jwt = await fetchDevToken();
                    if (jwt) localStorage.setItem('proctoring_jwt', jwt);
                }

                if (!jwt) {
                    throw new Error('No authentication token available');
                }

                const data = await fetchDashboardSummary(jwt, sessionId);
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
                <div className="max-w-4xl mx-auto">
                    {/* Header */}
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold mb-2">Exam Dashboard</h1>
                        <p className="text-gray-400">Session ID: {sessionId}</p>
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
                                <div className="bg-gray-800 rounded-lg p-6">
                                    <h2 className="text-lg font-semibold mb-4 text-gray-300">Candidate Information</h2>
                                    <div className="space-y-2">
                                        <p><span className="text-gray-400">Name:</span> {summary.userName || 'N/A'}</p>
                                    </div>
                                </div>

                                <div className="bg-gray-800 rounded-lg p-6">
                                    <h2 className="text-lg font-semibold mb-4 text-gray-300">Trust Score</h2>
                                    <div className={`text-5xl font-bold ${getTrustScoreColor(summary.trustScorePercent)}`}>
                                        {summary.trustScorePercent}%
                                    </div>
                                </div>
                            </div>

                            {/* Timestamps */}
                            <div className="bg-gray-800 rounded-lg p-6">
                                <h2 className="text-lg font-semibold mb-4 text-gray-300">Session Timeline</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <span className="text-gray-400">Started At:</span>
                                        <p className="font-mono">{formatTime(summary.startedAt)}</p>
                                    </div>
                                    <div>
                                        <span className="text-gray-400">Submitted At:</span>
                                        <p className="font-mono">{formatTime(summary.submittedAt)}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Device Info */}
                            {summary.deviceInfo && Object.keys(summary.deviceInfo).length > 0 && (
                                <div className="bg-gray-800 rounded-lg p-6">
                                    <h2 className="text-lg font-semibold mb-4 text-gray-300">Device Information</h2>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                        {Object.entries(summary.deviceInfo).map(([key, value]) => (
                                            <div key={key}>
                                                <span className="text-gray-400">{key}:</span>
                                                <p className="font-mono truncate">{String(value)}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Alert Summary */}
                            {summary.alertSummary && summary.alertSummary.length > 0 && (
                                <div className="bg-gray-800 rounded-lg p-6">
                                    <h2 className="text-lg font-semibold mb-4 text-gray-300">Alert Summary</h2>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        {summary.alertSummary.map((alert, idx) => (
                                            <div key={idx} className="bg-gray-700 rounded p-4 text-center">
                                                <div className="text-2xl font-bold text-yellow-400">{alert.totalCount}</div>
                                                <div className="text-sm text-gray-400 mt-1">{alert.alertType}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Evidence Thumbnails */}
                            {summary.evidenceSummary && summary.evidenceSummary.length > 0 && (
                                <div className="bg-gray-800 rounded-lg p-6">
                                    <h2 className="text-lg font-semibold mb-4 text-gray-300">Evidence ({summary.evidenceSummary.length})</h2>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        {summary.evidenceSummary.slice(0, 8).map((evidence, idx) => (
                                            <div key={idx} className="bg-gray-700 rounded p-2">
                                                <div className="text-xs text-gray-400 truncate">{evidence.evidenceId}</div>
                                                <div className="text-xs text-gray-500 mt-1">{formatTime(evidence.createdAt)}</div>
                                            </div>
                                        ))}
                                    </div>
                                    {summary.evidenceSummary.length > 8 && (
                                        <p className="text-sm text-gray-400 mt-4">
                                            + {summary.evidenceSummary.length - 8} more items
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Back Button */}
                            <div className="pt-6">
                                <button
                                    onClick={() => router.push('/')}
                                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold"
                                >
                                    Return to Home
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
