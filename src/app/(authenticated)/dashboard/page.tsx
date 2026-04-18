"use client";
import { PageEngine } from '@/components/Engines/PageEngine';
import dashboardSchema from '@/schemas/orion-dashboard.json';

export default function OrionDashboardPage() {
    return <PageEngine schema={dashboardSchema as any} />;
}
