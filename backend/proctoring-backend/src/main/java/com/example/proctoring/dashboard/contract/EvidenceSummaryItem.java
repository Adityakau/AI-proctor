package com.example.proctoring.dashboard.contract;

import java.time.Instant;

public record EvidenceSummaryItem(
        String evidenceId,
        String filePath,
        String mimeType,
        Instant createdAt
) {}
