"use client";
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Form, Input, Button, Select, Checkbox, DatePicker, Table, Space, Popconfirm, message, Card, Tag } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined, LeftOutlined } from '@ant-design/icons';
import * as Icons from '@ant-design/icons';
import { brandingConfig } from '@/branding.config';
import dayjs from 'dayjs';
import { Guard } from '@/components/Access/Guard';
import { useSession } from 'next-auth/react';
import { FilterEngine } from './FilterEngine';
import { useTenant } from '@/context/TenantContext';

class ErrorBoundary extends React.Component<any, { hasError: boolean }> {
    constructor(props: any) { super(props); this.state = { hasError: false }; }
    static getDerivedStateFromError(error: any) { return { hasError: true }; }
    componentDidCatch(error: any, errorInfo: any) {
        // Telemetry Beacon: Send exact crash data back to the Next.js server console via Lookup Mock API
        const payload = encodeURIComponent(error.toString() + "\n" + (errorInfo.componentStack || ""));
        fetch('/api/lookup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dbPool: "ERROR_LOG", query: payload })
        }).catch(() => { });
    }
    render() {
        if (this.state.hasError) return <h2 style={{ color: 'red' }}>UI CRASHED. Check Server Logs.</h2>;
        return this.props.children;
    }
}

interface Option {
    label: string;
    value: string;
}

interface FieldSchema {
    name: string;
    label: string;
    type: 'text' | 'number' | 'email' | 'select' | 'multi-select' | 'checkbox' | 'date';
    options?: Option[];
    lookup?: {
        dbPool: string;
        query: string;
    };
    required?: boolean;
    showInList?: boolean;
    primary?: boolean;
    hidden?: boolean;
    linkUrl?: string;
}

interface ConfigSchema {
    title: string;
    endpoint?: string;
    permissions?: {
        create?: string;
        update?: string;
        delete?: string;
    };
    filters?: any[];
    fields: FieldSchema[];
}

