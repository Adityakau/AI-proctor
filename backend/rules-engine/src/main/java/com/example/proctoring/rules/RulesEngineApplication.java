package com.example.proctoring.rules;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

@SpringBootApplication(scanBasePackages = {
        "com.example.proctoring.rules",
        "com.example.proctoring.common"
})
@EntityScan("com.example.proctoring.common.model")
@EnableJpaRepositories("com.example.proctoring.rules.repository")
public class RulesEngineApplication {
    public static void main(String[] args) {
        SpringApplication.run(RulesEngineApplication.class, args);
    }
}
