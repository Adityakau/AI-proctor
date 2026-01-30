package com.example.proctoring.rules.repository;

import com.example.proctoring.common.model.Alert;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AlertRepository extends JpaRepository<Alert, String> {
}

