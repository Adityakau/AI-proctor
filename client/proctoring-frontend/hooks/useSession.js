/**
 * useSession - Session management hook
 * 
 * Handles session lifecycle: auth, start, heartbeat, end.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { fetchDevToken, startSession, endSession, sendHeartbeat, DEV_MODE } from '../lib/api';

const HEARTBEAT_INTERVAL_MS = 120000; // 120 seconds (2 minutes)

export function useSession() {
    const [jwt, setJwt] = useState(null);
    const [sessionId, setSessionId] = useState(null);
    const [status, setStatus] = useState('IDLE'); // IDLE, AUTHENTICATING, STARTING, ACTIVE, ENDING, ENDED, ERROR
    const [error, setError] = useState(null);

    const heartbeatRef = useRef(null);

    /**
     * Initialize session (get token + start session)
     */
    const initialize = useCallback(async (examConfig = {}) => {
        setStatus('AUTHENTICATING');
        setError(null);

        try {
            // Get JWT (dev mode auto-fetch)
            let token = jwt;
            if (!token && DEV_MODE) {
                token = await fetchDevToken();
                if (token) setJwt(token);
            }

            if (!token) {
                throw new Error('No valid authentication token');
            }

            // Start session
            setStatus('STARTING');
            const result = await startSession(token, examConfig);
            setSessionId(result.sessionId);
            setStatus('ACTIVE');

            return { jwt: token, sessionId: result.sessionId };
        } catch (e) {
            console.error('Session init failed:', e);
            setError(e.message);
            setStatus('ERROR');
            return null;
        }
    }, [jwt]);

    /**
     * End current session
     */
    const end = useCallback(async () => {
        if (!jwt) return;

        setStatus('ENDING');
        try {
            await endSession(jwt);
            setStatus('ENDED');
        } catch (e) {
            console.error('Session end failed:', e);
            setError(e.message);
            setStatus('ERROR');
        }
    }, [jwt]);

    /**
     * Heartbeat effect - runs while session is active
     */
    useEffect(() => {
        if (status !== 'ACTIVE' || !jwt) {
            if (heartbeatRef.current) {
                clearInterval(heartbeatRef.current);
                heartbeatRef.current = null;
            }
            return;
        }

        heartbeatRef.current = setInterval(() => {
            sendHeartbeat(jwt);
        }, HEARTBEAT_INTERVAL_MS);

        return () => {
            if (heartbeatRef.current) {
                clearInterval(heartbeatRef.current);
            }
        };
    }, [status, jwt]);

    return {
        jwt,
        sessionId,
        status,
        error,
        isActive: status === 'ACTIVE',
        initialize,
        end,
    };
}
