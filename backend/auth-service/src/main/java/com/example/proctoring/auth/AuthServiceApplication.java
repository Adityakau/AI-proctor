package com.example.proctoring.auth;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

@SpringBootApplication(scanBasePackages = {
        "com.example.proctoring.auth",
        "com.example.proctoring.security",
        "com.example.proctoring.common"
})
@EntityScan("com.example.proctoring.common.model")
@EnableJpaRepositories("com.example.proctoring.auth.repository")
public class AuthServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(AuthServiceApplication.class, args);
    }
}
