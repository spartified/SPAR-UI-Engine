
"use client";
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '@/core/auth/AuthProvider';

export interface Tenant {
    id: string;
    name: string;
    description?: string;
}

interface TenantContextType {
    tenant: Tenant | null;
    tenants: Tenant[];
    setTenant: (tenant: Tenant) => void;
    isLoading: boolean;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const TenantProvider = ({ children }: { children: React.ReactNode }) => {
    const { user } = useAuth();
    const [tenant, setTenant] = useState<Tenant | null>(null);
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!user) {
            setIsLoading(false);
            return;
        }

        const controller = new AbortController();

        const fetchTenants = async () => {
            setIsLoading(true);
            try {
                const response = await fetch('/api/tenants', { signal: controller.signal });
                if (!response.ok) {
                    throw new Error("Failed to fetch tenants");
                }
                const fetchedTenants: Tenant[] = await response.json();

                setTenants(fetchedTenants);

                const savedTenantId = localStorage.getItem('selectedTenantId');
                const foundTenant = fetchedTenants.find(t => t.id === savedTenantId);

                if (foundTenant) {
                    setTenant(foundTenant);
                } else if (fetchedTenants.length > 0) {
                    setTenant(fetchedTenants[0]);
                }
            } catch (error) {
                if ((error as any).name === 'AbortError') return;
                console.error("Failed to fetch tenants", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchTenants();

        return () => controller.abort();
    }, [user?.email]);

    const handleSetTenant = (newTenant: Tenant) => {
        setTenant(newTenant);
        localStorage.setItem('selectedTenantId', newTenant.id);
        // You might want to reload the page or trigger a global refresh here if deep state depends on tenant
        // window.location.reload(); 
    };

    return (
        <TenantContext.Provider value={{ tenant, tenants, setTenant: handleSetTenant, isLoading }}>
            {children}
        </TenantContext.Provider>
    );
};

export const useTenant = () => {
    const context = useContext(TenantContext);
    if (context === undefined) {
        throw new Error('useTenant must be used within a TenantProvider');
    }
    return context;
};
