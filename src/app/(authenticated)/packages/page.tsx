"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Button, Card, Space, Tag, Typography, message, Tooltip, Breadcrumb } from 'antd';
import { PlusOutlined, ReloadOutlined, DeleteOutlined, CheckCircleOutlined, SyncOutlined, ExclamationCircleOutlined, GiftOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { TableRenderer } from '@/components/Engines/TableRenderer';

const { Title, Text } = Typography;

export default function PackageManagementPage() {
    const router = useRouter();
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchPackages = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/orion/packages');
            const result = await res.json();
            if (res.ok) {
                setData(result);
            } else {
                message.error(result.error || "Failed to fetch packages");
            }
        } catch (error) {
            message.error("Network error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPackages();
    }, []);

    const columns = useMemo(() => [
        {
            title: 'Package Name',
            dataIndex: 'name',
            key: 'name',
            render: (text: string) => <Text strong><GiftOutlined style={{ marginRight: 8, color: '#1890ff' }} />{text}</Text>
        },
        {
            title: 'Account',
            dataIndex: 'account_name',
            key: 'account_name',
            render: (text: string) => text ? <Tag color="orange">{text}</Tag> : <Tag color="default">Global</Tag>
        },
        {
            title: 'Remote ID',
            dataIndex: 'remote_id',
            key: 'remote_id',
            render: (id: string) => id ? <Tag color="blue">{id}</Tag> : <Tag color="default">N/A</Tag>
        },
        {
            title: 'Quotas',
            key: 'quotas',
            render: (_: any, record: any) => (
                <Space direction="vertical">
                    <Text>Data: {record.data_limit_mb} MB</Text>
                    <Text>Duration: {Math.ceil(record.duration_seconds / 86400)} Days</Text>
                </Space>
            )
        },
        {
            title: 'Coverage',
            dataIndex: 'supported_countries',
            key: 'supported_countries',
            render: (countries: string[]) => {
                const list = Array.isArray(countries) ? countries : [];
                if (list.length === 0) return <Tag color="default">Global / None</Tag>;
                return (
                    <Tooltip title={list.join(', ')}>
                        <Tag color="cyan">{list.length} Countries</Tag>
                    </Tooltip>
                );
            }
        },
        {
            title: 'Sync Status',
            dataIndex: 'sync_status',
            key: 'sync_status',
            render: (status: string) => {
                switch (status) {
                    case 'IN_SYNC':
                        return <Tag icon={<CheckCircleOutlined />} color="success">In Sync</Tag>;
                    case 'OUT_OF_SYNC':
                        return <Tag icon={<SyncOutlined spin />} color="processing">Out of Sync</Tag>;
                    case 'FAILED':
                        return <Tag icon={<ExclamationCircleOutlined />} color="error">Failed</Tag>;
                    default:
                        return <Tag>{status}</Tag>;
                }
            }
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => (
                <Tag color={status === 'ACTIVE' ? 'green' : 'red'}>{status}</Tag>
            )
        },
        {
            title: 'Created At',
            dataIndex: 'created_at',
            key: 'created_at',
            render: (date: string) => new Date(date).toLocaleDateString()
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_: any, record: any) => (
                <Space>
                    <Tooltip title="Refresh Status">
                        <Button type="text" icon={<ReloadOutlined />} />
                    </Tooltip>
                    <Tooltip title="Delete">
                        <Button type="text" danger icon={<DeleteOutlined />} />
                    </Tooltip>
                </Space>
            )
        }
    ], []);

    return (
        <div style={{ padding: 24 }}>
            <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <Breadcrumb items={[
                        { title: 'Orion' },
                        { title: 'Packages' }
                    ]} />
                    <Title level={2} style={{ marginTop: 8 }}>Package Management</Title>
                    <Text type="secondary">Create and manage connectivity templates synchronized with Telna PCR.</Text>
                </div>
                <Space>
                    <Button icon={<ReloadOutlined />} onClick={fetchPackages}>Refresh</Button>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => router.push('/packages/create')}>
                        Create New Package
                    </Button>
                </Space>
            </div>

            <Card styles={{ body: { padding: 0 } }}>
                <TableRenderer
                    loading={loading}
                    columns={columns}
                    dataSource={data}
                    rowKey="id"
                />
            </Card>
        </div>
    );
}
