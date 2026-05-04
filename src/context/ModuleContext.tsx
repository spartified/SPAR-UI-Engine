"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { ModuleDefinition, ICON_MAP, PLATFORM_MODULES, PLATFORM_CATEGORIES } from '@/config/modules';

interface ModuleContextType {
    modules: ModuleDefinition[];
    categories: any[];
    isLoading: boolean;
}

const ModuleContext = createContext<ModuleContextType>({
    modules: PLATFORM_MODULES,
    categories: PLATFORM_CATEGORIES,
    isLoading: true,
});

export const ModuleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [modules, setModules] = useState<ModuleDefinition[]>(PLATFORM_MODULES);
    const [categories, setCategories] = useState<any[]>(PLATFORM_CATEGORIES);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchModules() {
            try {
                const res = await fetch('/api/system/modules');
                const data = await res.json();

                if (data.modules && data.categories) {
                    // Combine Platform + DB modules
                    // Use a Map to avoid duplicates (ID based)
                    const moduleMap = new Map();
                    PLATFORM_MODULES.forEach(m => moduleMap.set(m.id, m));
                    data.modules.forEach((m: any) => moduleMap.set(m.id, m));

                    const categoryMap = new Map();
                    PLATFORM_CATEGORIES.forEach(c => categoryMap.set(c.id, c));
                    data.categories.forEach((c: any) => {
                        categoryMap.set(c.id, {
                            ...c,
                            icon: ICON_MAP[c.icon_name] || ICON_MAP.GlobalOutlined
                        });
                    });

                    setModules(Array.from(moduleMap.values()));
                    setCategories(Array.from(categoryMap.values()));
                }
            } catch (error) {
                console.error("Failed to load dynamic modules:", error);
            } finally {
                setIsLoading(false);
            }
        }

        fetchModules();
    }, []);

    return (
        <ModuleContext.Provider value={{ modules, categories, isLoading }}>
            {children}
        </ModuleContext.Provider>
    );
};

export const useModules = () => useContext(ModuleContext);
