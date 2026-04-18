"use client";

import React, { useState, useEffect } from 'react';
import { Form, Input, InputNumber, Select, Button, Card, Steps, theme, Typography, Space, message, Divider, Alert, DatePicker } from 'antd';
import {
    InfoCircleOutlined,
    DatabaseOutlined,
    GlobalOutlined,
    LeftOutlined,
    RightOutlined,
    CheckOutlined,
    GiftOutlined
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

export default function CreatePackagePage() {
    const router = useRouter();
    const [current, setCurrent] = useState(0);
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [aggregators, setAggregators] = useState<any[]>([]);
    const [accounts, setAccounts] = useState<any[]>([]);
    const [countries, setCountries] = useState<any[]>([]);
    const [fetchingInitialData, setFetchingInitialData] = useState(true);

    const { token } = theme.useToken();

    useEffect(() => {
        const fetchMetadata = async () => {
            try {
                const [aggRes, accRes, countryRes] = await Promise.all([
                    fetch('/api/orion/aggregators'),
                    fetch('/api/orion/accounts'),
                    fetch('/api/orion/aggregators-base?action=countries')
                ]);

                if (aggRes.ok) setAggregators(await aggRes.json());
                if (accRes.ok) setAccounts(await accRes.json());
                if (countryRes.ok) {
                    const cData = await countryRes.json();
                    setCountries(cData.countries || cData || []);
                }
            } catch (error) {
                console.error("Metadata fetch failed", error);
            } finally {
                setFetchingInitialData(false);
            }
        };
        fetchMetadata();
    }, []);

    const next = async () => {
        try {
            const stepFields: Record<number, string[]> = {
                0: ['account_id', 'name', 'aggregator_account_id'],
                1: ['data_limit_mb', 'duration_days', 'earliest_available_date', 'latest_available_date'],
                2: ['supported_countries', 'traffic_policy']
            };
            await form.validateFields(stepFields[current]);
            setCurrent(current + 1);
        } catch (error) {
            console.error("Validation failed", error);
        }
    };

    const prev = () => {
        setCurrent(current - 1);
    };

    const onFinish = async (values: any) => {
        setLoading(true);
        try {
            // Convert dayjs dates to timestamps if needed
            const payload = {
                ...values,
                duration_seconds: (values.duration_days || 30) * 86400,
                earliest_available_date: values.earliest_available_date ? values.earliest_available_date.unix() : null,
                latest_available_date: values.latest_available_date ? values.latest_available_date.unix() : null,
            };

            const res = await fetch('/api/orion/packages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await res.json();
            if (res.ok) {
                message.success("Package created successfully!");
                router.push('/packages');
            } else {
                message.error(result.error || "Creation failed");
            }
        } catch (error) {
            message.error("Network error");
        } finally {
            setLoading(false);
        }
    };

    const steps = [
        {
            title: 'Basics',
            icon: <InfoCircleOutlined />,
            content: (
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                    <Form.Item
                        name="account_id"
                        label="Account"
                        rules={[{ required: true, message: 'Select a client account' }]}
                    >
                        <Select
                            placeholder="Select client"
                            size="large"
                            showSearch
                            optionFilterProp="label"
                            options={accounts.map(a => ({ label: a.name, value: a.id }))}
                            loading={fetchingInitialData}
                        />
                    </Form.Item>
                    <Form.Item
                        name="name"
                        label="Template Name"
                        rules={[{ required: true, message: 'Please enter a package name' }]}
                    >
                        <Input placeholder="e.g. Global 5GB Monthly" size="large" />
                    </Form.Item>
                    <Form.Item
                        name="aggregator_account_id"
                        label="Aggregator Account"
                        rules={[{ required: true, message: 'Select an aggregator' }]}
                    >
                        <Select
                            placeholder="Select aggregator"
                            size="large"
                            options={aggregators.map(a => ({ label: a.name, value: a.id }))}
                            loading={fetchingInitialData}
                            onChange={async (val) => {
                                try {
                                    setFetchingInitialData(true);
                                    const res = await fetch(`/api/orion/aggregators-base?action=countries&aggregator_id=${val}`);
                                    if (res.ok) {
                                        const cData = await res.json();
                                        setCountries(cData.countries || cData || []);
                                    } else {
                                        const errorData = await res.json();
                                        message.error(errorData.error || "Failed to fetch countries for this aggregator");
                                        setCountries([]);
                                    }
                                } catch (e) {
                                    console.error("Failed to fetch countries for aggregator", e);
                                } finally {
                                    setFetchingInitialData(false);
                                }
                            }}
                        />
                    </Form.Item>
                </Space>
            ),
        },
        {
            title: 'Quotas',
            icon: <DatabaseOutlined />,
            content: (
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                    <Form.Item
                        name="data_limit_mb"
                        label="Data Limit (MB)"
                        rules={[{ required: true, message: 'Enter data limit' }]}
                    >
                        <InputNumber style={{ width: '100%' }} min={1} placeholder="5048" size="large" />
                    </Form.Item>
                    <Form.Item
                        name="duration_days"
                        label="Duration (Days)"
                        initialValue={30}
                        rules={[{ required: true, message: 'Enter duration in days' }]}
                    >
                        <InputNumber style={{ width: '100%' }} min={1} placeholder="30" size="large" />
                    </Form.Item>
                    <div style={{ display: 'flex', gap: 16 }}>
                        <Form.Item
                            name="earliest_available_date"
                            label="Earliest Activation"
                            style={{ flex: 1 }}
                        >
                            <DatePicker style={{ width: '100%' }} size="large" />
                        </Form.Item>
                        <Form.Item
                            name="latest_available_date"
                            label="Latest Activation"
                            style={{ flex: 1 }}
                        >
                            <DatePicker style={{ width: '100%' }} size="large" />
                        </Form.Item>
                    </div>
                </Space>
            ),
        },
        {
            title: 'Policies',
            icon: <GlobalOutlined />,
            content: (
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                    <Form.Item
                        name="supported_countries"
                        label="Countries"
                    >
                        <Select
                            mode="multiple"
                            placeholder="Select target countries"
                            size="large"
                            loading={fetchingInitialData}
                            options={countries.map(c => ({ label: `${c.name} (${c.iso3 || c.iso_3 || c.code})`, value: c.iso3 || c.iso_3 || c.code }))}
                        />
                    </Form.Item>
                    <Form.Item
                        name="traffic_policy"
                        label="Traffic Policy ID"
                        initialValue={1053}
                    >
                        <InputNumber style={{ width: '100%' }} min={1} size="large" />
                    </Form.Item>
                    <Alert
                        message="API Synchronization"
                        description="Clicking 'Create' will persist this template locally and attempt to sync it with the Telna PCR API immediately."
                        type="info"
                        showIcon
                    />
                </Space>
            ),
        },
    ];

    const items = steps.map((item) => ({ key: item.title, title: item.title, icon: item.icon }));

    return (
        <div style={{ padding: '40px 24px', maxWidth: 800, margin: '0 auto' }}>
            <Card>
                <div style={{ marginBottom: 32 }}>
                    <Title level={3}><GiftOutlined /> Create New Package Template</Title>
                    <Text type="secondary">Define connectivity quotas and policies for automated provisioning.</Text>
                </div>

                <Steps current={current} items={items} style={{ marginBottom: 40 }} />

                <Form
                    form={form}
                    layout="vertical"
                    onFinish={onFinish}
                    requiredMark="optional"
                    preserve={true}
                >
                    <div style={{ padding: '0 24px', minHeight: 300 }}>
                        {steps.map((step, idx) => (
                            <div key={idx} style={{ display: idx === current ? 'block' : 'none' }}>
                                {step.content}
                            </div>
                        ))}
                    </div>

                    <Divider />

                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 24px' }}>
                        <Button style={{ margin: '0 8px' }} onClick={() => current === 0 ? router.back() : prev()} icon={<LeftOutlined />}>
                            {current === 0 ? 'Cancel' : 'Previous'}
                        </Button>
                        <Space>
                            {current < steps.length - 1 && (
                                <Button type="primary" onClick={next} icon={<RightOutlined />} iconPosition="end">
                                    Next
                                </Button>
                            )}
                            {current === steps.length - 1 && (
                                <Button type="primary" htmlType="submit" loading={loading} icon={<CheckOutlined />}>
                                    Create Template & Sync
                                </Button>
                            )}
                        </Space>
                    </div>
                </Form>
            </Card>
        </div>
    );
}
