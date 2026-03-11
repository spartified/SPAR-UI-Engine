"use client";
import React from 'react';
import { Row, Col, Card, Statistic, Table } from 'antd';
import ReactECharts from 'echarts-for-react';
import * as Icons from '@ant-design/icons';
import dayjs from 'dayjs';
import { brandingConfig } from '@/branding.config';

// --- Schema Definitions ---

export type WidgetType = 'statistic' | 'chart' | 'table' | 'text';

export interface BaseWidget {
    type: WidgetType;
    title?: string;
    dataSource?: {
        dbPool: string;
        query: string;
    };
}

export interface StatisticWidget extends BaseWidget {
    type: 'statistic';
    value?: string | number;
    prefixIcon?: string;
    suffix?: string;
    precision?: number;
    color?: string; // Color override for icon/value
}

export interface ChartWidget extends BaseWidget {
    type: 'chart';
    chartType: 'line' | 'bar' | 'pie';
    xAxis?: string[];
    series?: {
        name: string;
        data: number[];
    }[];
    height?: number;
}

export interface TableWidget extends BaseWidget {
    type: 'table';
    columns: { title: string; dataIndex: string; key: string }[];
    data?: any[];
}

export interface TextWidget extends BaseWidget {
    type: 'text';
    content?: string;
}

export type WidgetConfig = StatisticWidget | ChartWidget | TableWidget | TextWidget;

export interface ColConfig {
    span: number;
    widget: WidgetConfig;
}

export interface RowConfig {
    gutter?: number;
    columns: ColConfig[];
}


// --- Filter Types ---

interface FilterConfig {
    key: string;
    type: 'dateRange' | 'select';
    label?: string;
    defaultValue?: any;
    options?: { label: string; value: any }[];
    placeholder?: string;
}

export interface PageSchema {
    title: string;
    filters?: FilterConfig[];
    rows: RowConfig[];
}


// --- Widget Factory ---

interface WidgetRendererProps<T extends WidgetConfig> {
    widget: T;
    filters?: Record<string, any>;
    data?: any;
}

const renderIcon = (iconName?: string, color?: string) => {
    if (!iconName) return null;
    // @ts-ignore - dynamic access to icons
    const IconComponent = Icons[iconName];
    if (IconComponent) {
        return <IconComponent style={{ fontSize: '24px', color: color || brandingConfig.theme.primaryColor }} />;
    }
    return null;
};

const StatisticRenderer = ({ widget, data }: WidgetRendererProps<StatisticWidget>) => {
    const displayValue = data !== undefined ? data : widget.value;
    return (
        <Card bordered={false} style={{ background: brandingConfig.theme.componentBg, height: '100%' }}>
            <Statistic
                title={<span style={{ color: brandingConfig.theme.textColor }}>{widget.title}</span>}
                value={displayValue}
                precision={widget.precision}
                valueStyle={{ color: brandingConfig.theme.textColor }}
                prefix={renderIcon(widget.prefixIcon, widget.color)}
                suffix={widget.suffix}
            />
        </Card>
    );
};

