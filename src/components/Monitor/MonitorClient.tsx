"use client";
import { brandingConfig } from '@/branding.config';
import { Result, Spin } from 'antd';
import { useEffect, useState } from 'react';

interface MonitorClientProps {
    title: string;
    url?: string;
}

export default function MonitorClient({ title, url }: MonitorClientProps) {
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        const timer = setTimeout(() => {
            setLoading(false);
        }, 1000);
        return () => clearTimeout(timer);
    }, [url]);

    if (!url) {
        return (
            <Result
                status="warning"
                title="Configuration Missing"
                subTitle={`No external URL configured for ${title}. Please check your environment variables.`}
            />
        );
    }

    return (
        <div style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
            <h1 style={{ marginBottom: 16 }}>{title}</h1>

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
                        src={url}
                        title={title}
                        width="100%"
                        height="100%"
                        frameBorder="0"
                    />
                </div>
            )}
        </div>
    );
}
