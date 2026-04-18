"use client";

import React, { useMemo } from 'react';
import { Table, TableProps } from 'antd';

interface TableRendererProps extends TableProps<any> {
    // Add any common custom props here
}

/**
 * A shared high-performance table renderer that wraps Ant Design Table
 * and applies consistent platform styling, pagination, and empty states.
 */
export const TableRenderer: React.FC<TableRendererProps> = ({
    columns,
    dataSource,
    loading,
    rowKey = 'id',
    ...rest
}) => {
    // Add common sorters/filters if not provided
    const enrichedColumns = useMemo(() => {
        return columns?.map((col: any) => ({
            ...col,
            sortDirections: ['descend', 'ascend'] as any,
        }));
    }, [columns]);

    return (
        <Table
            columns={enrichedColumns}
            dataSource={dataSource}
            loading={loading}
            rowKey={rowKey}
            pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showTotal: (total) => `Total ${total} items`,
                style: { paddingRight: 16 }
            }}
            size="middle"
            {...rest}
        />
    );
};
