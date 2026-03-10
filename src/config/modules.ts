import {
    DashboardOutlined,
    BarChartOutlined,
    SettingOutlined,
    GlobalOutlined,
    TeamOutlined,
    HistoryOutlined
} from '@ant-design/icons';
import React from 'react';

export interface ModuleDefinition {
    id: string;
    title: string;
    path: string;
    category: 'Dashboard' | 'GTP Proxy' | 'Reports' | 'Monitoring' | 'User Management' | 'Audit Trail' | 'Configuration';
    icon?: React.ReactNode;
    permission: string;
    schema?: string;
    dbPool?: string;
    externalUrl?: string;
}


export const MODULE_REGISTRY: ModuleDefinition[] = [
    {
        id: 'dashboard',
        title: 'Dashboard',
        path: '/dashboard',
        category: 'Dashboard',
        permission: 'dashboard:read',
        dbPool: 'CORE'
    },
    {
        id: 'kpi-report',
        title: 'Telecom KPI',
        path: '/reports/kpi',
        category: 'Reports',
        permission: 'report:telecom:read',
        schema: '/schemas/kpi-report-v2.json'
    },
    {
        id: 'node-config',
        title: 'Network Nodes',
        path: '/configuration/nodes',
        category: 'Configuration',
        permission: 'node:read',
        schema: '/schemas/node-config.json',
        dbPool: 'CORE'
    },
    {
        id: 'gtp-imsi-range',
        title: 'GTP IMSI Ranges',
        path: '/configuration/gtp-imsi-range',
        category: 'GTP Proxy',
        permission: 'gtp:imsi:manage',
        schema: '/schemas/gtp-imsi-range.json',
        dbPool: 'GTP_PROXY'
    },
    {
        id: 'gtp-mccmnc-mapping',
        title: 'MCC-MNC Mappings',
        path: '/configuration/gtp-mccmnc-mapping',
        category: 'GTP Proxy',
        permission: 'gtp:mapping:manage',
        schema: '/schemas/gtp-mccmnc-mapping.json',
        dbPool: 'GTP_PROXY'
    },
    {
        id: 'gtp-session-mgmt',
        title: 'GTP Session Mgmt',
        path: '/configuration/gtp-session-mgmt',
        category: 'GTP Proxy',
        permission: 'gtp:session:manage',
        schema: '/schemas/gtp-session-mgmt.json',
        dbPool: 'GTP_PROXY'
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
        permission: 'user:manage',
        schema: '/schemas/audit-trail.json',
        dbPool: 'CORE'
    },
    {
        id: 'monitor-server',
        title: 'Server Monitoring',
        path: '/monitor/server',
        category: 'Monitoring',
        permission: 'grafana',
        externalUrl: process.env.NEXT_PUBLIC_GRAFANA_URL_SERVER
    },
    {
        id: 'monitor-database',
        title: 'Database Monitoring',
        path: '/monitor/database',
        category: 'Monitoring',
        permission: 'grafana',
        externalUrl: process.env.NEXT_PUBLIC_GRAFANA_URL_DB
    },
    {
        id: 'monitor-app',
        title: 'Application Metrics',
        path: '/monitor/application',
        category: 'Monitoring',
        permission: 'grafana',
        externalUrl: process.env.NEXT_PUBLIC_GRAFANA_URL_APP
    }
];

export const CATEGORIES = [
    { id: 'Dashboard', title: 'Dashboard', icon: React.createElement(DashboardOutlined) },
    { id: 'Reports', title: 'Reports', icon: React.createElement(BarChartOutlined) },
    { id: 'Configuration', title: 'Configuration', icon: React.createElement(SettingOutlined) },
    { id: 'GTP Proxy', title: 'GTP Proxy', icon: React.createElement(GlobalOutlined) },
    { id: 'User Management', title: 'User Management', icon: React.createElement(TeamOutlined) },
    { id: 'Audit Trail', title: 'Audit Trail', icon: React.createElement(HistoryOutlined) },
    { id: 'Monitoring', title: 'Monitoring', icon: React.createElement(GlobalOutlined) }
];

