"use client";
import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Descriptions, Tag, Button, Spin, Typography, Space, QRCode, Modal } from 'antd';
import { LeftOutlined, EyeInvisibleOutlined, SyncOutlined, SettingOutlined, QrcodeOutlined } from '@ant-design/icons';
import { useRouter, useSearchParams } from 'next/navigation';

const { Title, Text } = Typography;

export default function SIMDetailsPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const iccid = searchParams.get('iccid');

    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [qrVisible, setQrVisible] = useState(false);

    useEffect(() => {
        let isMounted = true;
        const fetchData = async () => {
            if (!iccid) return;
            try {
                const res = await fetch(`/api/orion/euicc-profile?iccid=${iccid}`);
                if (res.ok) {
                    const json = await res.json();
                    if (isMounted) setData(json);
                } else {
                    console.error("Failed to load details");
                }
            } catch (e) {
                console.error("Error fetching detail", e);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchData();
        return () => { isMounted = false; };
    }, [iccid]);

    if (loading) {
        return <div style={{ padding: 40, textAlign: 'center' }}><Spin size="large" /></div>;
    }

    if (!data) return <div style={{ padding: 40 }}>Data not found for ICCID: {iccid}</div>;

    return (
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <div style={{ marginBottom: 16 }}>
                <Button type="link" icon={<LeftOutlined />} onClick={() => router.back()}>
                    Back to SIM Management
                </Button>
            </div>

            <Title level={3} style={{ marginBottom: 24 }}>SIM Profile Details</Title>

            <Row gutter={[24, 24]}>
                {/* Left Column */}
                <Col xs={24} lg={12}>
                    <Card title="General Information" style={{ marginBottom: 24, background: '#1f2937', borderColor: '#374151' }} headStyle={{ borderBottom: '1px solid #374151', color: '#f3f4f6' }}>
                        <Descriptions column={1} labelStyle={{ color: '#9ca3af', width: 200 }} contentStyle={{ color: '#f3f4f6', fontWeight: 500 }}>
                            <Descriptions.Item label="ICCID:">{data.iccid}</Descriptions.Item>
                            <Descriptions.Item label="Date Created (UTC):">{data.dateCreated}</Descriptions.Item>
                            <Descriptions.Item label="Company:">{data.company}</Descriptions.Item>
                            <Descriptions.Item label="Inventory Batch:">{data.inventory}</Descriptions.Item>
                            <Descriptions.Item label="Whitelist:">{data.whitelist}</Descriptions.Item>
                            <Descriptions.Item label="SIM Type:">{data.simType}</Descriptions.Item>
                            <Descriptions.Item label="SIM Status:">
                                <Tag color={data.simStatus === 'ACTIVATED' ? 'green' : 'blue'}>{data.simStatus}</Tag>
                            </Descriptions.Item>
                        </Descriptions>
                    </Card>

                    <Card title="eUICC (Remote) Profile" style={{ marginBottom: 24, background: '#1f2937', borderColor: '#374151' }} headStyle={{ borderBottom: '1px solid #374151', color: '#f3f4f6' }}>
                        <Descriptions column={1} labelStyle={{ color: '#9ca3af', width: 200 }} contentStyle={{ color: '#f3f4f6', fontWeight: 500 }}>
                            <Descriptions.Item label="Remote State:">
                                <Tag color={data.euicc.state === 'RELEASED' ? 'cyan' : 'default'}>{data.euicc.state}</Tag>
                            </Descriptions.Item>
                            <Descriptions.Item label="Last Operation:">{data.euicc.lastOperationDate}</Descriptions.Item>
                            <Descriptions.Item label="Activation Code:">
                                <Space>
                                    <Text style={{ color: '#f3f4f6' }} copyable>{data.euicc.activationCode}</Text>
                                    <Button
                                        size="small"
                                        type="primary"
                                        icon={<QrcodeOutlined />}
                                        onClick={() => setQrVisible(true)}
                                        disabled={!data.euicc.activationCode || data.euicc.activationCode === 'N/A' || data.euicc.activationCode.includes('*')}
                                    >
                                        Show QR
                                    </Button>
                                </Space>
                            </Descriptions.Item>
                            <Descriptions.Item label="Reuse Remaining:">{data.euicc.reuseRemaining}</Descriptions.Item>
                            <Descriptions.Item label="EID:">{data.euicc.eid}</Descriptions.Item>
                        </Descriptions>
                    </Card>
                </Col>

                {/* Right Column */}
                <Col xs={24} lg={12}>
                    <Card title="Provisioning Status" style={{ marginBottom: 24, background: '#1f2937', borderColor: '#374151' }} headStyle={{ borderBottom: '1px solid #374151', color: '#f3f4f6' }}>
                        <Descriptions column={1} labelStyle={{ color: '#9ca3af', width: 100 }} contentStyle={{ color: '#f3f4f6', fontWeight: 500 }}>
                            <Descriptions.Item label="Data:">{data.services?.data || 'Enabled'}</Descriptions.Item>
                            <Descriptions.Item label="SMS:">{data.services?.sms || 'Enabled'}</Descriptions.Item>
                            <Descriptions.Item label="Voice:">{data.services?.voice || 'Enabled'}</Descriptions.Item>
                        </Descriptions>
                    </Card>

                    <Card title="Network Identity" style={{ marginBottom: 24, background: '#1f2937', borderColor: '#374151' }} headStyle={{ borderBottom: '1px solid #374151', color: '#f3f4f6' }}>
                        <Descriptions column={1} labelStyle={{ color: '#9ca3af', width: 150 }} contentStyle={{ color: '#f3f4f6', fontWeight: 500 }}>
                            <Descriptions.Item label="Mapped IMSI:">{data.mappedImsi}</Descriptions.Item>
                        </Descriptions>
                    </Card>

                    <Card title="MSISDNs" style={{ marginBottom: 24, background: '#1f2937', borderColor: '#374151' }} headStyle={{ borderBottom: '1px solid #374151', color: '#f3f4f6' }}>
                        <Text style={{ color: '#f3f4f6' }}>{data.msisdns?.length > 0 ? data.msisdns.join(', ') : 'No MSISDN Assigned'}</Text>
                    </Card>

                    <Card title="APNs" extra={<SyncOutlined style={{ color: '#9ca3af', cursor: 'pointer' }} />} style={{ marginBottom: 24, background: '#1f2937', borderColor: '#374151' }} headStyle={{ borderBottom: '1px solid #374151', color: '#f3f4f6' }}>
                        <Space wrap>
                            {(data.apns || ['globaldata']).map((apn: string) => (
                                <Tag color="blue" key={apn} style={{ border: '1px solid #3b82f6', background: 'transparent' }}>
                                    {apn}
                                </Tag>
                            ))}
                        </Space>
                    </Card>
                </Col>
            </Row>

            <Modal
                title="eSIM Activation QR Code"
                open={qrVisible}
                onCancel={() => setQrVisible(false)}
                footer={null}
                centered
            >
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    <QRCode
                        value={data.euicc.activationCode}
                        size={250}
                        bordered={false}
                        errorLevel="H"
                    />
                    <div style={{ marginTop: 20 }}>
                        <Text strong>{data.iccid}</Text>
                        <br />
                        <Text type="secondary">Scan this code with your device to install the profile.</Text>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
