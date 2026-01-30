package com.example.proctoring.ingest.controller;

import com.example.proctoring.common.model.Evidence;
import com.example.proctoring.ingest.repository.EvidenceRepository;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.File;

@RestController
@RequestMapping("/proctoring/evidence")
public class EvidenceController {

    private final EvidenceRepository evidenceRepository;

    public EvidenceController(EvidenceRepository evidenceRepository) {
        this.evidenceRepository = evidenceRepository;
    }

    @GetMapping("/{evidenceId}")
    public ResponseEntity<Resource> getEvidence(@PathVariable("evidenceId") String evidenceId) {
        Evidence evidence = evidenceRepository.findById(evidenceId)
                .orElse(null);

        if (evidence == null) {
            return ResponseEntity.notFound().build();
        }

        File file = new File(evidence.getFilePath());
        if (!file.exists()) {
            return ResponseEntity.notFound().build();
        }

        Resource resource = new FileSystemResource(file);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(evidence.getMimeType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + file.getName() + "\"")
                .body(resource);
    }
}
