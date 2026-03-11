"use client";
import { PageEngine } from '@/components/Engines/PageEngine';
import gtpSessionStatsSchema from '@/schemas/gtp-session-stats.json';

export default function GTPSessionStatsReportPage() {
    return <PageEngine schema={gtpSessionStatsSchema as any} />;
}
