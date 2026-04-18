"use client";
import React, { useEffect, useState } from 'react';
import { Card, Table, Button, Space, message, Select, Modal, Spin } from 'antd';
import { LeftOutlined, UserAddOutlined } from '@ant-design/icons';
import { useRouter, useSearchParams } from 'next/navigation';
import { brandingConfig } from '@/branding.config';

export default function InventoryDetailsPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const id = searchParams.get('id');

    const [esims, setEsims] = useState<any[]>([]);
    const [accounts, setAccounts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [selectedICCIDs, setSelectedICCIDs] = useState<string[]>([]);
    const [selectedAccount, setSelectedAccount] = useState<number | null>(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [allocating, setAllocating] = useState(false);

    useEffect(() => {
        const fetchDetails = async () => {
            if (!id) return;
            setLoading(true);
            try {
                // Fetch all eSIMs
                const esimRes = await fetch('/api/orion/esims');
                const esimData = await esimRes.json();

                // Filter by batch_id
                const relevantEsims = esimData.filter((e: any) => String(e.batch_id) === String(id));
                setEsims(relevantEsims);

                // Fetch Accounts (For allocation dropdown)
                const accRes = await fetch('/api/orion/accounts');
                if (accRes.ok) {
                    const accData = await accRes.json();
                    setAccounts(accData.filter((a: any) => a.status === 'ACTIVE' && a.id !== 1)); // Filter out root
                }
            } catch (err) {
                console.error(err);
                message.error('Failed to load inventory block details');
            } finally {
                setLoading(false);
            }
        };
        fetchDetails();
    }, [id]);

    const handleAllocate = async () => {
        if (!selectedAccount) {
            message.warning("Please select a target account");
            return;
        }

        setAllocating(true);
        try {
            const res = await fetch('/api/orion/inventory-actions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'ALLOCATE_TO_ACCOUNT',
                    iccid_list: selectedICCIDs,
                    account_id: selectedAccount
                })
            });

            if (res.ok) {
                message.success(`Successfully allocated ${selectedICCIDs.length} SIMs to the account!`);
                setModalVisible(false);
                setSelectedICCIDs([]);
                setSelectedAccount(null);

                // Optimistically local-refresh list
                setEsims(prev => prev.map(sim => selectedICCIDs.includes(sim.iccid) ? { ...sim, account_id: selectedAccount, status: 'WARM' } : sim));
            } else {
                const err = await res.json();
                message.error(err.error || "Allocation failed");
            }
        } catch (error) {
            message.error("Failed to commit allocation");
        } finally {
            setAllocating(false);
        }
    };

    const columns = [
        { title: 'ICCID', dataIndex: 'iccid', key: 'iccid' },
        { title: 'Mapped IMSI', dataIndex: 'mapped_imsi', key: 'mapped_imsi' },
        { title: 'Status', dataIndex: 'status', key: 'status' },
        { title: 'Date Created', dataIndex: 'created_at', key: 'created_at' },
        {
            title: 'Assigned Account ID',
            dataIndex: 'account_id',
            key: 'account_id',
            render: (acc_id: number) => {
                const acct = accounts.find(a => a.id === acc_id);
                return acct ? acct.name : (acc_id || 'Unassigned');
            }
        }
    ];

    if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><Spin size="large" /></div>;

    return (
        <Card
            title={
                <Space>
                    <Button icon={<LeftOutlined />} onClick={() => router.back()}>Back to Inventory</Button>
                    <span>Inventory Block Details</span>
                </Space>
            }
            extra={
                <Button
                    type="primary"
                    icon={<UserAddOutlined />}
                    disabled={selectedICCIDs.length === 0}
                    onClick={() => setModalVisible(true)}
                >
                    Allocate Selected to Account ({selectedICCIDs.length})
                </Button>
            }
        >
            <Table
                rowSelection={{
                    selectedRowKeys: selectedICCIDs,
                    onChange: (newSelectedKeys) => setSelectedICCIDs(newSelectedKeys as string[])
                }}
                columns={columns}
                dataSource={esims}
                rowKey="iccid"
            />

            <Modal
                title="Allocate ICCIDs to Account"
                open={modalVisible}
                onOk={handleAllocate}
                onCancel={() => setModalVisible(false)}
                confirmLoading={allocating}
                okText="Allocate"
            >
                <div style={{ marginBottom: 16 }}>
                    Select the Account to receive {selectedICCIDs.length} SIMs:
                </div>
                <Select
                    style={{ width: '100%' }}
                    placeholder="Chose Account"
                    value={selectedAccount}
                    onChange={(val) => setSelectedAccount(val)}
                    showSearch
                    optionFilterProp="children"
                >
                    {accounts.map(a => (
                        <Select.Option key={a.id} value={a.id}>{a.name}</Select.Option>
                    ))}
                </Select>
            </Modal>
        </Card>
    );
}
