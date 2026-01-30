package com.example.proctoring.rules.repository;

import com.example.proctoring.common.model.ProctoringSession;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProctoringSessionRepository extends JpaRepository<ProctoringSession, String> {
}

