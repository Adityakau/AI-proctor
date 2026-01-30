package com.example.proctoring.dashboard;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

@SpringBootApplication(scanBasePackages = {
        "com.example.proctoring.dashboard",
        "com.example.proctoring.security",
        "com.example.proctoring.common"
})
@EntityScan("com.example.proctoring.common.model")
@EnableJpaRepositories("com.example.proctoring.dashboard.repository")
public class DashboardApiApplication {
    public static void main(String[] args) {
        SpringApplication.run(DashboardApiApplication.class, args);
    }
}
