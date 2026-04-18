"use client";
import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { ConfigProvider, theme as antTheme } from 'antd';
import { setActiveTheme, DARK_THEME, LIGHT_THEME, ThemeTokens } from '@/branding.config';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ThemeMode = 'dark' | 'light';

interface ThemeContextType {
    mode: ThemeMode;
    toggleTheme: () => void;
    theme: ThemeTokens;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// ─── Provider ────────────────────────────────────────────────────────────────

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
    const [mode, setMode] = useState<ThemeMode>('dark');

    // Restore preference from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('themeMode') as ThemeMode | null;
        const initial = saved === 'light' ? 'light' : 'dark';
        setMode(initial);
        setActiveTheme(initial === 'light' ? LIGHT_THEME : DARK_THEME);
    }, []);

    const toggleTheme = () => {
        setMode(prev => {
            const next = prev === 'dark' ? 'light' : 'dark';
            localStorage.setItem('themeMode', next);
            setActiveTheme(next === 'light' ? LIGHT_THEME : DARK_THEME);
            return next;
        });
    };

    const theme = useMemo(() => mode === 'light' ? LIGHT_THEME : DARK_THEME, [mode]);

    const antAlgorithm = mode === 'light' ? antTheme.defaultAlgorithm : antTheme.darkAlgorithm;
    const gridLineColor = mode === 'light' ? '#e5e7eb' : '#1f2937';

    return (
        <ThemeContext.Provider value={{ mode, toggleTheme, theme }}>
            <ConfigProvider
                theme={{
                    algorithm: antAlgorithm,
                    token: {
                        colorPrimary: theme.primaryColor,
                        colorBgBase: theme.background,
                        colorBgContainer: theme.componentBg,
                        colorBgElevated: theme.componentBg,
                        colorTextBase: theme.textColor,
                    },
                    components: {
                        Layout: {
                            bodyBg: theme.background,
                            headerBg: theme.componentBg,
                            siderBg: theme.sidebarBg,
                        },
                        Card: {
                            colorBgContainer: theme.componentBg,
                        },
                        Table: {
                            colorBgContainer: theme.componentBg,
                            headerBg: mode === 'light' ? '#EFF6FF' : '#1f2937',
                            borderColor: mode === 'light' ? '#e5e7eb' : '#374151',
                        },
                        Tree: {
                            colorBgContainer: theme.componentBg,
                        },
                        Select: {
                            colorBgContainer: theme.componentBg,
                            colorBgElevated: theme.componentBg,
                            colorText: theme.textColor,
                        },
                        Menu: {
                            darkItemBg: theme.sidebarBg,
                            darkSubMenuItemBg: theme.sidebarBg,
                        },
                    }
                }}
            >
                <style>{`body { background-color: ${theme.background} !important; }`}</style>
                {children}
            </ConfigProvider>
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
    return ctx;
};
