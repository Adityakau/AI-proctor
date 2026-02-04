package com.example.proctoring.security;

import org.springframework.security.oauth2.jwt.Jwt;

public class JwtClaims {

    private final String userId;
    private final String examScheduleId;
    private final String tenantId;
    private final int attemptNo;

    public JwtClaims(String userId, String examScheduleId, String tenantId, int attemptNo) {
        this.userId = userId;
        this.examScheduleId = examScheduleId;
        this.tenantId = tenantId;
        this.attemptNo = attemptNo;
    }

    public static JwtClaims fromJwt(Jwt jwt) {
        String userId = jwt.getClaimAsString("user_id");
        String examScheduleId = jwt.getClaimAsString("exam_schedule_id");
        String tenantId = jwt.getClaimAsString("tenant_id");
        Object attemptNoClaim = jwt.getClaim("attempt_no");
        Integer attemptNo = null;
        if (attemptNoClaim instanceof Number) {
            attemptNo = ((Number) attemptNoClaim).intValue();
        } else if (attemptNoClaim instanceof String) {
            attemptNo = Integer.parseInt((String) attemptNoClaim);
        }
        if (userId == null || examScheduleId == null || tenantId == null || attemptNo == null) {
            throw new IllegalArgumentException("Missing required claims in JWT");
        }
        return new JwtClaims(userId, examScheduleId, tenantId, attemptNo);
    }

    public String getUserId() {
        return userId;
    }

    public String getExamScheduleId() {
        return examScheduleId;
    }

    public String getTenantId() {
        return tenantId;
    }

    public int getAttemptNo() {
        return attemptNo;
    }

    public String toSessionIdentityKey() {
        return tenantId + ":" + examScheduleId + ":" + userId + ":" + attemptNo;
    }
}
