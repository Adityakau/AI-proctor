package com.example.proctoring.ingest.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.core.io.Resource;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.KeyFactory;
import java.security.interfaces.RSAPrivateKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.Map;

import io.jsonwebtoken.Jwts;

/**
 * DEV-ONLY controller for generating test JWTs.
 * Only enabled when Spring profile "local" or "docker" is active.
 */
@RestController
@RequestMapping("/proctoring/dev")
@Profile({ "local", "docker" })
public class DevTokenController {

    @Value("${jwt.private-key-location:classpath:jwt-private.pem}")
    private Resource privateKeyLocation;

    @PostMapping("/token")
    public ResponseEntity<Map<String, String>> generateToken(@RequestBody TokenRequest request) {
        try {
            RSAPrivateKey privateKey = loadPrivateKey();

            Instant now = Instant.now();
            Instant exp = now.plusSeconds(3600); // 1 hour

            String token = Jwts.builder()
                    .claim("tenant_id", request.tenantId != null ? request.tenantId : "dev-tenant")
                    .claim("exam_schedule_id", request.examScheduleId != null ? request.examScheduleId : "dev-exam")
                    .claim("user_id",
                            request.userId != null ? request.userId : "dev-user-" + System.currentTimeMillis())
                    .claim("attempt_no", request.attemptNo != null ? request.attemptNo : 1)
                    .issuedAt(Date.from(now))
                    .expiration(Date.from(exp))
                    .signWith(privateKey, Jwts.SIG.RS256)
                    .compact();

            return ResponseEntity.ok(Map.of(
                    "token", token,
                    "expiresAt", exp.toString()));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Failed to generate token: " + e.getMessage()));
        }
    }

    private RSAPrivateKey loadPrivateKey() throws Exception {
        String pem = new String(privateKeyLocation.getInputStream().readAllBytes());
        String privateKeyContent = pem
                .replace("-----BEGIN PRIVATE KEY-----", "")
                .replace("-----END PRIVATE KEY-----", "")
                .replace("-----BEGIN RSA PRIVATE KEY-----", "")
                .replace("-----END RSA PRIVATE KEY-----", "")
                .replaceAll("\\s", "");
        byte[] keyBytes = Base64.getDecoder().decode(privateKeyContent);
        PKCS8EncodedKeySpec spec = new PKCS8EncodedKeySpec(keyBytes);
        KeyFactory factory = KeyFactory.getInstance("RSA");
        return (RSAPrivateKey) factory.generatePrivate(spec);
    }

    public static class TokenRequest {
        public String tenantId;
        public String examScheduleId;
        public String userId;
        public Integer attemptNo;
    }
}
