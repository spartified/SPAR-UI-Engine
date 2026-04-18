"use client";
import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Descriptions, Tag, Button, Spin, Typography, Space } from 'antd';
import { LeftOutlined, EyeInvisibleOutlined, SyncOutlined, SettingOutlined } from '@ant-design/icons';
import { useRouter, useSearchParams } from 'next/navigation';

const { Title, Text } = Typography;

export default function SIMDetailsPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const iccid = searchParams.get('iccid');

    // We mock the API for now based on instructions
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);

    useEffect(() => {
        // Mock server fetch
        setTimeout(() => {
            setData({
                iccid: iccid || '8910300000059191074',
                dateCreated: '2026-04-02 17:28:48',
                company: '72880 (Spartified.com)',
                inventory: '52267 (Spartified.com Inventory 1)',
                whitelist: '12238 (Spartified.com Inventory 1-CLASSIC)',
                simType: 'eSIM',
                simStatus: 'Pre-Service',
                mappedImsi: '312300051515226',
                euicc: {
                    state: 'RELEASED',
                    lastOperationDate: '2026-03-06 12:39:19',
                    activationCode: '******************************',
                    reuseRemaining: 5,
                    reuseEnabled: 'Yes',
                    profileReusePolicy: 'Reuse Type: SAME_EID_MID\\nMax Count: 5',
                    releaseDate: '2026-03-06 12:39:19',
                    confirmationCodeReq: 'No',
                    confirmationCodeRetries: 'N/A',
                    eid: 'N/A'
                },
                services: {
                    data: 'Enabled',
                    sms: 'Enabled',
                    voice: 'Enabled'
                },
                msisdns: [],
                apns: ['globaldata', 'rh', 'isp', 'altanwifi', 'plus', 'internet', 'tn1', 'orange', 'orange.fr']
            });
            setLoading(false);
        }, 800);
    }, [iccid]);

    if (loading) {
        return <div style={{ padding: 40, textAlign: 'center' }}><Spin size="large" /></div>;
    }

    if (!data) return <div>Data not found</div>;

    return (
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <div style={{ marginBottom: 16 }}>
                <Button type="link" icon={<LeftOutlined />} onClick={() => router.back()}>
                    Back to SIM Management
                </Button>
            </div>

            <Title level={3} style={{ marginBottom: 24 }}>Overview</Title>

            <Row gutter={[24, 24]}>
                {/* Left Column */}
                <Col xs={24} lg={12}>
                    <Card title="General" style={{ marginBottom: 24, background: '#1f2937', borderColor: '#374151' }} headStyle={{ borderBottom: '1px solid #374151', color: '#f3f4f6' }}>
                        <Descriptions column={1} labelStyle={{ color: '#9ca3af', width: 200 }} contentStyle={{ color: '#f3f4f6', fontWeight: 500 }}>
                            <Descriptions.Item label="ICCID:">{data.iccid}</Descriptions.Item>
                            <Descriptions.Item label="Date Created (UTC):">{data.dateCreated}</Descriptions.Item>
                            <Descriptions.Item label="Company:">{data.company}</Descriptions.Item>
                            <Descriptions.Item label="Inventory:">{data.inventory}</Descriptions.Item>
                            <Descriptions.Item label="Whitelist:">{data.whitelist}</Descriptions.Item>
                            <Descriptions.Item label="SIM Type:">{data.simType}</Descriptions.Item>
                            <Descriptions.Item label="SIM Status:">
                                <Space>
                                    {data.simStatus}
                                    <SettingOutlined style={{ color: '#9ca3af', cursor: 'pointer' }} />
                                </Space>
                            </Descriptions.Item>
                        </Descriptions>
                    </Card>

                    <Card title="EUICC Profile" style={{ marginBottom: 24, background: '#1f2937', borderColor: '#374151' }} headStyle={{ borderBottom: '1px solid #374151', color: '#f3f4f6' }}>
                        <Descriptions column={1} labelStyle={{ color: '#9ca3af', width: 200 }} contentStyle={{ color: '#f3f4f6', fontWeight: 500 }}>
                            <Descriptions.Item label="State:">{data.euicc.state}</Descriptions.Item>
                            <Descriptions.Item label="Last Operation Date:">{data.euicc.lastOperationDate}</Descriptions.Item>
                            <Descriptions.Item label="Activation Code:">
                                <Space>
                                    <Text style={{ color: '#f3f4f6' }}>{data.euicc.activationCode}</Text>
                                    <a style={{ fontSize: 12 }}><EyeInvisibleOutlined /> Show QR Code</a>
                                </Space>
                            </Descriptions.Item>
                            <Descriptions.Item label="Reuse Remaining Count:">{data.euicc.reuseRemaining}</Descriptions.Item>
                            <Descriptions.Item label="Reuse Enabled:">{data.euicc.reuseEnabled}</Descriptions.Item>
                            <Descriptions.Item label="Profile Reuse Policy:">
                                <span style={{ whiteSpace: 'pre-line' }}>{data.euicc.profileReusePolicy}</span>
                            </Descriptions.Item>
                            <Descriptions.Item label="Release Date:">{data.euicc.releaseDate}</Descriptions.Item>
                            <Descriptions.Item label="Confirmation Code Required:">{data.euicc.confirmationCodeReq}</Descriptions.Item>
                            <Descriptions.Item label="Confirmation Code Retries:">{data.euicc.confirmationCodeRetries}</Descriptions.Item>
                            <Descriptions.Item label="EID:">{data.euicc.eid}</Descriptions.Item>
                        </Descriptions>
                    </Card>
                </Col>

                {/* Right Column */}
                <Col xs={24} lg={12}>
                    <Card title="Service Status" extra={<SettingOutlined style={{ color: '#9ca3af', cursor: 'pointer' }} />} style={{ marginBottom: 24, background: '#1f2937', borderColor: '#374151' }} headStyle={{ borderBottom: '1px solid #374151', color: '#f3f4f6' }}>
                        <Descriptions column={1} labelStyle={{ color: '#9ca3af', width: 100 }} contentStyle={{ color: '#f3f4f6', fontWeight: 500 }}>
                            <Descriptions.Item label="Data:">{data.services.data}</Descriptions.Item>
                            <Descriptions.Item label="SMS:">{data.services.sms}</Descriptions.Item>
                            <Descriptions.Item label="Voice:">{data.services.voice}</Descriptions.Item>
                        </Descriptions>
                    </Card>

                    <Card title="Mapped IMSI" style={{ marginBottom: 24, background: '#1f2937', borderColor: '#374151' }} headStyle={{ borderBottom: '1px solid #374151', color: '#f3f4f6' }}>
                        <Descriptions column={1} labelStyle={{ color: '#9ca3af', width: 150 }} contentStyle={{ color: '#f3f4f6', fontWeight: 500 }}>
                            <Descriptions.Item label="Mapped IMSI:">{data.mappedImsi}</Descriptions.Item>
                        </Descriptions>
                    </Card>

                    <Card title="MSISDNs" style={{ marginBottom: 24, background: '#1f2937', borderColor: '#374151' }} headStyle={{ borderBottom: '1px solid #374151', color: '#f3f4f6' }}>
                        <Text style={{ color: '#9ca3af' }}>{data.msisdns.length > 0 ? data.msisdns.join(', ') : 'No MSISDN Assigned'}</Text>
                    </Card>

                    <Card title="APNs" extra={<SyncOutlined style={{ color: '#9ca3af', cursor: 'pointer' }} />} style={{ marginBottom: 24, background: '#1f2937', borderColor: '#374151' }} headStyle={{ borderBottom: '1px solid #374151', color: '#f3f4f6' }}>
                        <Space wrap>
                            {data.apns.map((apn: string) => (
                                <Tag color="blue" key={apn} style={{ border: '1px solid #3b82f6', background: 'transparent' }}>
                                    {apn}
                                </Tag>
                            ))}
                        </Space>
                    </Card>
                </Col>
            </Row>
        </div>
    );
}
