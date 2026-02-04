package com.example.proctoring.common.repository;

import com.example.proctoring.common.model.ProctoringSession;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ProctoringSessionRepository extends JpaRepository<ProctoringSession, String> {
    Optional<ProctoringSession> findByTenantIdAndExamScheduleIdAndUserIdAndAttemptNo(
            String tenantId, String examScheduleId, String userId, int attemptNo);
}
