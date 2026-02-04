package com.example.proctoring.dashboard.contract;

public record AlertSummaryItem(
        String alertType,
        long totalCount
) {}
