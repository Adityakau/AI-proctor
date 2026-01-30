package com.example.proctoring.ingest.repository;

import com.example.proctoring.common.model.Evidence;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface EvidenceRepository extends JpaRepository<Evidence, String> {
    List<Evidence> findBySessionIdOrderByCreatedAtDesc(String sessionId);
}
