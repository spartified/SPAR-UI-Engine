"use client";
import React, { useState } from 'react';
import { ConfigEngine } from '@/components/Engines/ConfigEngine';
import { Button, Space, Modal, Select, message, Tag } from 'antd';
import {
    PlayCircleOutlined,
    PauseCircleOutlined,
    StopOutlined,
    ReloadOutlined
} from '@ant-design/icons';
import esimsSchema from '@/schemas/orion-esims.json';

const BULK_ACTIONS = [
    { key: 'ACTIVATE', label: 'Activate', icon: <PlayCircleOutlined />, color: '#52c41a' },
    { key: 'SUSPEND', label: 'Suspend', icon: <PauseCircleOutlined />, color: '#faad14' },
    { key: 'RESUME', label: 'Resume', icon: <ReloadOutlined />, color: '#1890ff' },
    { key: 'DEACTIVATE', label: 'Deactivate', icon: <StopOutlined />, color: '#ff4d4f' },
];

export default function DeviceLifecyclePage() {
    const [selectedRows, setSelectedRows] = useState<any[]>([]);
    const [bulkAction, setBulkAction] = useState<string | null>(null);
    const [bulkLoading, setBulkLoading] = useState(false);

    // Allocation State
    const [allocateModalVisible, setAllocateModalVisible] = useState(false);
    const [subAccounts, setSubAccounts] = useState<any[]>([]);
    const [selectedSubAccount, setSelectedSubAccount] = useState<number | null>(null);

    React.useEffect(() => {
        // Fetch subaccounts for the allocation drop down
        fetch('/api/orion/accounts')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    // Just store all available ones, backend will do logical boundaries if needed
                    // In a perfect system, api/accounts returns purely what the user sees
                    setSubAccounts(data.filter(a => a.id !== 1)); // hide root
                }
            })
            .catch(() => { });
    }, []);

    const processAllocate = async () => {
        if (!selectedSubAccount) {
            message.warning('Please select a Sub-Account');
            return;
        }

        setBulkLoading(true);
        try {
            const response = await fetch('/api/orion/esim-actions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'ALLOCATE_SUBACCOUNT',
                    account_id: selectedSubAccount,
                    esim_ids: selectedRows.map(r => r.id),
                }),
            });
            if (response.ok) {
                message.success(`Successfully allocated ${selectedRows.length} SIM(s) to Sub-Account.`);
                setAllocateModalVisible(false);
                setSelectedRows([]);
                window.location.reload();
            } else {
                const err = await response.json();
                message.error(err.error || `Failed to allocate.`);
            }
        } catch (error) {
            message.error(`Failed to allocate.`);
        } finally {
            setBulkLoading(false);
        }
    };

    const handleBulkAction = async (action: string) => {
        if (selectedRows.length === 0) {
            message.warning('Please select at least one eSIM to perform a bulk action.');
            return;
        }

        Modal.confirm({
            title: `Confirm ${action}`,
            content: `Are you sure you want to ${action.toLowerCase()} ${selectedRows.length} selected eSIM(s)?`,
            okText: 'Yes',
            cancelText: 'No',
            onOk: async () => {
                setBulkLoading(true);
                try {
                    const response = await fetch('/api/orion/esim-actions', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            action,
                            esim_ids: selectedRows.map(r => r.id),
                        }),
                    });
                    if (response.ok) {
                        message.success(`${action} action submitted for ${selectedRows.length} eSIM(s).`);
                        setSelectedRows([]);
                        // Trigger a refresh by reloading
                        window.location.reload();
                    } else {
                        const err = await response.json();
                        message.error(err.error || `Failed to ${action.toLowerCase()}.`);
                    }
                } catch (error) {
                    message.error(`Failed to ${action.toLowerCase()}.`);
                } finally {
                    setBulkLoading(false);
                }
            },
        });
    };

    return (
        <div>
            <h1 style={{ marginBottom: 16 }}>Device Lifecycle Control Center</h1>

            {/* Bulk Action Toolbar */}
            <div style={{
                marginBottom: 16,
                padding: '12px 16px',
                background: '#111827',
                borderRadius: 8,
                border: '1px solid #1f2937',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <Space>
                    {BULK_ACTIONS.map(action => (
                        <Button
                            key={action.key}
                            icon={action.icon}
                            loading={bulkLoading && bulkAction === action.key}
                            disabled={selectedRows.length === 0}
                            onClick={() => {
                                setBulkAction(action.key);
                                handleBulkAction(action.key);
                            }}
                            style={{
                                borderColor: action.color,
                                color: action.color
                            }}
                        >
                            {action.label}
                        </Button>
                    ))}

                    <Button
                        disabled={selectedRows.length === 0 || selectedRows.some(r => r.status !== 'AVAILABLE')}
                        onClick={() => setAllocateModalVisible(true)}
                        style={{ borderColor: '#722ed1', color: '#722ed1' }}
                    >
                        Allocate to Sub-Account
                    </Button>
                </Space>
                <span style={{ color: '#9ca3af' }}>
                    {selectedRows.length > 0
                        ? `${selectedRows.length} eSIM(s) selected`
                        : 'Select eSIMs for bulk actions'}
                </span>
            </div>

            <ConfigEngine
                schema={esimsSchema as any}
                onSelectionChange={(rows) => setSelectedRows(rows)}
            />

            {/* Sub-Account Allocation Modal */}
            <Modal
                title="Allocate SIMs to Sub-Account"
                open={allocateModalVisible}
                onOk={processAllocate}
                onCancel={() => setAllocateModalVisible(false)}
                confirmLoading={bulkLoading}
                okText="Allocate"
            >
                <div style={{ marginBottom: 16 }}>
                    Select the target Sub-Account to transfer ownership of {selectedRows.length} SIMs:
                </div>
                <Select
                    style={{ width: '100%' }}
                    placeholder="Choose Sub-Account"
                    value={selectedSubAccount}
                    onChange={(val) => setSelectedSubAccount(val)}
                    showSearch
                    optionFilterProp="children"
                >
                    {subAccounts.map(a => (
                        <Select.Option key={a.id} value={a.id}>{a.name}</Select.Option>
                    ))}
                </Select>
            </Modal>
        </div>
    );
}
