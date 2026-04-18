"use client";
import React from 'react';
import { Row, Col, Card, Statistic, Table } from 'antd';
import ReactECharts from 'echarts-for-react';
import * as Icons from '@ant-design/icons';
import dayjs from 'dayjs';
import { brandingConfig } from '@/branding.config';
import { useTheme } from '@/context/ThemeContext';

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
    color?: string;
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
    // No inline background — let ConfigProvider Card token drive it
    return (
        <Card bordered={false} style={{ height: '100%' }}>
            <Statistic
                title={widget.title}
                value={displayValue}
                precision={widget.precision}
                prefix={renderIcon(widget.prefixIcon, widget.color)}
                suffix={widget.suffix}
            />
        </Card>
    );
};

const ChartRenderer = ({ widget, filters, data }: WidgetRendererProps<ChartWidget>) => {
    const { theme, mode } = useTheme();
    const titleSuffix = filters?.dateRange ? ` (${dayjs(filters.dateRange[0]).format('MM/DD')} - ${dayjs(filters.dateRange[1]).format('MM/DD')})` : '';

    let xAxis = widget.xAxis;
    let series = widget.series || [];

    if (data && Array.isArray(data)) {
        xAxis = Array.from(new Set(data.map(item => item.x_axis || item.name)));
        const sample = data[0] || {};
        const seriesKeys = Object.keys(sample).filter(k => k !== 'x_axis' && k !== 'name');
        series = seriesKeys.map(key => ({
            name: key.replace(/_/g, ' ').toUpperCase(),
            data: data.map(item => Number(item[key]))
        }));
    }

    const gridLineColor = mode === 'light' ? '#e5e7eb' : '#1f2937';
    const axisLineColor = mode === 'light' ? '#9ca3af' : '#374151';
    const tooltipBg = mode === 'light' ? 'rgba(255,255,255,0.95)' : 'rgba(17,24,39,0.9)';
    const tooltipTextColor = mode === 'light' ? '#111827' : '#fff';

    const colorPalette = [
        theme.primaryColor,
        '#22D3EE', '#9f7aea', '#f6ad55', '#48bb78', '#f687b3', '#4299e1', '#ed64a6',
    ];

    const option = {
        color: colorPalette,
        title: {
            text: widget.title + titleSuffix,
            textStyle: { color: theme.textColor, fontSize: 16, fontWeight: 'normal' },
            top: 0
        },
        legend: {
            textStyle: { color: theme.textColor },
            bottom: 0,
            type: 'scroll'
        },
        toolbox: {
            feature: {
                saveAsImage: { title: 'Save' },
                dataView: { title: 'Data', readOnly: false },
                restore: { title: 'Reset' }
            },
            iconStyle: { borderColor: theme.textColor },
            right: 0,
            top: 0
        },
        backgroundColor: 'transparent',
        tooltip: {
            trigger: xAxis ? 'axis' : 'item',
            backgroundColor: tooltipBg,
            borderColor: axisLineColor,
            textStyle: { color: tooltipTextColor }
        },
        grid: { left: '3%', right: '4%', bottom: '15%', top: '15%', containLabel: true },
        xAxis: widget.chartType === 'pie' ? undefined : {
            type: 'category',
            data: xAxis || [],
            axisLabel: { color: theme.textColor, rotate: xAxis && xAxis.length > 5 ? 30 : 0 },
            axisLine: { lineStyle: { color: axisLineColor } }
        },
        yAxis: widget.chartType === 'pie' ? undefined : {
            type: 'value',
            axisLabel: { color: theme.textColor },
            splitLine: { lineStyle: { color: gridLineColor } },
            axisLine: { show: false }
        },
        series: series.map((s) => ({
            name: s.name,
            type: widget.chartType,
            data: s.data,
            smooth: true,
            symbol: 'circle',
            symbolSize: 6,
            areaStyle: widget.chartType === 'line' ? { opacity: 0.1 } : undefined
        }))
    };

    return (
        <Card bordered={false} style={{ borderRadius: 12, overflow: 'hidden' }}>
            <ReactECharts option={option} style={{ height: widget.height || 400 }} />
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
    const { theme } = useTheme();
    const displayData = data || widget.data || [];

    const processedColumns = React.useMemo(() => {
        return widget.columns.map((col, index) => {
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
                    multiple: index + 1
                },
                filters: filters.length > 0 ? filters : undefined,
                onFilter: (value: any, record: any) => record[col.dataIndex] == value,
            };
        });
    }, [widget.columns, displayData]);

    return (
        <Card
            title={widget.title}
            bordered={false}
            extra={
                <Icons.DownloadOutlined
                    style={{ color: theme.primaryColor, cursor: 'pointer', fontSize: 18 }}
                    onClick={() => downloadCSV(displayData, widget.columns, widget.title || 'export')}
                />
            }
        >
            <Table
                columns={processedColumns}
                dataSource={displayData}
                pagination={false}
                rowKey={(record, index) => record.id || `row-${index}`}
                scroll={{ x: 'max-content' }}
            />
        </Card>
    );
};

