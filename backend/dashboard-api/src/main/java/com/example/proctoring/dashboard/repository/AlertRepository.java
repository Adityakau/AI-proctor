package com.example.proctoring.dashboard.repository;

import com.example.proctoring.common.model.Alert;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AlertRepository extends JpaRepository<Alert, String> {
    Page<Alert> findBySessionId(String sessionId, Pageable pageable);
}

