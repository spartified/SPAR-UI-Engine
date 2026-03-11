"use client";
import React from 'react';
import { DatePicker, Space, Select } from 'antd';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { brandingConfig } from '@/branding.config';

const { RangePicker } = DatePicker;

// --- Filter Types ---

export type FilterType = 'dateRange' | 'select' | 'text';

export interface FilterConfig {
    key: string;
    type: FilterType;
    label?: string;
    defaultValue?: any;
    options?: { label: string; value: any }[]; // For select
    dataSource?: string; // API endpoint for dynamic options
    lookup?: {
        dbPool: string;
        query: string;
    };
    placeholder?: string;
}

interface FilterEngineProps {
    filters: FilterConfig[];
    onFilterChange: (values: Record<string, any>) => void;
}

// --- Date Range Presets ---

const dateRangePresets: { label: string; value: [Dayjs, Dayjs] }[] = [
    { label: 'Today', value: [dayjs(), dayjs()] },
    { label: 'Yesterday', value: [dayjs().subtract(1, 'day'), dayjs().subtract(1, 'day')] },
    { label: 'Last 7 Days', value: [dayjs().subtract(6, 'day'), dayjs()] },
    { label: 'Last 30 Days', value: [dayjs().subtract(29, 'day'), dayjs()] },
    { label: 'This Month', value: [dayjs().startOf('month'), dayjs().endOf('month')] },
    { label: 'Last Month', value: [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')] },
    { label: 'This Year', value: [dayjs().startOf('year'), dayjs()] },
];

// --- Component ---

export const FilterEngine = ({ filters, onFilterChange }: FilterEngineProps) => {
    // State to track dynamic options and current values
    const [dynamicOptions, setDynamicOptions] = React.useState<Record<string, { label: string; value: any }[]>>({});
    const [filterValues, setFilterValues] = React.useState<Record<string, any>>({});

    React.useEffect(() => {
        const initialValues: Record<string, any> = {};

        const fetchLookups = async () => {
            for (const filter of filters) {
                // Handle Default Values
                if (filter.defaultValue) {
                    if (filter.type === 'dateRange') {
                        if (filter.defaultValue === 'yesterday') {
                            initialValues[filter.key] = [dayjs().subtract(1, 'day'), dayjs().subtract(1, 'day')];
                        } else if (filter.defaultValue === 'last7Days') {
                            initialValues[filter.key] = [dayjs().subtract(6, 'day'), dayjs()];
                        } else if (filter.defaultValue === 'thisMonth') {
                            initialValues[filter.key] = [dayjs().startOf('month'), dayjs().endOf('month')];
                        }
                    } else {
                        initialValues[filter.key] = filter.defaultValue;
                    }
                }

                // Handle SQL-backed Lookups
                if (filter.type === 'select' && filter.lookup) {
                    try {
                        const response = await fetch('/api/lookup', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(filter.lookup),
                        });
                        if (response.ok) {
                            const result = await response.json();
                            setDynamicOptions(prev => ({
                                ...prev,
                                [filter.key]: result
                            }));
                        }
                    } catch (error) {
                        console.error(`Failed to fetch lookup for filter ${filter.key}:`, error);
                    }
                }

                // Handle Dynamic Options (Legacy Mock)
                else if (filter.type === 'select' && filter.dataSource) {
                    // Simulate API call based on dataSource
                    console.log(`Fetching options for ${filter.key} from ${filter.dataSource}`);
                    setTimeout(() => {
                        const mockData = filter.dataSource === '/api/regions'
                            ? [
                                { label: 'North Region', value: 'north' },
                                { label: 'South Region', value: 'south' },
                                { label: 'East Region', value: 'east' },
                                { label: 'West Region', value: 'west' },
                            ]
                            : [];
                        setDynamicOptions(prev => ({ ...prev, [filter.key]: mockData }));
                    }, 500);
                }
            }

            // Set initial values and notify parent
            if (Object.keys(initialValues).length > 0) {
                setFilterValues(initialValues);
                // We need to convert Dayjs to strings for the parent callback to match protocol
                const formattedValues: Record<string, any> = {};
                Object.entries(initialValues).forEach(([k, v]) => {
                    if (Array.isArray(v) && dayjs.isDayjs(v[0])) {
                        formattedValues[k] = [v[0].toISOString(), v[1].toISOString()];
                    } else {
                        formattedValues[k] = v;
                    }
                });
                onFilterChange(formattedValues);
            }
        };

        fetchLookups();
    }, []); // Run once on mount

    const handleDateChange = (key: string, dates: any) => {
        // Antd RangePicker returns [Dayjs, Dayjs] or null
        // We can serialize this to strings if needed, or pass Dayjs objects.
        // Let's pass standard ISO strings for API compatibility.
        if (dates) {
            onFilterChange({
                [key]: [dates[0].toISOString(), dates[1].toISOString()]
            });
        } else {
            onFilterChange({ [key]: null });
        }
    };

    const handleSelectChange = (key: string, value: any) => {
        setFilterValues(prev => ({ ...prev, [key]: value }));
        onFilterChange({ [key]: value });
    };

    return (
        <Space wrap style={{ marginBottom: 16, padding: '12px 16px', background: brandingConfig.theme.componentBg, borderRadius: 8, width: '100%' }}>
            {filters.map((filter) => {
                switch (filter.type) {
                    case 'dateRange':
                        return (
                            <Space key={filter.key} direction="vertical" size={2}>
                                {filter.label && <span style={{ color: brandingConfig.theme.textColor, fontSize: 12 }}>{filter.label}</span>}
                                <RangePicker
                                    presets={dateRangePresets}
                                    format="MM/DD/YYYY"
                                    value={filterValues[filter.key] as any}
                                    onChange={(dates) => handleDateChange(filter.key, dates)}
                                    style={{ width: 280 }}
                                />
                            </Space>
                        );
                    case 'select':
                        return (
                            <Space key={filter.key} direction="vertical" size={2}>
                                {filter.label && <span style={{ color: brandingConfig.theme.textColor, fontSize: 12 }}>{filter.label}</span>}
                                <Select
                                    placeholder={filter.placeholder || "Select"}
                                    options={filter.dataSource ? dynamicOptions[filter.key] : filter.options}
                                    value={filterValues[filter.key]}
                                    onChange={(val) => handleSelectChange(filter.key, val)}
                                    style={{ width: 200 }}
                                    allowClear
                                />
                            </Space>
                        );
                    default:
                        return null;
                }
            })}
        </Space>
    );
};
