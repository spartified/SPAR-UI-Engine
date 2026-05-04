"use client";
import React, { useState, useMemo, useEffect, useRef } from "react";
import { Layout, Menu, Button, Avatar, Dropdown, Tooltip } from "antd";
import {
    MenuFoldOutlined,
    MenuUnfoldOutlined,
    UserOutlined,
    LogoutOutlined,
    SettingOutlined,
    BulbOutlined,
    BulbFilled,
} from "@ant-design/icons";
import { brandingConfig } from "@/branding.config";
import { useAuth } from "@/core/auth/AuthProvider";
import { useRouter, usePathname } from "next/navigation";
import { useTheme } from "@/context/ThemeContext";

import { TenantSwitcher } from "./TenantSwitcher";
import { useModules } from "@/context/ModuleContext";


const { Header, Sider, Content } = Layout;

export const AppShell = ({ children }: { children: React.ReactNode }) => {
    return <AppShellContent>{children}</AppShellContent>;
};

const AppShellContent = ({ children }: { children: React.ReactNode }) => {
    const [collapsed, setCollapsed] = useState(false);
    const { logout, user, loading } = useAuth();
    const loadingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const { mode, toggleTheme, theme } = useTheme();
    const { modules, categories, isLoading: modulesLoading } = useModules();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (loading) {
            loadingTimer.current = setTimeout(() => {
                // Session stuck — log out and redirect
                router.push('/');
            }, 10_000);
        } else {
            if (loadingTimer.current) clearTimeout(loadingTimer.current);
        }
        return () => { if (loadingTimer.current) clearTimeout(loadingTimer.current); };
    }, [loading, router]);

    // Memoize menuItems so it's only recomputed when permissions change, not on every render
    const menuItems: any[] = useMemo(() => categories.map((category: any) => {
        const children = modules
            .filter(module => module.category === category.id && user?.permissions?.includes(module.permission))
            .map(module => ({
                key: module.path,
                label: module.title
            }));

        if (children.length === 0) return null;

        // Single-child categories become a direct top-level link (no submenu)
        if (children.length === 1) {
            return {
                key: children[0].key,
                icon: category.icon,
                label: category.title,
            };
        }

        // Multi-child categories become a collapsible submenu
        return {
            key: category.id,
            icon: category.icon,
            label: category.title,
            children,
        };

    }).filter(Boolean), [user?.permissions, modules, categories]);

    const userMenuItems: any[] = [
        ...(user?.permissions?.includes('api-key:manage') ? [
            {
                key: "api-keys",
                icon: <SettingOutlined />,
                label: "Developer API Keys",
                onClick: () => router.push('/configuration/api-keys'),
            },
            { type: "divider" }
        ] : []),
        {
            key: "logout",
            icon: <LogoutOutlined />,
            label: "Logout",
            onClick: logout,
        }
    ];

    return (
        <Layout style={{ minHeight: "100vh", background: theme.background }}>
            <Sider
                trigger={null}
                collapsible
                collapsed={collapsed}
                width={200}
                style={{
                    overflow: "auto",
                    height: "100vh",
                    position: "fixed",
                    left: 0,
                    top: 0,
                    bottom: 0,
                    background: theme.sidebarBg
                }}
            >
                <div style={{
                    height: 64,
                    margin: 16,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    whiteSpace: "nowrap",
                    overflow: "hidden"
                }}>
                    {brandingConfig.logo && (
                        <img
                            src={collapsed && brandingConfig.logoSmall ? brandingConfig.logoSmall : brandingConfig.logo}
                            alt="Logo"
                            style={{
                                height: collapsed ? 32 : 50,
                                width: '100%',
                                maxWidth: collapsed ? 32 : 160,
                                objectFit: 'contain'
                            }}
                        />
                    )}
                </div>
                <Menu
                    theme="dark"
                    mode="inline"
                    defaultSelectedKeys={[pathname]}
                    items={menuItems}
                    onClick={({ key }) => { if (key.startsWith('/')) router.push(key); }}
                    style={{ background: theme.sidebarBg }}
                />
            </Sider>
            <Layout style={{ marginLeft: collapsed ? 80 : 200, transition: "all 0.2s", background: theme.background }}>
                <Header style={{ padding: 0, background: theme.componentBg, display: "flex", justifyContent: "space-between", alignItems: "center", paddingRight: 24, color: theme.textColor }}>
                    <Button
                        type="text"
                        icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                        onClick={() => setCollapsed(!collapsed)}
                        style={{ fontSize: "16px", width: 64, height: 64, color: theme.textColor }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <TenantSwitcher />

                        {/* Theme Toggle (Configurable) */}
                        {brandingConfig.showThemeToggle && (
                            <Tooltip title={mode === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
                                <Button
                                    type="text"
                                    icon={mode === 'dark' ? <BulbOutlined /> : <BulbFilled style={{ color: '#FBBF24' }} />}
                                    onClick={toggleTheme}
                                    style={{ color: theme.textColor, fontSize: 16 }}
                                />
                            </Tooltip>
                        )}

                        <Dropdown menu={{ items: userMenuItems }}>
                            <div style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 8, color: theme.textColor }}>
                                <Avatar icon={<UserOutlined />} style={{ backgroundColor: theme.primaryColor }} />
                                <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
                                    <span>{user?.name || "User"}</span>
                                    <small style={{ fontSize: 10, opacity: 0.6 }}>{user?.permissions?.length || 0} permissions</small>
                                </div>
                            </div>
                        </Dropdown>
                    </div>
                </Header>
                <Content
                    style={{
                        margin: "24px 16px",
                        padding: 24,
                        minHeight: 280,
                        background: theme.componentBg,
                        borderRadius: 8,
                        color: theme.textColor
                    }}
                >
                    {(() => {
                        if (loading) {
                            return (
                                <div style={{ textAlign: 'center', padding: '100px 0' }}>
                                    <h2 style={{ color: theme.primaryColor }}>Loading...</h2>
                                </div>
                            );
                        }
                        const currentModule = modules.find(m => pathname.startsWith(m.path));
                        if (currentModule && !user?.permissions?.includes(currentModule.permission)) {
                            return (
                                <div style={{ textAlign: 'center', padding: '100px 0' }}>
                                    <h2 style={{ color: theme.primaryColor }}>Access Denied</h2>
                                    <p>You do not have permission to access the &quot;{currentModule.title}&quot; module.</p>
                                    <Button type="primary" onClick={() => router.push('/dashboard')}>Back to Dashboard</Button>
                                </div>
                            );
                        }
                        return children;
                    })()}
                </Content>

            </Layout>
        </Layout>
    );
};
