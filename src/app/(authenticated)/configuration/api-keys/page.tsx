"use client";
import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Tag, Modal, Input, message, Typography, Alert, Popconfirm } from 'antd';
import { KeyOutlined, CopyOutlined, DeleteOutlined, PlusOutlined, EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons';
import { brandingConfig } from '@/branding.config';

const { Title, Text, Paragraph } = Typography;

export default function APIKeysPage() {
    const [keys, setKeys] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [createModalVisible, setCreateModalVisible] = useState(false);
    const [newKeyName, setNewKeyName] = useState('');
    const [creating, setCreating] = useState(false);

    // Secret Key Display State
    const [generatedKey, setGeneratedKey] = useState<string | null>(null);
    const [secretModalVisible, setSecretModalVisible] = useState(false);

    const fetchKeys = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/api-keys');
            const result = await res.json();
            if (res.ok) {
                setKeys(result.data || []);
            } else {
                message.error(result.error || "Failed to fetch keys");
            }
        } catch (e) {
            message.error("Network error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchKeys();
    }, []);

    const handleCreate = async () => {
        if (!newKeyName) {
            message.warning("Please enter a name for the key");
            return;
        }
        setCreating(true);
        try {
            const res = await fetch('/api/api-keys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newKeyName })
            });
            const result = await res.json();
            if (res.ok) {
                setGeneratedKey(result.apiKey);
                setSecretModalVisible(true);
                setCreateModalVisible(false);
                setNewKeyName('');
                fetchKeys();
            } else {
                message.error(result.error || "Failed to create key");
            }
        } catch (e) {
            message.error("Network error");
        } finally {
            setCreating(false);
        }
    };

    const handleDelete = async (id: number) => {
        try {
            const res = await fetch(`/api/api-keys/${id}`, { method: 'DELETE' });
            if (res.ok) {
                message.success("API Key deleted");
                fetchKeys();
            } else {
                const err = await res.json();
                message.error(err.error || "Failed to delete");
            }
        } catch (e) {
            message.error("Network error");
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        message.success("Copied to clipboard!");
    };

    const columns = [
        {
            title: 'Name',
            dataIndex: 'name',
            key: 'name',
            render: (text: string) => <Text strong>{text}</Text>
        },
        {
            title: 'Prefix',
            dataIndex: 'prefix',
            key: 'prefix',
            render: (text: string) => <Text code>{text}</Text>
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => (
                <Tag color={status === 'active' ? 'green' : 'red'}>{status.toUpperCase()}</Tag>
            )
        },
        {
            title: 'Created At',
            dataIndex: 'created_at',
            key: 'created_at',
            render: (date: string) => new Date(date).toLocaleString()
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_: any, record: any) => (
                <Popconfirm title="Revoke Key?" description="This action cannot be undone." onConfirm={() => handleDelete(record.id)}>
                    <Button type="text" danger icon={<DeleteOutlined />} />
                </Popconfirm>
            )
        }
    ];

    return (
        <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
            <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <Title level={2}><KeyOutlined /> Developer API Keys</Title>
                    <Text type="secondary">Manage your secure tokens for programmatic access to the platform.</Text>
                </div>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
                    Create New Key
                </Button>
            </div>

            <Card styles={{ body: { padding: 0 } }}>
                <Table
                    columns={columns}
                    dataSource={keys}
                    loading={loading}
                    rowKey="id"
                    pagination={false}
                    locale={{ emptyText: 'No API keys found. Create one to get started.' }}
                />
            </Card>

            {/* Create Modal */}
            <Modal
                title="Create New API Key"
                open={createModalVisible}
                onOk={handleCreate}
                confirmLoading={creating}
                onCancel={() => setCreateModalVisible(false)}
                okText="Generate Key"
            >
                <div style={{ marginTop: 16 }}>
                    <Text strong>Key Name</Text>
                    <Input
                        placeholder="e.g. Production Backend"
                        value={newKeyName}
                        onChange={(e) => setNewKeyName(e.target.value)}
                        style={{ marginTop: 8 }}
                    />
                    <Paragraph type="secondary" style={{ marginTop: 8, fontSize: 12 }}>
                        Give your key a descriptive name to help you identify it later.
                    </Paragraph>
                </div>
            </Modal>

            {/* Secret Key Modal */}
            <Modal
                title="Save Your Secret Key"
                open={secretModalVisible}
                footer={[
                    <Button key="close" type="primary" onClick={() => setSecretModalVisible(false)}>
                        I have saved the key
                    </Button>
                ]}
                closable={false}
                maskClosable={false}
            >
                <Alert
                    message="Warning: This is shown only once!"
                    description="For security reasons, we cannot show this key again. Please copy and store it safely in a password manager."
                    type="warning"
                    showIcon
                    style={{ marginBottom: 24 }}
                />

                <div style={{
                    background: '#111827',
                    padding: '16px 20px',
                    borderRadius: 8,
                    border: '1px solid #374151',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <Text copyable style={{ color: brandingConfig.theme.primaryColor, fontFamily: 'monospace', fontSize: 16 }}>
                        {generatedKey}
                    </Text>
                    <Button
                        type="text"
                        icon={<CopyOutlined />}
                        onClick={() => copyToClipboard(generatedKey || '')}
                        style={{ color: '#9ca3af' }}
                    />
                </div>
            </Modal>
        </div>
    );
}
