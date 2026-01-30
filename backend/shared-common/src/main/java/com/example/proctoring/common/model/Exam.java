package com.example.proctoring.common.model;

import jakarta.persistence.*;

@Entity
@Table(name = "exams",
        indexes = {
                @Index(name = "idx_exams_tenant_schedule", columnList = "tenant_id, exam_schedule_id", unique = true)
        })
public class Exam {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "exam_schedule_id", nullable = false, length = 128)
    private String examScheduleId;

    @Column(name = "name", length = 256)
    private String name;

    public Long getId() {
        return id;
    }

    public String getTenantId() {
        return tenantId;
    }

    public void setTenantId(String tenantId) {
        this.tenantId = tenantId;
    }

    public String getExamScheduleId() {
        return examScheduleId;
    }

    public void setExamScheduleId(String examScheduleId) {
        this.examScheduleId = examScheduleId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }
}

