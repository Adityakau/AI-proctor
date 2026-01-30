package com.example.proctoring.rules.repository;

import com.example.proctoring.common.model.RiskScoreSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RiskScoreSnapshotRepository extends JpaRepository<RiskScoreSnapshot, String> {
}

