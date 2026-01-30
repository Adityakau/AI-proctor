package com.example.proctoring.common.model;

import jakarta.persistence.*;

@Entity
@Table(name = "candidates",
        indexes = {
                @Index(name = "idx_candidates_tenant_user", columnList = "tenant_id, external_user_id", unique = true)
        })
public class Candidate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "external_user_id", nullable = false, length = 128)
    private String externalUserId;

    @Column(name = "full_name", length = 256)
    private String fullName;

    public Long getId() {
        return id;
    }

    public String getTenantId() {
        return tenantId;
    }

    public void setTenantId(String tenantId) {
        this.tenantId = tenantId;
    }

    public String getExternalUserId() {
        return externalUserId;
    }

    public void setExternalUserId(String externalUserId) {
        this.externalUserId = externalUserId;
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }
}

