package com.example.proctoring.ingest;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

@SpringBootApplication(scanBasePackages = {
        "com.example.proctoring.ingest",
        "com.example.proctoring.security",
        "com.example.proctoring.common"
})
@EntityScan("com.example.proctoring.common.model")
@EnableJpaRepositories("com.example.proctoring.ingest.repository")
public class EventIngestApplication {
    public static void main(String[] args) {
        SpringApplication.run(EventIngestApplication.class, args);
    }
}