export const ConfigEngine = ({
    schema,
    initialData = [],
    onSelectionChange
}: {
    schema: any,
    initialData?: any[],
    onSelectionChange?: (selectedRows: any[]) => void
}) => {
    const { data: session } = useSession();
    const { tenant } = useTenant();

    // Permission priority: schema.permissions > schema.permission > default
    const permissions = schema.permissions || {
        create: schema.permission || 'node:create',
        update: schema.permission || 'node:update',
        delete: schema.permission || 'node:delete'
    };

    // Mode state: 'list' or 'form'
    const [mode, setMode] = useState<'list' | 'form'>('list');

    // Data state for the list view
    const [data, setData] = useState<any[]>(initialData);

    // Selection state for bulk delete
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

    // Editing state
    const [editingRecord, setEditingRecord] = useState<any>(null);
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);

    // Dynamic Options for dropdowns
    const [dynamicOptions, setDynamicOptions] = useState<Record<string, Option[]>>({});

    // Date Range state for time-aware reports
    const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);

    // Filter values state for top-level filters
    const [filterValues, setFilterValues] = useState<Record<string, any>>({});

    const fetchData = async () => {
        if (!schema.endpoint || !tenant?.id) return;
        setLoading(true);
        try {
            let url = schema.endpoint;
            const connector = url.includes('?') ? '&' : '?';
            const params = new URLSearchParams();

            if (dateRange && dateRange[0] && dateRange[1]) {
                params.append('from', dateRange[0].toISOString());
                params.append('to', dateRange[1].toISOString());
            }

            // Append other filters
            Object.entries(filterValues).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== '') {
                    params.append(key, String(value));
                }
            });

            const queryString = params.toString();
            if (queryString) {
                url += `${connector}${queryString}`;
            }

            const response = await fetch(url, {
                headers: {
                    'x-tenant-id': tenant?.id || ''
                }
            });
            if (response.ok) {
                const result = await response.json();
                setData(result);
            }
        } catch (error) {
            console.error("Failed to fetch configuration data:", error);
            message.error("Failed to load data from server");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [schema.endpoint, dateRange, filterValues, tenant?.id]);

    useEffect(() => {
        const fetchLookups = async () => {
            if (!tenant?.id) return;
            const lookups = schema.fields.filter((f: any) => f.lookup);

            const fetchPromises = lookups.map(async (field: any) => {
                try {
                    const response = await fetch('/api/lookup', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'x-tenant-id': tenant?.id || ''
                        },
                        body: JSON.stringify(field.lookup),
                    });
                    if (response.ok) {
                        const result = await response.json();
                        return { name: field.name, result };
                    }
                } catch (error) {
                    console.error(`Failed to fetch lookup for ${field.name}:`, error);
                }
                return null;
            });

            const results = await Promise.all(fetchPromises);
            const newOptions: Record<string, Option[]> = {};
            results.forEach(res => {
                if (res) newOptions[res.name] = res.result;
            });

            if (Object.keys(newOptions).length > 0) {
                setDynamicOptions(prev => ({ ...prev, ...newOptions }));
            }
        };

        fetchLookups();
    }, [schema.fields, tenant?.id]);

    // -- Handlers --

    const handleAddNew = () => {
        setEditingRecord(null);
        form.resetFields();
        setMode('form');
    };

    const handleEdit = (record: any) => {
        setEditingRecord(record);
        const formValues = { ...record };

        // Generic date transformation based on schema
        schema.fields.forEach((field: any) => {
            if (field.type === 'date' && formValues[field.name]) {
                formValues[field.name] = dayjs(formValues[field.name]);
            }
        });

        form.setFieldsValue(formValues);
        setMode('form');
    };

    const handleDelete = async (record: any) => {
        if (!schema.endpoint) {
            setData(prev => prev.filter(item => item !== record));
            message.success('Configuration deleted locally');
            return;
        }

        setLoading(true);
        try {
            // Send primary fields as identifiers
            const primaryFields = schema.fields.filter((f: any) => f.primary);
            const identifiers = primaryFields.reduce((acc: any, f: any) => {
                acc[f.name] = record[f.name];
                return acc;
            }, {});

            const response = await fetch(schema.endpoint, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'x-tenant-id': tenant?.id || ''
                },
                body: JSON.stringify(identifiers),
            });

            if (response.ok) {
                setData(prev => prev.filter(item => item !== record));
                message.success('Configuration deleted');
            } else {
                const error = await response.json();
                message.error(`Delete Failed: ${error.error || error.message || 'Unknown server error'}`);
            }
        } catch (error: any) {
            console.error("Delete failed:", error);
            message.error(`Connection Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleBulkDelete = () => {
        // Bulk delete implementation would need an API endpoint that supports it
        message.warning('Bulk delete not yet implemented for persistent storage');
    };

    const onFinish = async (values: any) => {
        if (schema.endpoint && !tenant?.id) {
            message.error("Tenant Context is not fully loaded. Please wait.");
            return;
        }

        const processedValues = { ...values };

        // Generic date transformation based on schema
        schema.fields.forEach((field: any) => {
            if (field.type === 'date' && processedValues[field.name]) {
                processedValues[field.name] = processedValues[field.name].format('YYYY-MM-DD');
            }
        });

        if (!schema.endpoint) {
            if (editingRecord) {
                setData(prev => prev.map(item => item === editingRecord ? { ...item, ...processedValues } : item));
                message.success('Configuration updated locally');
            } else {
                const newRecord = { ...processedValues, id: Date.now().toString() };
                setData(prev => [...prev, newRecord]);
                message.success('Configuration created locally');
            }
            setMode('list');
            return;
        }

        setLoading(true);
        try {
            const method = editingRecord ? 'PUT' : 'POST';

            // For PUT, include the identifiers from the editing record
            const payload = editingRecord
                ? { ...processedValues, _identifiers: schema.fields.filter((f: any) => f.primary).reduce((acc: any, f: any) => { acc[f.name] = editingRecord[f.name]; return acc; }, {}) }
                : processedValues;

            const response = await fetch(schema.endpoint, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'x-tenant-id': tenant?.id || ''
                },
                body: JSON.stringify(payload),
            });

            if (response.ok) {
                const result = await response.json();
                if (editingRecord) {
                    setData(prev => prev.map(item => item === editingRecord ? { ...item, ...processedValues } : item));
                    message.success('Configuration updated');
                } else {
                    setData(prev => [...prev, result]);
                    message.success('Configuration created');
                }
                setMode('list');
            } else {
                const error = await response.json();
                message.error(`Save Failed: ${error.error || error.message || 'Unknown server error'}`);
            }
        } catch (error: any) {
            console.error("Save failed:", error);
            message.error(`Connection Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    // -- Render Helpers --

    const downloadCSV = () => {
        if (!data || data.length === 0) return;

        const headers = schema.fields.map((f: any) => f.label).join(',');
        const rows = data.map((item: any) => {
            return schema.fields.map((f: any) => {
                const val = item[f.name];
                return typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val;
            }).join(',');
        });

        const csvContent = [headers, ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${schema.title}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const columns = useMemo(() => {
        if (!Array.isArray(data)) return [];
        return [
            ...schema.fields
                .filter((field: any) => !field.hidden && field.showInList !== false)
                .map((field: any, index: number) => {
                    // Generate filters dynamically from current data (flatten arrays first)
                    const uniqueValues = Array.from(new Set(
                        data.reduce((acc: any[], item: any) => {
                            const val = item[field.name];
                            if (val === null || val === undefined) return acc;
                            if (Array.isArray(val)) {
                                return [...acc, ...val.map(String)];
                            }
                            return [...acc, String(val)];
                        }, [])
                    )).filter(Boolean);

                    const filters = uniqueValues.map((val: any) => {
                        if ((field.type === 'select' || field.type === 'multi-select') && (dynamicOptions[field.name] || field.options)) {
                            const opts = dynamicOptions[field.name] || field.options;
                            if (Array.isArray(opts)) {
                                const opt = opts.find((o: any) => String(o?.value) === String(val));
                                return { text: opt ? opt.label : String(val), value: String(val) };
                            }
                        }
                        return { text: String(val), value: String(val) };
                    });

                    return {
                        title: field.label,
                        dataIndex: field.name,
                        key: field.name,
                        render: (text: any, record: any) => {
                            let finalDisplay = text;
                            if (field.type === 'checkbox') {
                                finalDisplay = text ? 'Yes' : 'No';
                            } else if (field.type === 'select' || field.type === 'multi-select') {
                                const resolvedOptions = dynamicOptions[field.name] || field.options;
                                if (Array.isArray(resolvedOptions)) {
                                    if (Array.isArray(text)) {
                                        finalDisplay = (
                                            <Space size={[0, 4]} wrap>
                                                {text.map((val: any) => {
                                                    const opt = resolvedOptions.find((o: any) => String(o?.value) === String(val));
                                                    return <Tag color="blue" key={val}>{opt ? opt.label : val}</Tag>;
                                                })}
                                            </Space>
                                        );
                                    } else {
                                        const opt = resolvedOptions.find((o: any) => String(o?.value) === String(text));
                                        finalDisplay = opt ? opt.label : text;
                                    }
                                }
                            }

                            if (field.linkUrl && finalDisplay) {
                                let url = field.linkUrl;
                                for (const k in record) {
                                    url = url.replace(`{${k}}`, record[k]);
                                }
                                return <a href={url} style={{ color: brandingConfig.theme.primaryColor }}>{finalDisplay}</a>;
                            }

                            return finalDisplay;
                        },
                        sorter: {
                            compare: (a: any, b: any) => {
                                const valA = a[field.name];
                                const valB = b[field.name];
                                if (typeof valA === 'number' && typeof valB === 'number') return valA - valB;
                                return String(valA).localeCompare(String(valB));
                            },
                            multiple: index + 1
                        },
                        filters: filters.length > 0 ? filters : undefined,
                        onFilter: (value: any, record: any) => {
                            const recordVal = record[field.name];
                            if (Array.isArray(recordVal)) {
                                return recordVal.includes(value);
                            }
                            // Loose equality match for filtering
                            return recordVal == value;
                        }
                    };
                }),
            ...(permissions.update !== 'disabled' || permissions.delete !== 'disabled' ? [{
                title: 'Actions',
                key: 'actions',
                width: 150,
                render: (_: any, record: any) => (
                    <Space>
                        <Guard permission={permissions.update!}>
                            <Button
                                type="text"
                                icon={<EditOutlined />}
                                onClick={() => handleEdit(record)}
                                style={{ color: brandingConfig.theme.primaryColor }}
                            />
                        </Guard>
                        <Guard permission={permissions.delete!}>
                            <Popconfirm title="Are you sure?" onConfirm={() => handleDelete(record)}>
                                <Button type="text" danger icon={<DeleteOutlined />} />
                            </Popconfirm>
                        </Guard>
                    </Space>
                )
            }] : [])
        ];
    }, [schema.fields, data, dynamicOptions, permissions, handleEdit, handleDelete]);

    if (mode === 'list') {
        const rowSelection = {
            selectedRowKeys,
            onChange: (newSelectedRowKeys: React.Key[], selectedRows: any[]) => {
                setSelectedRowKeys(newSelectedRowKeys);
                if (onSelectionChange) onSelectionChange(selectedRows);
            },
        };

        return (
            <ErrorBoundary>
                <Card
                    title={schema.title}
                    extra={
                        <Space>
                            {schema.metadataConfig?.supportsDateRange && (
                                <DatePicker.RangePicker
                                    showTime
                                    onChange={(dates) => setDateRange(dates as any)}
                                    style={{ marginRight: 8 }}
                                />
                            )}
                            <Button type="primary" onClick={downloadCSV}>Export CSV</Button>
                            {selectedRowKeys.length > 0 && (
                                <Guard permission={permissions.delete!}>
                                    <Button danger onClick={handleBulkDelete}>
                                        Delete Selected ({selectedRowKeys.length})
                                    </Button>
                                </Guard>
                            )}
                            <Guard permission={permissions.create!}>
                                <Button
                                    type="primary"
                                    icon={<PlusOutlined />}
                                    onClick={handleAddNew}
                                >
                                    Add New Record
                                </Button>
                            </Guard>
                        </Space>
                    }
                    style={{ background: brandingConfig.theme.componentBg, borderColor: '#333' }}
                    headStyle={{ color: brandingConfig.theme.textColor, borderBottomColor: '#333' }}
                    bodyStyle={{ padding: 0 }}
                >
                    {schema.filters && schema.filters.length > 0 && (
                        <div style={{ padding: '0 16px' }}>
                            <FilterEngine
                                filters={schema.filters}
                                onFilterChange={(vals) => setFilterValues(prev => ({ ...prev, ...vals }))}
                            />
                        </div>
                    )}
                    <Table
                        rowSelection={rowSelection}
                        columns={columns}
                        dataSource={data}
                        rowKey={(record, index) => record.id || record.iccid || record.imsi || record.msisdn || `config-${index}`}
                        pagination={{ pageSize: 10 }}
                        loading={loading}
                        style={{ background: 'transparent' }}
                    />
                </Card>
            </ErrorBoundary>
        );
    }

    // Form Mode
    return (
        <ErrorBoundary>
            <Card
                title={
                    <Space>
                        <Button icon={<LeftOutlined />} onClick={() => setMode('list')}>Back</Button>
                        <span>{editingRecord ? 'Edit Configuration' : 'New Configuration'}</span>
                    </Space>
                }
                style={{ maxWidth: 800, margin: '0 auto', background: brandingConfig.theme.componentBg, borderColor: '#333' }}
                headStyle={{ color: brandingConfig.theme.textColor, borderBottomColor: '#333' }}
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={onFinish}
                >
                    {schema.fields.filter((f: any) => !f.hidden).map((field: any) => (
                        <Form.Item
                            key={field.name}
                            label={field.label}
                            name={field.name}
                            valuePropName={field.type === 'checkbox' ? 'checked' : undefined}
                            rules={[{ required: field.required, message: `${field.label} is required` }]}
                        >
                            {field.type === 'text' && <Input disabled={field.primary && !!editingRecord} />}
                            {field.type === 'email' && <Input type="email" disabled={field.primary && !!editingRecord} />}
                            {field.type === 'number' && <Input type="number" disabled={field.primary && !!editingRecord} />}
                            {field.type === 'select' && (
                                <Select disabled={field.primary && !!editingRecord}>
                                    {Array.isArray(dynamicOptions[field.name] || field.options) ? (dynamicOptions[field.name] || field.options).map((opt: any) => (
                                        <Select.Option key={opt?.value || Math.random().toString()} value={opt?.value}>{opt?.label}</Select.Option>
                                    )) : null}
                                </Select>
                            )}
                            {field.type === 'multi-select' && (
                                <Select mode="multiple" disabled={field.primary && !!editingRecord}>
                                    {Array.isArray(dynamicOptions[field.name] || field.options) ? (dynamicOptions[field.name] || field.options).map((opt: any) => (
                                        <Select.Option key={opt?.value || Math.random().toString()} value={opt?.value}>{opt?.label}</Select.Option>
                                    )) : null}
                                </Select>
                            )}
                            {field.type === 'checkbox' && <Checkbox disabled={field.primary && !!editingRecord} />}
                            {field.type === 'date' && <DatePicker style={{ width: '100%' }} disabled={field.primary && !!editingRecord} />}
                        </Form.Item>
                    ))}
                    <Form.Item>
                        <Space>
                            <Button type="primary" htmlType="submit">
                                Save
                            </Button>
                            <Button onClick={() => setMode('list')}>
                                Cancel
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Card>
        </ErrorBoundary>
    );
};