const ChartRenderer = ({ widget, filters, data }: WidgetRendererProps<ChartWidget>) => {
    const titleSuffix = filters?.dateRange ? ` (${dayjs(filters.dateRange[0]).format('MM/DD')} - ${dayjs(filters.dateRange[1]).format('MM/DD')})` : '';

    // If we have dynamic data, we need to transform it
    let xAxis = widget.xAxis;
    let series = widget.series || [];

    if (data && Array.isArray(data)) {
        // Assume data format: [{ x_axis: '...', series1: ..., series2: ... }]
        xAxis = Array.from(new Set(data.map(item => item.x_axis || item.name)));

        // Identify series columns (everything except x_axis/name)
        const sample = data[0] || {};
        const seriesKeys = Object.keys(sample).filter(k => k !== 'x_axis' && k !== 'name');

        series = seriesKeys.map(key => ({
            name: key.replace(/_/g, ' ').toUpperCase(),
            data: data.map(item => Number(item[key]))
        }));
    }

    const option = {
        title: {
            text: widget.title + titleSuffix,
            textStyle: { color: brandingConfig.theme.textColor }
        },
        legend: {
            textStyle: { color: brandingConfig.theme.textColor },
            bottom: 0
        },
        toolbox: {
            feature: {
                saveAsImage: { title: 'Save Image' },
                dataView: { title: 'Data View', readOnly: false },
                restore: { title: 'Restore' }
            },
            iconStyle: {
                borderColor: brandingConfig.theme.textColor
            },
            right: 10,
            top: 0
        },
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'axis',
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: '10%',
            containLabel: true
        },
        xAxis: widget.chartType === 'pie' ? undefined : {
            type: 'category',
            data: xAxis || [],
            axisLabel: { color: brandingConfig.theme.textColor },
            axisLine: { lineStyle: { color: brandingConfig.theme.textColor } }
        },
        yAxis: widget.chartType === 'pie' ? undefined : {
            type: 'value',
            axisLabel: { color: brandingConfig.theme.textColor },
            splitLine: { lineStyle: { color: '#333' } }
        },
        series: series.map((s, index) => ({
            name: s.name,
            type: widget.chartType,
            data: s.data,
            // Cycle colors if many series
            itemStyle: index === 0 ? { color: brandingConfig.theme.primaryColor } : undefined
        }))
    };

    return (
        <Card bordered={false} style={{ background: brandingConfig.theme.componentBg }}>
            <ReactECharts option={option} style={{ height: widget.height || 450 }} />
        </Card>
    );
};

