"use client";
import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Form, Input, Select, Space, Popconfirm, message, Modal, Tooltip } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { brandingConfig } from '@/branding.config';

interface Aggregator {
    id: number;
    name: string;
    description: string;
    aggregator_name: string;
    base_url: string;
    api_key_masked: string;
    api_key_hash: string;
    status: string;
    created_at: string;
}

export default function AggregatorsPage() {
    const [aggregators, setAggregators] = useState<Aggregator[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isBaseModalOpen, setIsBaseModalOpen] = useState(false);
    const [form] = Form.useForm();
    const [baseForm] = Form.useForm();
    const [editingAggregator, setEditingAggregator] = useState<Aggregator | null>(null);
    const [baseAggregators, setBaseAggregators] = useState<any[]>([]);

    const [searchText, setSearchText] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    const fetchAggregators = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/orion/aggregators');
            if (res.ok) {
                const data = await res.json();
                setAggregators(data);
            } else {
                if (res.status === 403) {
                    message.error("Root access required to view aggregators.");
                } else {
                    message.error("Failed to load aggregators.");
                }
            }
        } catch (e) {
            console.error(e);
            message.error("Error fetching aggregators.");
        }
        setLoading(false);
    };

    const fetchBaseAggregators = async () => {
        try {
            const res = await fetch('/api/orion/aggregators-base');
            if (res.ok) {
                const data = await res.json();
                setBaseAggregators(data.filter((a: any) => a.status === 'ACTIVE'));
            }
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        fetchAggregators();
        fetchBaseAggregators();
    }, []);

    const handleSave = async (values: any) => {
        try {
            const method = editingAggregator ? 'PUT' : 'POST';
            const payload = editingAggregator ? { _identifiers: { id: editingAggregator.id }, ...values } : values;

            const res = await fetch('/api/orion/aggregators', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                message.success(`Aggregator API Key ${editingAggregator ? 'updated' : 'added'} successfully`);
                setIsModalOpen(false);
                fetchAggregators();
            } else {
                const err = await res.json();
                message.error(err.error || "Failed to save aggregator");
            }
        } catch (e) {
            console.error(e);
            message.error("Error saving aggregator");
        }
    };

    const handleBaseSave = async (values: any) => {
        try {
            const res = await fetch('/api/orion/aggregators-base', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values)
            });

            if (res.ok) {
                message.success('Aggregator Provider added successfully');
                setIsBaseModalOpen(false);
                fetchBaseAggregators();
            } else {
                const err = await res.json();
                message.error(err.error || "Failed to add aggregator provider");
            }
        } catch (e) {
            console.error(e);
            message.error("Error saving aggregator provider");
        }
    };

    const handleDelete = async (id: number) => {
        try {
            const res = await fetch('/api/orion/aggregators', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });

            if (res.ok) {
                message.success('Aggregator deleted');
                fetchAggregators();
            } else {
                const err = await res.json();
                message.error(err.error || "Failed to delete aggregator");
            }
        } catch (e) {
            console.error(e);
            message.error("Error deleting aggregator");
        }
    };

    const columns = [
        { title: 'Name', dataIndex: 'name', key: 'name' },
        { title: 'Aggregator', dataIndex: 'aggregator_name', key: 'aggregator_name' },
        { title: 'Description', dataIndex: 'description', key: 'description' },
        { title: 'Base URL', dataIndex: 'base_url', key: 'base_url' },
        { title: 'API Key', dataIndex: 'api_key_masked', key: 'api_key_masked', render: (text: string) => <span style={{ fontFamily: 'monospace' }}>{text}</span> },
        { title: 'Key Hash', dataIndex: 'api_key_hash', key: 'api_key_hash', render: (text: string) => <span style={{ fontFamily: 'monospace', fontSize: 10 }} title={text}>{text?.substring(0, 10)}...</span> },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => (
                <span style={{
                    color: status === 'ACTIVE' ? '#10b981' : '#ef4444',
                    border: `1px solid ${status === 'ACTIVE' ? '#10b981' : '#ef4444'}`,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '0.8rem'
                }}>
                    {status}
                </span>
            )
        },
        { title: 'Created (UTC)', dataIndex: 'created_at', key: 'created_at', render: (date: string) => new Date(date).toUTCString() },
        {
            title: 'Actions',
            key: 'actions',
            render: (_: any, record: Aggregator) => (
                <Space size="middle">
                    <Button type="text" icon={<EditOutlined style={{ color: brandingConfig.theme.primaryColor }} />} onClick={() => {
                        setEditingAggregator(record);
                        form.setFieldsValue({
                            ...record,
                            api_key: '' // Empty so it's not pre-filled
                        });
                        setIsModalOpen(true);
                    }} />
                    <Popconfirm title="Delete this API key?" onConfirm={() => handleDelete(record.id)}>
                        <Button type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    const filteredData = aggregators.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchText.toLowerCase()) || item.aggregator_name.toLowerCase().includes(searchText.toLowerCase());
        const matchesStatus = statusFilter ? item.status === statusFilter : true;
        return matchesSearch && matchesStatus;
    });

    return (
        <Space direction="vertical" style={{ width: '100%', marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1 style={{ margin: 0 }}>Aggregator Management</h1>
                <Space>
                    <Button
                        type="default"
                        onClick={() => {
                            baseForm.resetFields();
                            setIsBaseModalOpen(true);
                        }}
                    >
                        Add Aggregator
                    </Button>
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => {
                            setEditingAggregator(null);
                            form.resetFields();
                            setIsModalOpen(true);
                        }}
                        style={{ backgroundColor: brandingConfig.theme.primaryColor }}
                    >
                        Add Aggregator Account
                    </Button>
                </Space>
            </div>

            <Card style={{ backgroundColor: brandingConfig.theme.componentBg }}>
                <Space style={{ marginBottom: 16 }}>
                    <Input.Search
                        placeholder="Search by name or aggregator..."
                        style={{ width: 300 }}
                        onChange={(e) => setSearchText(e.target.value)}
                        allowClear
                    />
                    <Select
                        placeholder="Filter by Status"
                        style={{ width: 150 }}
                        allowClear
                        onChange={setStatusFilter}
                        options={[
                            { label: 'Active', value: 'ACTIVE' },
                            { label: 'Inactive', value: 'INACTIVE' }
                        ]}
                    />
                </Space>

                <Table
                    columns={columns}
                    dataSource={filteredData}
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 10 }}
                />
            </Card>

            <Modal
                title={editingAggregator ? "Edit Aggregator Account" : "Add Aggregator Account"}
                open={isModalOpen}
                onCancel={() => {
                    setIsModalOpen(false);
                    form.resetFields();
                }}
                onOk={() => form.submit()}
                okButtonProps={{ style: { backgroundColor: brandingConfig.theme.primaryColor } }}
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSave}
                >
                    <Form.Item
                        name="name"
                        label="Name"
                        rules={[{ required: true, message: 'Please enter a name for this configuration' }]}
                    >
                        <Input />
                    </Form.Item>

                    <Form.Item
                        name="aggregator_id"
                        label="Aggregator Platform"
                        rules={[{ required: true, message: 'Please select an aggregator platform' }]}
                    >
                        <Select
                            options={baseAggregators.map(a => ({ label: a.name, value: a.id }))}
                        />
                    </Form.Item>

                    <Form.Item name="description" label="Description">
                        <Input.TextArea rows={2} />
                    </Form.Item>

                    <Form.Item name="base_url" label="Base URL">
                        <Input placeholder="e.g., https://api.telna.com/v1" />
                    </Form.Item>

                    <Form.Item
                        name="api_key"
                        label={
                            <span>
                                API Key &nbsp;
                                <Tooltip title="API key is securely stored as a one-way Hash and cannot be viewed after saving. Only the last 4 characters will be visible as a masked snippet.">
                                    <InfoCircleOutlined />
                                </Tooltip>
                            </span>
                        }
                        rules={[{ required: !editingAggregator, message: 'API key is required' }]}
                        help={editingAggregator ? "Leave empty to keep existing key, or enter a new one to replace." : undefined}
                    >
                        <Input.Password placeholder="Paste API key here" autoComplete="new-password" />
                    </Form.Item>

                    <Form.Item
                        name="status"
                        label="Status"
                        initialValue="ACTIVE"
                    >
                        <Select
                            options={[
                                { label: 'Active', value: 'ACTIVE' },
                                { label: 'Inactive', value: 'INACTIVE' }
                            ]}
                        />
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                title="Add New Aggregator"
                open={isBaseModalOpen}
                onCancel={() => {
                    setIsBaseModalOpen(false);
                    baseForm.resetFields();
                }}
                onOk={() => baseForm.submit()}
                okButtonProps={{ style: { backgroundColor: brandingConfig.theme.primaryColor } }}
            >
                <Form
                    form={baseForm}
                    layout="vertical"
                    onFinish={handleBaseSave}
                >
                    <Form.Item
                        name="name"
                        label="Aggregator Name"
                        rules={[{ required: true, message: 'Please enter aggregator name' }]}
                    >
                        <Input placeholder="e.g., Telna, Tata" />
                    </Form.Item>
                    <Form.Item name="contact_name" label="Contact Name">
                        <Input />
                    </Form.Item>
                    <Form.Item name="contact_email" label="Contact Email">
                        <Input type="email" />
                    </Form.Item>
                    <Form.Item name="contact_phone" label="Contact Phone">
                        <Input />
                    </Form.Item>
                </Form>
            </Modal>
        </Space>
    );
}
