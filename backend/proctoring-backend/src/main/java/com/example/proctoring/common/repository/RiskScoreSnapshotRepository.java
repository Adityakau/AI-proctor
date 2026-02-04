package com.example.proctoring.common.repository;

import com.example.proctoring.common.model.RiskScoreSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RiskScoreSnapshotRepository extends JpaRepository<RiskScoreSnapshot, String> {
    List<RiskScoreSnapshot> findBySessionIdOrderByCreatedAtDesc(String sessionId);
}
