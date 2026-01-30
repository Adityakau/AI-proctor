package com.example.proctoring.dashboard.repository;

import com.example.proctoring.common.model.ProctoringSession;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProctoringSessionRepository extends JpaRepository<ProctoringSession, String> {
    Page<ProctoringSession> findByTenantIdAndExamScheduleId(String tenantId, String examScheduleId, Pageable pageable);
}

