package com.example.proctoring.rules.service;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;

@Service
public class SlidingWindowService {

    private final StringRedisTemplate redisTemplate;

    public SlidingWindowService(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    public void addEvent(String sessionId, String type, Instant timestamp) {
        String key = windowKey(sessionId, type);
        double score = timestamp.toEpochMilli();
        redisTemplate.opsForZSet().add(key, String.valueOf(score), score);
        redisTemplate.expire(key, Duration.ofHours(4));
    }

    public long countEventsInWindow(String sessionId, String type, Instant from, Instant to) {
        String key = windowKey(sessionId, type);
        Long count = redisTemplate.opsForZSet().count(key, (double) from.toEpochMilli(), (double) to.toEpochMilli());
        return count != null ? count : 0L;
    }

    public void trimOlderThan(String sessionId, String type, Instant cutoff) {
        String key = windowKey(sessionId, type);
        redisTemplate.opsForZSet().removeRangeByScore(key, 0, cutoff.toEpochMilli());
    }

    private String windowKey(String sessionId, String type) {
        return "sw:" + sessionId + ":" + type;
    }
}

