package com.example.proctoring.ingest.controller;

import com.example.proctoring.common.model.ProctoringSession;
import com.example.proctoring.ingest.service.SessionService;
import com.example.proctoring.security.JwtClaims;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/proctoring/sessions")
public class SessionController {

    private final SessionService sessionService;

    public SessionController(SessionService sessionService) {
        this.sessionService = sessionService;
    }

    @PostMapping("/start")
    public ResponseEntity<?> start(@org.springframework.security.core.annotation.AuthenticationPrincipal Jwt jwt,
            @RequestBody(required = false) Map<String, Object> body) {
        JwtClaims claims = JwtClaims.fromJwt(jwt);
        Map<String, Object> config = body != null ? body : Map.of();
        ProctoringSession session = sessionService.startSession(claims, config);
        return ResponseEntity.ok(Map.of("sessionId", session.getId(), "status", session.getStatus()));
    }

    @PostMapping("/end")
    public ResponseEntity<?> end(@org.springframework.security.core.annotation.AuthenticationPrincipal Jwt jwt) {
        JwtClaims claims = JwtClaims.fromJwt(jwt);
        ProctoringSession session = sessionService.endSession(claims);
        return ResponseEntity.ok(Map.of("sessionId", session.getId(), "status", session.getStatus()));
    }

    @PostMapping("/heartbeat")
    public ResponseEntity<?> heartbeat(@org.springframework.security.core.annotation.AuthenticationPrincipal Jwt jwt) {
        JwtClaims claims = JwtClaims.fromJwt(jwt);
        ProctoringSession session = sessionService.heartbeat(claims);
        return ResponseEntity
                .ok(Map.of("sessionId", session.getId(), "lastHeartbeat", session.getLastHeartbeatAt().toString()));
    }
}
