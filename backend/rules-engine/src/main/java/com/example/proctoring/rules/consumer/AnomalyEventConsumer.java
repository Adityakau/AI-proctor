package com.example.proctoring.rules.consumer;

import com.example.proctoring.common.kafka.AnomalyEventMessage;
import com.example.proctoring.rules.service.RulesEvaluationService;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
public class AnomalyEventConsumer {

    private final RulesEvaluationService rulesEvaluationService;

    public AnomalyEventConsumer(RulesEvaluationService rulesEvaluationService) {
        this.rulesEvaluationService = rulesEvaluationService;
    }

    @KafkaListener(
            topics = "${proctoring.events.topic:proctoring.anomaly.events}",
            groupId = "rules-engine",
            containerFactory = "anomalyEventKafkaListenerContainerFactory"
    )
    public void onMessage(AnomalyEventMessage message) {
        rulesEvaluationService.handleEvent(message);
    }
}

