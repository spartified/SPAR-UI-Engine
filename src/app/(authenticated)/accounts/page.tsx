"use client";
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Tree, Card, Spin, Row, Col, Tag, Table, Button, Form, Input, Select, Checkbox, Space, Popconfirm, message, Modal } from 'antd';
import { ApartmentOutlined, PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { brandingConfig } from '@/branding.config';

interface AccountNode {
    id: number;
    name: string;
    type: string;
    state: string;
    status: string;
    parent_id: number | null;
    billing_enabled: boolean;
    classifier: string;
    contact_first_name: string;
    contact_last_name: string;
    contact_email: string;
    contact_phone: string;
    markup_percentage?: number;
}

// Hierarchy: ROOT → ENTERPRISE → RESELLER → CUSTOMER
const TYPE_HIERARCHY: Record<string, string> = {
    'ROOT': 'ENTERPRISE',
    'ENTERPRISE': 'RESELLER',
    'RESELLER': 'CUSTOMER',
};

function getChildType(parentType: string | null): string {
    if (!parentType) return 'ROOT';
    return TYPE_HIERARCHY[parentType] || 'CUSTOMER';
}

function buildTree(accounts: AccountNode[]): any[] {
    const map = new Map<number, any>();
    const roots: any[] = [];

    accounts.forEach(a => {
        map.set(a.id, {
            key: a.id,
            title: (
                <span>
                    {a.name}{' '}
                    <Tag color={a.type === 'ROOT' ? 'gold' : a.type === 'ENTERPRISE' ? 'blue' : a.type === 'RESELLER' ? 'purple' : 'green'}>
                        {a.type}
                    </Tag>
                    <Tag color={a.state === 'PRODUCTION' ? 'green' : 'orange'}>
                        {a.state}
                    </Tag>
                </span>
            ),
            children: []
        });
    });

    accounts.forEach(a => {
        const node = map.get(a.id);
        if (a.parent_id && map.has(a.parent_id)) {
            map.get(a.parent_id).children.push(node);
        } else {
            roots.push(node);
        }
    });

    return roots;
}

export default function AccountManagementPage() {
    const [accounts, setAccounts] = useState<AccountNode[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedAccount, setSelectedAccount] = useState<number | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState<AccountNode | null>(null);
    const [derivedType, setDerivedType] = useState<string>('ROOT');
    const [form] = Form.useForm();

    const fetchAccounts = () => {
        setLoading(true);
        fetch('/api/orion/accounts')
            .then(res => res.json())
            .then(data => {
                setAccounts(Array.isArray(data) ? data : []);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    };

    useEffect(() => { fetchAccounts(); }, []);

    const treeData = useMemo(() => buildTree(accounts), [accounts]);

    const handleParentChange = useCallback((parentId: number | null) => {
        if (!parentId) {
            setDerivedType('ROOT');
        } else {
            const parent = accounts.find(a => a.id === parentId);
            setDerivedType(getChildType(parent?.type || null));
        }
    }, [accounts]);

    const handleAddNew = () => {
        setEditingRecord(null);
        form.resetFields();
        setDerivedType('ROOT');
        setModalOpen(true);
    };

    const handleEdit = useCallback((record: AccountNode) => {
        setEditingRecord(record);
        form.setFieldsValue(record);
        if (record.parent_id) {
            const parent = accounts.find(a => a.id === record.parent_id);
            setDerivedType(getChildType(parent?.type || null));
        } else {
            setDerivedType(record.type || 'ROOT');
        }
        setModalOpen(true);
    }, [accounts, form]);

    const handleDelete = useCallback(async (record: AccountNode) => {
        try {
            const response = await fetch('/api/orion/accounts', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: record.id }),
            });
            if (response.ok) {
                message.success('Account deleted');
                fetchAccounts();
            } else {
                const err = await response.json();
                message.error(err.error || 'Delete failed');
            }
        } catch (e: any) {
            message.error(e.message || 'Delete failed');
        }
    }, [fetchAccounts]);

    const handleSubmit = async (values: any) => {
        const payload = { ...values, type: derivedType };

        try {
            const method = editingRecord ? 'PUT' : 'POST';
            const body = editingRecord
                ? { ...payload, _identifiers: { id: editingRecord.id } }
                : payload;

            const response = await fetch('/api/orion/accounts', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (response.ok) {
                message.success(editingRecord ? 'Account updated' : 'Account created');
                setModalOpen(false);
                fetchAccounts();
            } else {
                const err = await response.json();
                message.error(err.error || 'Save failed');
            }
        } catch (e: any) {
            message.error(e.message || 'Save failed');
        }
    };

    const columns = useMemo(() => [
        { title: 'Account Name', dataIndex: 'name', key: 'name' },
        {
            title: 'Parent Account', dataIndex: 'parent_id', key: 'parent_id',
            render: (val: number | null) => {
                if (!val) return <Tag>— (Root)</Tag>;
                const parent = accounts.find(a => a.id === val);
                return parent ? parent.name : val;
            }
        },
        {
            title: 'Type', dataIndex: 'type', key: 'type',
            render: (t: string) => (
                <Tag color={t === 'ROOT' ? 'gold' : t === 'ENTERPRISE' ? 'blue' : t === 'RESELLER' ? 'purple' : 'green'}>{t}</Tag>
            )
        },
        {
            title: 'State', dataIndex: 'state', key: 'state',
            render: (s: string) => <Tag color={s === 'PRODUCTION' ? 'green' : 'orange'}>{s}</Tag>
        },
        {
            title: 'Status', dataIndex: 'status', key: 'status',
            render: (s: string) => <Tag color={s === 'ACTIVE' ? 'green' : 'red'}>{s}</Tag>
        },
        {
            title: 'Markup %', dataIndex: 'markup_percentage', key: 'markup_percentage',
            render: (val: number | undefined) => val !== undefined ? `${val}%` : <Tag>—</Tag>
        },
        {
            title: 'Actions', key: 'actions', width: 150,
            render: (_: any, record: AccountNode) => (
                <Space>
                    <Button type="text" icon={<EditOutlined />} onClick={() => handleEdit(record)} style={{ color: brandingConfig.theme.primaryColor }} />
                    <Popconfirm title="Are you sure?" onConfirm={() => handleDelete(record)}>
                        <Button type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                </Space>
            )
        },
    ], [accounts, handleEdit, handleDelete]);

    return (
        <div>
            <h1 style={{ marginBottom: 24 }}>
                <ApartmentOutlined style={{ marginRight: 8 }} />
                Account Management
            </h1>

            <Row gutter={16} style={{ marginBottom: 24 }}>
                <Col span={8}>
                    <Card
                        title="Account Hierarchy"
                        style={{ background: brandingConfig.theme.componentBg, height: '100%' }}
                        styles={{ body: { maxHeight: 400, overflow: 'auto' } }}
                    >
                        {loading ? (
                            <Spin />
                        ) : treeData.length > 0 ? (
                            <Tree
                                showLine
                                defaultExpandAll
                                treeData={treeData}
                                onSelect={(keys) => {
                                    if (keys.length > 0) setSelectedAccount(keys[0] as number);
                                }}
                            />
                        ) : (
                            <p style={{ color: '#888' }}>No accounts found. Create one below.</p>
                        )}
                    </Card>
                </Col>
                <Col span={16}>
                    <Card
                        title="Account Details"
                        style={{ background: brandingConfig.theme.componentBg, height: '100%' }}
                    >
                        {selectedAccount ? (
                            (() => {
                                const acct = accounts.find(a => a.id === selectedAccount);
                                if (!acct) return <p>Select an account from the tree.</p>;
                                return (
                                    <div>
                                        <p><strong>Name:</strong> {acct.name}</p>
                                        <p><strong>Type:</strong> <Tag>{acct.type}</Tag></p>
                                        <p><strong>State:</strong> <Tag color={acct.state === 'PRODUCTION' ? 'green' : 'orange'}>{acct.state}</Tag></p>
                                        <p><strong>Status:</strong> <Tag color={acct.status === 'ACTIVE' ? 'green' : 'red'}>{acct.status}</Tag></p>
                                    </div>
                                );
                            })()
                        ) : (
                            <p style={{ color: '#888' }}>Select an account from the hierarchy tree to view details.</p>
                        )}
                    </Card>
                </Col>
            </Row>

            <Card
                title="Accounts"
                extra={
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleAddNew}>
                        Add New Account
                    </Button>
                }
                style={{ background: brandingConfig.theme.componentBg, borderColor: '#333' }}
                styles={{ header: { color: brandingConfig.theme.textColor, borderBottomColor: '#333' }, body: { padding: 0 } }}
            >
                <Table
                    columns={columns}
                    dataSource={accounts}
                    rowKey="id"
                    pagination={{ pageSize: 10 }}
                    loading={loading}
                />
            </Card>

            <Modal
                title={editingRecord ? 'Edit Account' : 'New Account'}
                open={modalOpen}
                onCancel={() => setModalOpen(false)}
                footer={null}
                width={600}
            >
                <Form form={form} layout="vertical" onFinish={handleSubmit}>
                    <Form.Item label="Account Name" name="name" rules={[{ required: true, message: 'Account name is required' }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item label="Parent Account" name="parent_id">
                        <Select
                            allowClear
                            placeholder="None (Root Account)"
                            onChange={(val) => handleParentChange(val || null)}
                        >
                            {accounts
                                .filter(a => a.type !== 'CUSTOMER')
                                .map(a => (
                                    <Select.Option key={a.id} value={a.id}>{a.name} ({a.type})</Select.Option>
                                ))}
                        </Select>
                    </Form.Item>
                    <Form.Item label="Account Type">
                        <Input value={derivedType} disabled
                            addonAfter={
                                <Tag color={derivedType === 'ROOT' ? 'gold' : derivedType === 'ENTERPRISE' ? 'blue' : derivedType === 'RESELLER' ? 'purple' : 'green'} style={{ margin: 0 }}>
                                    Auto-derived
                                </Tag>
                            }
                        />
                    </Form.Item>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item label="State" name="state" initialValue="TRIAL">
                                <Select>
                                    <Select.Option value="TRIAL">Trial</Select.Option>
                                    <Select.Option value="PRODUCTION">Production</Select.Option>
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item label="Classifier" name="classifier">
                                <Select allowClear>
                                    <Select.Option value="TRAVELSIM">TravelSIM</Select.Option>
                                    <Select.Option value="IOT">IoT</Select.Option>
                                    <Select.Option value="CAMARA">CAMARA</Select.Option>
                                </Select>
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item label="Billing Enabled" name="billing_enabled" valuePropName="checked">
                        <Checkbox />
                    </Form.Item>
                    <Form.Item label="Markup %" name="markup_percentage">
                        <Input type="number" step="0.01" suffix="%" placeholder="Optional markup rate for this account" />
                    </Form.Item>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item label="Contact First Name" name="contact_first_name">
                                <Input />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item label="Contact Last Name" name="contact_last_name">
                                <Input />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item label="Contact Email" name="contact_email">
                                <Input type="email" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item label="Contact Phone" name="contact_phone">
                                <Input />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item label="Status" name="status" initialValue="ACTIVE" rules={[{ required: true }]}>
                        <Select>
                            <Select.Option value="ACTIVE">Active</Select.Option>
                            <Select.Option value="INACTIVE">Inactive</Select.Option>
                        </Select>
                    </Form.Item>
                    <Form.Item>
                        <Space>
                            <Button type="primary" htmlType="submit">Save</Button>
                            <Button onClick={() => setModalOpen(false)}>Cancel</Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}

