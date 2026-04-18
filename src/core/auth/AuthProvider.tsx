"use client";
import React, { createContext, useContext, useMemo } from "react";
import { useSession, signIn, signOut } from "next-auth/react";

interface AuthContextType {
    isAuthenticated: boolean;
    login: (values?: any) => void;
    loginWithKeycloak: () => void;
    logout: () => void;
    user: { name: string; email: string; role: string; permissions: string[] } | null;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const { data: session, status } = useSession();

    const isAuthenticated = status === "authenticated";
    const loading = status === "loading";

    const user = useMemo(() => {
        if (!session?.user) return null;
        return {
            name: session.user.name || "",
            email: session.user.email || "",
            role: (session.user as any).role || "viewer",
            permissions: (session.user as any).permissions || []
        };
    }, [session]);

    const login = (values?: any) => {
        if (values) {
            signIn("credentials", {
                username: values.username,
                password: values.password,
                redirect: true,
                callbackUrl: "/dashboard"
            });
        } else {
            signIn();
        }
    };

    const loginWithKeycloak = () => {
        signIn("keycloak", { callbackUrl: "/dashboard" });
    };

    const logout = async () => {
        if (process.env.NEXT_PUBLIC_AUTH_MODE === 'keycloak') {
            const issuer = process.env.NEXT_PUBLIC_KEYCLOAK_ISSUER;
            const clientId = process.env.NEXT_PUBLIC_KEYCLOAK_ID;
            const idToken = (session?.user as any)?.id_token;

            if (issuer && clientId) {
                // Ensure origin is clean but properly encoded
                const origin = window.location.origin;
                const encodedRedirect = encodeURIComponent(origin);

                let logoutUrl = `${issuer}/protocol/openid-connect/logout?post_logout_redirect_uri=${encodedRedirect}&client_id=${clientId}`;

                if (idToken) {
                    logoutUrl += `&id_token_hint=${idToken}`;
                }

                await signOut({ redirect: false });
                window.location.href = logoutUrl;
                return;
            }
        }
        signOut({ callbackUrl: "/" });
    };

    return (
        <AuthContext.Provider value={{ isAuthenticated, login, loginWithKeycloak, logout, user, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};
