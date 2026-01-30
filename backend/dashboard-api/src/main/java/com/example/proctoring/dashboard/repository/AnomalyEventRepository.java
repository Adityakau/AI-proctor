package com.example.proctoring.dashboard.repository;

import com.example.proctoring.common.model.AnomalyEvent;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AnomalyEventRepository extends JpaRepository<AnomalyEvent, String> {
    Page<AnomalyEvent> findBySessionId(String sessionId, Pageable pageable);
}

