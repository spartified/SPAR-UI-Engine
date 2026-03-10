"use client";
import { useAuth } from '@/core/auth/AuthProvider';
import { Result, Button, Spin } from 'antd';
import { brandingConfig } from '@/branding.config';
import { MODULE_REGISTRY } from '@/config/modules';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function DynamicMonitorPage() {
    const { user } = useAuth();
    const pathname = usePathname();
    const [loading, setLoading] = useState(true);

    const currentModule = MODULE_REGISTRY.find(m => m.path === pathname);

    useEffect(() => {
        setLoading(true);
        const timer = setTimeout(() => {
            setLoading(false);
        }, 1000);
        return () => clearTimeout(timer);
    }, [pathname]);

    if (!currentModule || !user?.permissions?.includes(currentModule.permission)) {
        return (
            <Result
                status="403"
                title="403"
                subTitle="Sorry, you are not authorized to access this Monitoring dashboard."
                extra={<Button type="primary" href="/dashboard">Back Home</Button>}
            />
        );
    }

    const finalUrl = currentModule.externalUrl;

    if (!finalUrl) {
        return (
            <Result
                status="warning"
                title="Configuration Missing"
                subTitle={`No external URL configured for ${currentModule.title}. Please check your environment variables.`}
            />
        );
    }

    return (
        <div style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
            <h1 style={{ marginBottom: 16 }}>{currentModule.title}</h1>

            {loading ? (
                <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <Spin size="large" />
                </div>
            ) : (
                <div style={{
                    flex: 1,
                    border: `1px solid ${brandingConfig.theme.primaryColor}`,
                    borderRadius: 8,
                    overflow: 'hidden',
                    background: '#111',
                    position: 'relative'
                }}>
                    <iframe
                        src={finalUrl}
                        title={currentModule.title}
                        width="100%"
                        height="100%"
                        frameBorder="0"
                    />
                </div>
            )}
        </div>
    );
}
