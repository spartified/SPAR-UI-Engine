"use client";
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Card, Table, Button, Select, Space, Tag, message, Modal, Spin, Typography } from 'antd';
import { SyncOutlined, EyeOutlined, LeftOutlined } from '@ant-design/icons';
import { brandingConfig } from '@/branding.config';

const { Title, Text } = Typography;

interface InventoryItem {
    id: string;
    name: string;
    created_date: string;
    modified_date: string;
    status: string;
    aggregator_name: string;
    is_synced?: boolean;
}

export default function OrionInventoryPage() {
    const [aggregators, setAggregators] = useState<any[]>([]);
    const [selectedAggregator, setSelectedAggregator] = useState<number | null>(null);
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(false);

    // Details Modal State
    const [detailsVisible, setDetailsVisible] = useState(false);
    const [selectedInventory, setSelectedInventory] = useState<InventoryItem | null>(null);
    const [simData, setSimData] = useState<any[]>([]);
    const [detailsLoading, setDetailsLoading] = useState(false);

    // Fetch Aggregator Accounts
    useEffect(() => {
        const fetchAggs = async () => {
            try {
                const res = await fetch('/api/orion/aggregators');
                const data = await res.json();
                if (Array.isArray(data)) {
                    setAggregators(data.filter(a => a.status === 'ACTIVE'));
                }
            } catch (error) {
                console.error("Failed to fetch aggregators:", error);
            }
        };
        fetchAggs();
    }, []);

    // Fetch Remote Inventory from Aggregator
    const fetchRemoteInventory = async (aggregatorId: number) => {
        setLoading(true);
        try {
            // Call our new backend proxy
            const res = await fetch(`/api/orion/inventory/fetch?aggregatorId=${aggregatorId}`);
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to fetch from aggregator");
            }

            const rawData = await res.json();

            // Telna API returns { total, inventories: [...] } with Unix ms timestamps
            const remoteItems = rawData.inventories || rawData.data || (Array.isArray(rawData) ? rawData : []);

            const mockRemote = remoteItems.map((item: any) => ({
                id: String(item.id || item.inventory_id),
                name: item.name || item.inventory_name || `Batch ${item.id}`,
                // Telna returns timestamps as Unix milliseconds
                created_date: item.created_date
                    ? new Date(Number(item.created_date)).toISOString()
                    : new Date().toISOString(),
                modified_date: item.modified_date
                    ? new Date(Number(item.modified_date)).toISOString()
                    : new Date().toISOString(),
                status: item.status || 'Active',
                aggregator_name: 'Telna',
            }));

            // Check sync status with local DB
            if (mockRemote.length > 0) {
                const ids = mockRemote.map((i: any) => i.id).join(',');
                const statusRes = await fetch(`/api/orion/inventory/status?ids=${ids}`);
                const { syncedIds } = await statusRes.json();

                const enriched = mockRemote.map((item: any) => ({
                    ...item,
                    is_synced: (syncedIds || []).includes(item.id)
                }));
                setInventory(enriched);
            } else {
                setInventory([]);
            }
        } catch (error: any) {
            message.error(error.message || "Failed to fetch remote inventory");
            setInventory([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (selectedAggregator) {
            fetchRemoteInventory(selectedAggregator);
        } else {
            setInventory([]);
        }
    }, [selectedAggregator]);

    const handleSync = useCallback(async (record: InventoryItem) => {
        setLoading(true);
        try {
            // 1. Fetch SIMs for this inventory (Mock)
            const mockSims = Array.from({ length: 5 }).map((_, i) => ({
                iccid: `8900000000000${record.id.split('-').pop()}${i}`,
                mapped_imsi: `2040400000000${i}`,
                sim_status: 'active',
                sim_type: 'eSIM'
            }));

            // 2. Call Sync API
            const res = await fetch('/api/orion/inventory/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    inventory: record,
                    sims: mockSims,
                    aggregator_id: selectedAggregator
                })
            });

            if (res.ok) {
                message.success(`Successfully synced ${record.id} and its SIMs!`);
                setInventory(prev => prev.map(item => item.id === record.id ? { ...item, is_synced: true } : item));
            } else {
                const err = await res.json();
                message.error(err.error || "Sync failed");
            }
        } catch (error) {
            message.error("Sync process failed");
        } finally {
            setLoading(false);
        }
    }, [selectedAggregator]);

    const showDetails = useCallback(async (record: InventoryItem) => {
        if (!record) return;
        message.loading({ content: 'Fetching SIM details...', key: 'sim_loading' });
        setSelectedInventory(record);
        setSimData([]); // Reset previous data
        setDetailsVisible(true);
        setDetailsLoading(true);
        try {
            // Mocking the SIM list for the drill-down
            const mockSims = Array.from({ length: 5 }).map((_, i) => ({
                iccid: `8900000000000${record.id.split('-').pop()}${i}`,
                mapped_imsi: `2040400000000${i}`,
                sim_status: 'Active',
                sim_type: 'eSIM',
                inventory: record.id,
                created_date: record.created_date,
                modified_date: record.modified_date
            }));
            setSimData(mockSims);
            message.success({ content: 'Details loaded', key: 'sim_loading', duration: 1 });
        } catch (e) {
            message.error({ content: 'Failed to load details', key: 'sim_loading' });
            setDetailsVisible(false);
        } finally {
            setDetailsLoading(false);
        }
    }, []);

    const columns = useMemo(() => [
        {
            title: 'Inventory ID',
            dataIndex: 'id',
            key: 'id',
            render: (id: string, record: InventoryItem) => (
                <Typography.Link onClick={(e) => {
                    e.preventDefault();
                    showDetails(record);
                }}>
                    {id}
                </Typography.Link>
            )
        },
        { title: 'Name', dataIndex: 'name', key: 'name' },
        {
            title: 'Created (UTC)',
            dataIndex: 'created_date',
            key: 'created_date',
            render: (date: string) => new Date(date).toUTCString()
        },
        {
            title: 'Modified (UTC)',
            dataIndex: 'modified_date',
            key: 'modified_date',
            render: (date: string) => new Date(date).toUTCString()
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => (
                <Tag color={status === 'Active' ? 'green' : 'gray'}>{status.toUpperCase()}</Tag>
            )
        },
        {
            title: 'Sync Status',
            key: 'sync_status',
            render: (_: any, record: InventoryItem) => (
                record.is_synced ? (
                    <Tag color="cyan">SYNCED</Tag>
                ) : (
                    <Button
                        type="primary"
                        size="small"
                        icon={<SyncOutlined />}
                        onClick={() => handleSync(record)}
                        style={{ backgroundColor: brandingConfig.theme.primaryColor }}
                    >
                        Sync Now
                    </Button>
                )
            )
        }
    ], [handleSync, showDetails]);

    const simColumns = useMemo(() => [
        { title: 'ICCID', dataIndex: 'iccid', key: 'iccid' },
        { title: 'IMSI', dataIndex: 'mapped_imsi', key: 'mapped_imsi' },
        { title: 'Type', dataIndex: 'sim_type', key: 'sim_type' },
        { title: 'Status', dataIndex: 'sim_status', key: 'sim_status' },
        { title: 'Created (UTC)', dataIndex: 'created_date', key: 'created_date', render: (d: string) => new Date(d).toUTCString() },
    ], []);

    return (
        <div style={{ padding: 24 }}>
            <Title level={2} style={{ marginBottom: 24 }}>eSIM Inventory Management</Title>

            <Card style={{ marginBottom: 24, background: brandingConfig.theme.componentBg }}>
                <Space direction="vertical" style={{ width: '100%' }}>
                    <Text strong style={{ color: brandingConfig.theme.textColor }}>Select Aggregator Account:</Text>
                    <Select
                        style={{ width: 400 }}
                        placeholder="Choose an aggregator to fetch inventory..."
                        onChange={(val) => setSelectedAggregator(val)}
                        options={aggregators.map(a => ({ label: a.name, value: a.id }))}
                    />
                </Space>
            </Card>

            <Card style={{ background: brandingConfig.theme.componentBg }}>
                <Table
                    columns={columns}
                    dataSource={inventory}
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 10 }}
                    locale={{ emptyText: selectedAggregator ? "No inventory found for this aggregator" : "Please select an aggregator account first" }}
                />
            </Card>

            <Modal
                title={`SIM Details - ${selectedInventory?.id}`}
                open={detailsVisible}
                onCancel={() => setDetailsVisible(false)}
                footer={null}
                width={1000}
            >
                <Table
                    columns={simColumns}
                    dataSource={simData}
                    rowKey="iccid"
                    loading={detailsLoading}
                    pagination={{ pageSize: 5 }}
                />
            </Modal>
        </div>
    );
}
