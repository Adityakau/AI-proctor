package com.example.proctoring.rules.repository;

import com.example.proctoring.common.model.AnomalyEvent;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AnomalyEventRepository extends JpaRepository<AnomalyEvent, String> {
}

