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
    MobileOutlined,
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
    MobileOutlined: React.createElement(MobileOutlined),
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

export const ORION_MODULES: ModuleDefinition[] = [
    {
        id: 'orion-dashboard',
        title: 'Dashboard',
        path: '/dashboard',
        category: 'Orion',
        permission: 'orion:dashboard:read',
        schema: '/schemas/orion-dashboard.json',
        dbPool: 'ORION'
    },
    {
        id: 'orion-accounts',
        title: 'Accounts',
        path: '/accounts',
        category: 'Orion',
        permission: 'orion:account:manage',
        schema: '/schemas/orion-accounts.json',
        dbPool: 'ORION'
    },
    {
        id: 'orion-users',
        title: 'Orion Users',
        path: '/users',
        category: 'Orion',
        permission: 'orion:user:manage',
        schema: '/schemas/orion-users.json',
        dbPool: 'ORION'
    },
    {
        id: 'orion-inventory',
        title: 'eSIM Inventory',
        path: '/inventory',
        category: 'Orion',
        permission: 'orion:inventory:manage',
        schema: '/schemas/orion-inventory.json',
        dbPool: 'ORION'
    },
    {
        id: 'orion-esims',
        title: 'SIM Management',
        path: '/esims',
        category: 'Orion',
        permission: 'orion:esim:manage',
        schema: '/schemas/orion-esims.json',
        dbPool: 'ORION'
    },
    {
        id: 'orion-packages',
        title: 'Package Management',
        path: '/packages',
        category: 'OrionPackages',
        permission: 'orion:package:manage',
        dbPool: 'ORION'
    },
];

export const PLATFORM_CATEGORIES = [
    { id: 'Reports', title: 'Reports', icon: ICON_MAP.BarChartOutlined },
    { id: 'User Management', title: 'User Management', icon: ICON_MAP.TeamOutlined },
    { id: 'Audit Trail', title: 'Audit Trail', icon: ICON_MAP.HistoryOutlined },
    { id: 'Monitoring', title: 'Monitoring', icon: ICON_MAP.GlobalOutlined },
    { id: 'Orion', title: 'Orion CMP', icon: ICON_MAP.MobileOutlined },
];

// Fallback for parts of the app still using static imports
export const MODULE_REGISTRY = [...PLATFORM_MODULES, ...ORION_MODULES];
export const CATEGORIES = [...PLATFORM_CATEGORIES];
