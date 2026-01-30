package com.example.proctoring;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class ProctoringApplication {

    public static void main(String[] args) {
        SpringApplication.run(ProctoringApplication.class, args);
    }
}
