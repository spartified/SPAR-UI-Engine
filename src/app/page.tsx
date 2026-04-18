"use client";
import { Button, Card, Input, Form } from 'antd';
import { useAuth } from '@/core/auth/AuthProvider';
import { brandingConfig } from '@/branding.config';

export default function LoginPage() {
  const { login, loginWithKeycloak } = useAuth();
  const authMode = process.env.NEXT_PUBLIC_AUTH_MODE || 'credentials';

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundImage: `url('/login-bg.webp')`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }}>
      <Card style={{ width: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h1 style={{ color: brandingConfig.theme.primaryColor }}>{brandingConfig.appName}</h1>
          <p>Login to access the portal</p>
        </div>

        {authMode === 'keycloak' ? (
          <Button
            type="primary"
            block
            size="large"
            onClick={() => loginWithKeycloak()}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              height: '50px',
              fontSize: '16px'
            }}
          >
            <img
              src="https://www.keycloak.org/resources/images/keycloak_logo_480x135.png"
              alt="Keycloak"
              style={{ height: 20, filter: 'brightness(0) invert(1)' }}
            />
            Sign in with Keycloak
          </Button>
        ) : (
          <Form layout="vertical" onFinish={login}>
            <Form.Item label="Username" name="username" initialValue="admin">
              <Input />
            </Form.Item>
            <Form.Item label="Password" name="password" initialValue="admin">
              <Input.Password />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" block>
                Login (Dev Mode)
              </Button>
            </Form.Item>
          </Form>
        )}
      </Card>
    </div>
  );
}
