package com.example.proctoring.common.repository;

import com.example.proctoring.common.model.AnomalyEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AnomalyEventRepository extends JpaRepository<AnomalyEvent, String> {
    List<AnomalyEvent> findBySessionIdOrderByEventTimeDesc(String sessionId);
}