const TextRenderer = ({ widget }: WidgetRendererProps<TextWidget>) => (
    <Card title={widget.title} bordered={false}>
        <p>{widget.content}</p>
    </Card>
);

const WidgetFactory = ({ widget, filters, data }: { widget: WidgetConfig; filters?: Record<string, any>; data?: any }) => {
    switch (widget.type) {
        case 'statistic': return <StatisticRenderer widget={widget} data={data} />;
        case 'chart': return <ChartRenderer widget={widget} filters={filters} data={data} />;
        case 'table': return <TableRenderer widget={widget} data={data} />;
        case 'text': return <TextRenderer widget={widget} />;
        default: return <div>Unknown Widget Type</div>;
    }
};


// --- Main Engine ---

import { FilterEngine } from './FilterEngine';
import { useState, useEffect, useCallback, useRef } from 'react';

export const PageEngine = ({ schema }: { schema: PageSchema }) => {
    const [filterValues, setFilterValues] = useState<Record<string, any>>({});
    const [widgetData, setWidgetData] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(false);
    const abortRef = useRef<AbortController | null>(null);

    const handleFilterChange = useCallback((newValues: Record<string, any>) => {
        setFilterValues(prev => ({ ...prev, ...newValues }));
    }, []);

    const fetchWidgetData = useCallback(async () => {
        if (abortRef.current) abortRef.current.abort();
        abortRef.current = new AbortController();
        const signal = abortRef.current.signal;

        setLoading(true);
        const newData: Record<string, any> = {};
        const fetchPromises: Promise<void>[] = [];

        schema.rows.forEach((row, rIndex) => {
            row.columns.forEach((col, cIndex) => {
                const widget = col.widget;
                if (widget.dataSource) {
                    const widgetKey = `${rIndex}-${cIndex}`;

                    const fetchPromise = (async () => {
                        try {
                            let query = widget.dataSource!.query;

                            if (filterValues.dateRange) {
                                const start = dayjs(filterValues.dateRange[0]).format('YYYY-MM-DD');
                                const end = dayjs(filterValues.dateRange[1]).format('YYYY-MM-DD');
                                query = query.replace(/:start/g, `'${start}'`).replace(/:end/g, `'${end}'`);
                            }

                            Object.entries(filterValues).forEach(([key, value]) => {
                                if (key !== 'dateRange' && value !== undefined && value !== null) {
                                    query = query.replace(new RegExp(`:${key}`, 'g'), Array.isArray(value) ? value.map(v => `'${v}'`).join(',') : `'${value}'`);
                                } else if (value === null || value === undefined) {
                                    query = query.replace(new RegExp(`:${key}`, 'g'), 'NULL');
                                }
                            });

                            const response = await fetch('/api/lookup', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ dbPool: widget.dataSource!.dbPool, query }),
                                signal,
                            });

                            if (response.ok) {
                                const result = await response.json();
                                if (widget.type === 'statistic' && Array.isArray(result) && result.length > 0) {
                                    newData[widgetKey] = Object.values(result[0])[0];
                                } else {
                                    newData[widgetKey] = result;
                                }
                            }
                        } catch (error) {
                            if ((error as Error).name !== 'AbortError') {
                                console.error(`Failed to fetch data for widget ${rIndex}-${cIndex}:`, error);
                            }
                        }
                    })();
                    fetchPromises.push(fetchPromise);
                }
            });
        });

        await Promise.all(fetchPromises);
        setWidgetData(newData);
        setLoading(false);
    }, [filterValues, schema]);

    useEffect(() => {
        fetchWidgetData();
        return () => { if (abortRef.current) abortRef.current.abort(); };
    }, [filterValues, fetchWidgetData]);

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
