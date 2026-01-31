import React, { createContext, useContext } from 'react';
import { useWebcam } from '../hooks/useWebcam';
import { useScreenShare } from '../hooks/useScreenShare';
import { useProctoringState } from '../hooks/useProctoringState';
import { useWindowFocus } from '../hooks/useWindowFocus';

const ProctoringContext = createContext(null);

export function ProctoringProvider({ children }) {
    // Initialize hooks centrally so state persists across page navigation
    const webcam = useWebcam();
    const screenShare = useScreenShare();
    const proctoring = useProctoringState();
    const windowFocus = useWindowFocus();

    const value = {
        webcam,
        screenShare,
        proctoring,
        windowFocus
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
