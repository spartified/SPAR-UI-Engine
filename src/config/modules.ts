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


export const MODULE_REGISTRY: ModuleDefinition[] = [
    // ----------------------------------------------------------------
    // Platform-level modules (generic, always present)
    // Product-specific modules are injected by their deploy.sh script
    // ----------------------------------------------------------------
    {
        id: 'kpi-report',
        title: 'Telecom KPI',
        path: '/reports/kpi',
        category: 'Reports',
        permission: 'report:telecom:read',
        schema: '/schemas/kpi-report-v2.json'
    },
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
    // PRODUCT_MODULES_START — do not remove this comment, used by deploy scripts
    // --- Orion CMP Modules (injected by deploy.sh) ---
    {
        id: 'orion-dashboard',
        title: 'Dashboard',
        path: '/dashboard',
        category: 'OrionDashboard',
        permission: 'orion:dashboard:read',
        schema: '/schemas/orion-dashboard.json',
        dbPool: 'ORION'
    },
    {
        id: 'orion-accounts',
        title: 'Accounts',
        path: '/accounts',
        category: 'OrionAccounts',
        permission: 'orion:account:manage',
        schema: '/schemas/orion-accounts.json',
        dbPool: 'ORION'
    },
    {
        id: 'orion-aggregators',
        title: 'Aggregator Management',
        path: '/aggregators',
        category: 'OrionAggregators',
        permission: 'orion:aggregator:manage',
        schema: '/schemas/orion-aggregators.json',
        dbPool: 'ORION'
    },
    {
        id: 'orion-users',
        title: 'Users',
        path: '/users',
        category: 'OrionUsers',
        permission: 'orion:user:manage',
        schema: '/schemas/orion-users.json',
        dbPool: 'ORION'
    },
    {
        id: 'orion-inventory',
        title: 'eSIM Inventory',
        path: '/inventory',
        category: 'OrionInventory',
        permission: 'orion:inventory:manage',
        schema: '/schemas/orion-inventory.json',
        dbPool: 'ORION'
    },
    {
        id: 'orion-esims',
        title: 'SIM Management',
        path: '/esims',
        category: 'OrionSIMs',
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
    {
        id: 'api-keys',
        title: 'Developer API Key',
        path: '/admin/api-keys',
        category: 'Administration',
        permission: 'api-key:manage',
        schema: '/schemas/api-keys.json',
        dbPool: 'CORE'
    },
    // PRODUCT_MODULES_END
];

export const CATEGORIES = [
    // ----------------------------------------------------------------
    // Platform-level categories (generic)
    // Product-specific categories are injected by their deploy.sh script
    // ----------------------------------------------------------------
    { id: 'Reports', title: 'Reports', icon: React.createElement(BarChartOutlined) },
    { id: 'User Management', title: 'User Management', icon: React.createElement(TeamOutlined) },
    { id: 'Administration', title: 'Administration', icon: React.createElement(HistoryOutlined) },
    { id: 'Audit Trail', title: 'Audit Trail', icon: React.createElement(HistoryOutlined) },
    { id: 'Monitoring', title: 'Monitoring', icon: React.createElement(GlobalOutlined) },
    // PRODUCT_CATEGORIES_START — do not remove this comment, used by deploy scripts
    // --- Orion CMP Categories (injected by deploy.sh) ---
    { id: 'OrionDashboard', title: 'Dashboard', icon: React.createElement(DashboardOutlined) },
    { id: 'OrionAccounts', title: 'Accounts', icon: React.createElement(ApartmentOutlined) },
    { id: 'OrionAggregators', title: 'Aggregators', icon: React.createElement(ClusterOutlined) },
    { id: 'OrionInventory', title: 'eSIM Inventory', icon: React.createElement(DatabaseOutlined) },
    { id: 'OrionSIMs', title: 'SIM Management', icon: React.createElement(BarcodeOutlined) },
    { id: 'OrionPackages', title: 'Packages', icon: React.createElement(GiftOutlined) },
    { id: 'OrionUsers', title: 'Orion Users', icon: React.createElement(TeamOutlined) },
    // PRODUCT_CATEGORIES_END
];
