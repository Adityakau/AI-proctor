package com.example.proctoring.dashboard.service;

import com.example.proctoring.common.model.Alert;
import com.example.proctoring.common.model.Evidence;
import com.example.proctoring.common.model.ProctoringSession;
import com.example.proctoring.common.repository.AlertRepository;
import com.example.proctoring.common.repository.EvidenceRepository;
import com.example.proctoring.common.repository.ProctoringSessionRepository;
import com.example.proctoring.dashboard.contract.AlertSummaryItem;
import com.example.proctoring.dashboard.contract.DashboardSessionSummaryResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class DashboardSessionReadServiceTest {

    private DashboardSessionReadService service;

    @Mock
    private ProctoringSessionRepository sessionRepository;
    @Mock
    private AlertRepository alertRepository;
    @Mock
    private EvidenceRepository evidenceRepository;

    private ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        service = new DashboardSessionReadService(sessionRepository, alertRepository, evidenceRepository, objectMapper);
    }

    @Test
    @SuppressWarnings("unchecked")
    void testTrustScoreCalculation() {
        String sessionId = "s1";
        ProctoringSession session = new ProctoringSession();
        ReflectionTestUtils.setField(session, "id", sessionId);
        session.setTenantId("t1");
        session.setConfigSnapshotJson("{}");

        Alert alert1 = new Alert();
        alert1.setDetailsJson("{\"confidence\": 0.9}");
        alert1.setType("T1");
        
        Alert alert2 = new Alert();
        alert2.setDetailsJson("{\"confidence\": 0.7}");
        alert2.setType("T2");

        Alert alert3 = new Alert();
        alert3.setDetailsJson("{}"); // No confidence
        alert3.setType("T1");

        when(sessionRepository.findById(sessionId)).thenReturn(Optional.of(session));
        when(alertRepository.findBySessionIdOrderByCreatedAtDesc(sessionId)).thenReturn(List.of(alert1, alert2, alert3));
        when(evidenceRepository.findBySessionIdOrderByCreatedAtDesc(sessionId)).thenReturn(Collections.emptyList());

        Optional<DashboardSessionSummaryResponse> summary = service.getSessionSummary(sessionId, "t1");

        assertTrue(summary.isPresent());
        // (0.9 + 0.7) / 2 = 0.8 -> 80%
        assertEquals(80, summary.get().trustScorePercent());
    }

    @Test
    @SuppressWarnings("unchecked")
    void testAlertGrouping() {
        String sessionId = "s1";
        ProctoringSession session = new ProctoringSession();
        ReflectionTestUtils.setField(session, "id", sessionId);
        session.setTenantId("t1");
        session.setConfigSnapshotJson("{}");

        Alert alert1 = new Alert();
        alert1.setType("FACE_MISSING");
        Alert alert2 = new Alert();
        alert2.setType("FACE_MISSING");
        Alert alert3 = new Alert();
        alert3.setType("MULTIPLE_FACES");

        when(sessionRepository.findById(sessionId)).thenReturn(Optional.of(session));
        when(alertRepository.findBySessionIdOrderByCreatedAtDesc(sessionId)).thenReturn(List.of(alert1, alert2, alert3));
        when(evidenceRepository.findBySessionIdOrderByCreatedAtDesc(sessionId)).thenReturn(Collections.emptyList());

        Optional<DashboardSessionSummaryResponse> summary = service.getSessionSummary(sessionId, "t1");

        assertTrue(summary.isPresent());
        List<AlertSummaryItem> alerts = summary.get().alertSummary();
        assertEquals(2, alerts.size());
        assertTrue(alerts.stream().anyMatch(a -> a.alertType().equals("FACE_MISSING") && a.totalCount() == 2));
        assertTrue(alerts.stream().anyMatch(a -> a.alertType().equals("MULTIPLE_FACES") && a.totalCount() == 1));
    }

    @Test
    @SuppressWarnings("unchecked")
    void testEvidenceMapping() {
        String sessionId = "s1";
        ProctoringSession session = new ProctoringSession();
        ReflectionTestUtils.setField(session, "id", sessionId);
        session.setTenantId("t1");
        session.setConfigSnapshotJson("{}");

        Instant now = Instant.now();
        Alert alert = new Alert();
        alert.setSessionId(sessionId);
        alert.setType("EVIDENCE_TEST");
        ReflectionTestUtils.setField(alert, "createdAt", now);
        alert.setEvidenceId(null);

        Evidence evidence = new Evidence();
        String evidenceId = evidence.getId();
        ReflectionTestUtils.setField(evidence, "createdAt", now.minusSeconds(1));

        when(sessionRepository.findById(sessionId)).thenReturn(Optional.of(session));
        when(alertRepository.findBySessionIdOrderByCreatedAtDesc(sessionId)).thenReturn(List.of(alert));
        when(evidenceRepository.findBySessionIdOrderByCreatedAtDesc(sessionId)).thenReturn(List.of(evidence));

        service.getSessionSummary(sessionId, "t1");

        ArgumentCaptor<List<Alert>> alertCaptor = ArgumentCaptor.forClass(List.class);
        verify(alertRepository).saveAll(alertCaptor.capture());
        
        assertEquals(evidenceId, alertCaptor.getValue().get(0).getEvidenceId());
    }
}
