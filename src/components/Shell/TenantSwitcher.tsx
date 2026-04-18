"use client";
import React from 'react';
import { Select, Space } from 'antd';
import { useTenant } from '@/context/TenantContext';

export const TenantSwitcher = () => {
    const { tenant, tenants, setTenant, isLoading } = useTenant();

    if (tenants.length <= 1) {
        return null;
    }

    return (
        <Space>
            <span style={{ opacity: 0.7, fontSize: 13 }}>Tenant:</span>
            <Select
                value={tenant ? tenant.id : undefined}
                onChange={(value) => {
                    const selected = tenants.find((t) => t.id === value);
                    if (selected) setTenant(selected);
                }}
                style={{ width: 140 }}
                placeholder={isLoading ? "Loading..." : "Select Tenant"}
                options={tenants.map(t => ({ label: t.name, value: t.id }))}
                loading={isLoading}
            />
        </Space>
    );
};
