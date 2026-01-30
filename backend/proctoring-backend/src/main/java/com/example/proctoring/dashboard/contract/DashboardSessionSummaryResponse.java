package com.example.proctoring.dashboard.contract;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public record DashboardSessionSummaryResponse(
        String sessionId,
        String userName,
        int trustScorePercent,
        Instant startedAt,
        Instant submittedAt,
        Map<String, Object> deviceInfo,
        List<AlertSummaryItem> alertSummary,
        List<EvidenceSummaryItem> evidenceSummary
) {}
