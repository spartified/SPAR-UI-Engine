import {
    BarChartOutlined,
    GlobalOutlined,
    TeamOutlined,
    HistoryOutlined,
    DashboardOutlined,
    ApartmentOutlined,
    ClusterOutlined,
    DatabaseOutlined,
    BarcodeOutlined,
    GiftOutlined,
} from '@ant-design/icons';
import React from 'react';

export interface ModuleDefinition {
    id: string;
    title: string;
    path: string;
    category: string;
    icon?: React.ReactNode;
    permission: string;
    schema?: string;
    dbPool?: string;
    externalUrl?: string;
}

export const ICON_MAP: Record<string, React.ReactNode> = {
    BarChartOutlined: React.createElement(BarChartOutlined),
    GlobalOutlined: React.createElement(GlobalOutlined),
    TeamOutlined: React.createElement(TeamOutlined),
    HistoryOutlined: React.createElement(HistoryOutlined),
    DashboardOutlined: React.createElement(DashboardOutlined),
    ApartmentOutlined: React.createElement(ApartmentOutlined),
    ClusterOutlined: React.createElement(ClusterOutlined),
    DatabaseOutlined: React.createElement(DatabaseOutlined),
    BarcodeOutlined: React.createElement(BarcodeOutlined),
    GiftOutlined: React.createElement(GiftOutlined),
};

export const PLATFORM_MODULES: ModuleDefinition[] = [
    {
        id: 'user-management',
        title: 'User Management',
        path: '/configuration/users',
        category: 'User Management',
        permission: 'user:manage',
        schema: '/schemas/users.json',
        dbPool: 'CORE'
    },
    {
        id: 'audit-trail',
        title: 'Audit Trail',
        path: '/admin/audit-trail',
        category: 'Audit Trail',
        permission: 'audit:read',
        schema: '/schemas/audit-trail.json',
        dbPool: 'CORE'
    },
    {
        id: 'monitor-server',
        title: 'Server Monitoring',
        path: '/monitor/server',
        category: 'Monitoring',
        permission: 'grafana:server',
        externalUrl: process.env.NEXT_PUBLIC_GRAFANA_URL_SERVER
    },
    {
        id: 'monitor-database',
        title: 'Database Monitoring',
        path: '/monitor/database',
        category: 'Monitoring',
        permission: 'grafana:db',
        externalUrl: process.env.NEXT_PUBLIC_GRAFANA_URL_DB
    },
    {
        id: 'monitor-app',
        title: 'Application Metrics',
        path: '/monitor/application',
        category: 'Monitoring',
        permission: 'grafana:app',
        externalUrl: process.env.NEXT_PUBLIC_GRAFANA_URL_APP
    },
    {
        id: 'api-key-management',
        title: 'Developer API Keys',
        path: '/configuration/api-keys',
        category: 'Hidden',
        permission: 'api-key:manage',
        dbPool: 'CORE'
    },
];

export const PLATFORM_CATEGORIES = [
    { id: 'Reports', title: 'Reports', icon: ICON_MAP.BarChartOutlined },
    { id: 'User Management', title: 'User Management', icon: ICON_MAP.TeamOutlined },
    { id: 'Audit Trail', title: 'Audit Trail', icon: ICON_MAP.HistoryOutlined },
    { id: 'Monitoring', title: 'Monitoring', icon: ICON_MAP.GlobalOutlined },
];

// Fallback for parts of the app still using static imports
export const MODULE_REGISTRY = [...PLATFORM_MODULES];
export const CATEGORIES = [...PLATFORM_CATEGORIES];
