package com.example.proctoring.common.repository;

import com.example.proctoring.common.model.Alert;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AlertRepository extends JpaRepository<Alert, String> {
    List<Alert> findBySessionIdOrderByCreatedAtDesc(String sessionId);
}