const downloadCSV = (data: any[], columns: { title: string; dataIndex: string }[], filename: string) => {
    if (!data || data.length === 0) return;

    const headers = columns.map(col => col.title).join(',');
    const rows = data.map(item => {
        return columns.map(col => {
            const val = item[col.dataIndex];
            return typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val;
        }).join(',');
    });

    const csvContent = [headers, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

const TableRenderer = ({ widget, data }: WidgetRendererProps<TableWidget>) => {
    const displayData = data || widget.data || [];
    // Process columns to add sorting and filtering
    const processedColumns = widget.columns.map((col, index) => {
        // Generate filters from data
        const uniqueValues = Array.from(new Set(displayData.map((item: any) => item[col.dataIndex]))).filter(Boolean);
        const filters = uniqueValues.map(val => ({ text: String(val), value: val as any }));

        return {
            ...col,
            sorter: {
                compare: (a: any, b: any) => {
                    const valA = a[col.dataIndex];
                    const valB = b[col.dataIndex];
                    if (typeof valA === 'number' && typeof valB === 'number') return valA - valB;
                    return String(valA).localeCompare(String(valB));
                },
                multiple: index + 1 // Allow multi-column sorting
            },
            filters: filters.length > 0 ? filters : undefined,
            onFilter: (value: any, record: any) => {
                const recordVal = record[col.dataIndex];
                // loose equality for flexibility
                return recordVal == value;
            },
        };
    });

    return (
        <Card
            title={<span style={{ color: brandingConfig.theme.textColor }}>{widget.title}</span>}
            bordered={false}
            style={{ background: brandingConfig.theme.componentBg }}
            extra={
                <Icons.DownloadOutlined
                    style={{ color: brandingConfig.theme.primaryColor, cursor: 'pointer', fontSize: 18 }}
                    onClick={() => downloadCSV(displayData, widget.columns, widget.title || 'export')}
                />
            }
        >
            <Table
                columns={processedColumns}
                dataSource={displayData}
                pagination={false}
                rowKey={(record, index) => record.id || index}
                scroll={{ x: 'max-content' }} // Ensure table is scrollable if many columns
            />
        </Card>
    );
};

const TextRenderer = ({ widget }: WidgetRendererProps<TextWidget>) => (
    <Card title={<span style={{ color: brandingConfig.theme.textColor }}>{widget.title}</span>} bordered={false} style={{ background: brandingConfig.theme.componentBg }}>
        <p style={{ color: brandingConfig.theme.textColor }}>{widget.content}</p>
    </Card>
);

const WidgetFactory = ({ widget, filters, data }: { widget: WidgetConfig; filters?: Record<string, any>; data?: any }) => {
    switch (widget.type) {
        case 'statistic':
            return <StatisticRenderer widget={widget} data={data} />;
        case 'chart':
            return <ChartRenderer widget={widget} filters={filters} data={data} />;
        case 'table':
            return <TableRenderer widget={widget} data={data} />;
        case 'text':
            return <TextRenderer widget={widget} />;
        default:
            return <div>Unknown Widget Type</div>;
    }
};


// --- Main Engine ---

import { FilterEngine } from './FilterEngine';
import { useState, useEffect } from 'react';

export const PageEngine = ({ schema }: { schema: PageSchema }) => {
    const [filterValues, setFilterValues] = useState<Record<string, any>>({});
    const [widgetData, setWidgetData] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(false);

    const handleFilterChange = (newValues: Record<string, any>) => {
        setFilterValues(prev => ({ ...prev, ...newValues }));
    };

    const fetchWidgetData = async () => {
        setLoading(true);
        const newData: Record<string, any> = {};

        // Iterate through all widgets in all rows
        for (let rIndex = 0; rIndex < schema.rows.length; rIndex++) {
            const row = schema.rows[rIndex];
            for (let cIndex = 0; cIndex < row.columns.length; cIndex++) {
                const widget = row.columns[cIndex].widget;

                if (widget.dataSource) {
                    const widgetKey = `${rIndex}-${cIndex}`;
                    try {
                        // SQL Parameter Substitution
                        let query = widget.dataSource.query;

                        // Handle Date Range
                        if (filterValues.dateRange) {
                            const start = dayjs(filterValues.dateRange[0]).format('YYYY-MM-DD');
                            const end = dayjs(filterValues.dateRange[1]).format('YYYY-MM-DD');
                            query = query.replace(/:start/g, `'${start}'`).replace(/:end/g, `'${end}'`);
                        }

                        // Handle other filter keys like :hpmn, :vpmn
                        Object.entries(filterValues).forEach(([key, value]) => {
                            if (key !== 'dateRange' && value !== undefined && value !== null) {
                                query = query.replace(new RegExp(`:${key}`, 'g'), Array.isArray(value) ? value.map(v => `'${v}'`).join(',') : `'${value}'`);
                            } else if (value === null || value === undefined) {
                                // If filter is cleared, use a wildcard or handle depending on SQL logic
                                // For now, we assume queries use something like (nwid = :nwid OR :nwid IS NULL)
                                query = query.replace(new RegExp(`:${key}`, 'g'), 'NULL');
                            }
                        });

                        const response = await fetch('/api/lookup', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                dbPool: widget.dataSource.dbPool,
                                query
                            }),
                        });

                        if (response.ok) {
                            const result = await response.json();
                            // For statistics, take the first value of the first row
                            if (widget.type === 'statistic' && Array.isArray(result) && result.length > 0) {
                                newData[widgetKey] = Object.values(result[0])[0];
                            } else {
                                newData[widgetKey] = result;
                            }
                        }
                    } catch (error) {
                        console.error(`Failed to fetch data for widget ${widgetKey}:`, error);
                    }
                }
            }
        }
        setWidgetData(newData);
        setLoading(false);
    };

    useEffect(() => {
        if (Object.keys(filterValues).length > 0) {
            fetchWidgetData();
        }
    }, [filterValues]);

    return (
        <div style={{ padding: 24, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h1 style={{ margin: 0, paddingLeft: 8 }}>{schema.title}</h1>
            </div>

            {schema.filters && schema.filters.length > 0 && (
                <FilterEngine
                    filters={schema.filters as any}
                    onFilterChange={handleFilterChange}
                />
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {schema.rows.map((row, rIndex) => (
                    <Row key={rIndex} gutter={row.gutter || 16}>
                        {row.columns.map((col, cIndex) => (
                            <Col key={cIndex} span={col.span}>
                                <WidgetFactory
                                    widget={col.widget}
                                    filters={filterValues}
                                    data={widgetData[`${rIndex}-${cIndex}`]}
                                />
                            </Col>
                        ))}
                    </Row>
                ))}
            </div>
        </div>
    );
};
