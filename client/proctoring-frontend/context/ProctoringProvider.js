import React, { createContext, useContext } from 'react';
import { useWebcam } from '../hooks/useWebcam';
import { useScreenShare } from '../hooks/useScreenShare';
import { useProctoringState } from '../hooks/useProctoringState';
import { useWindowFocus } from '../hooks/useWindowFocus';
import { useSession } from '../hooks/useSession';
import { useEventBatcher } from '../hooks/useEventBatcher';

const ProctoringContext = createContext(null);

export function ProctoringProvider({ children }) {
    // Initialize hooks centrally so state persists across page navigation
    const webcam = useWebcam();
    const screenShare = useScreenShare();
    const proctoring = useProctoringState();
    const windowFocus = useWindowFocus();
    const session = useSession();

    // Event batcher depends on session state
    const eventBatcher = useEventBatcher({
        jwt: session.jwt,
        sessionId: session.sessionId,
        isActive: session.isActive,
    });

    const value = {
        webcam,
        screenShare,
        proctoring,
        windowFocus,
        session,
        eventBatcher,
    };

    return (
        <ProctoringContext.Provider value={value}>
            {children}
        </ProctoringContext.Provider>
    );
}

export function useProctoring() {
    const context = useContext(ProctoringContext);
    if (!context) {
        throw new Error('useProctoring must be used within a ProctoringProvider');
    }
    return context;
}
