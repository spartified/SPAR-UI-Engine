"use client";
import React from "react";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { AuthProvider } from "@/core/auth/AuthProvider";
import { SessionProvider } from "next-auth/react";
import { Nunito_Sans } from "next/font/google";
import { ThemeProvider } from "@/context/ThemeContext";
import { TenantProvider } from "@/context/TenantContext";
import { ModuleProvider } from "@/context/ModuleContext";
import "./globals.css";

const nunito = Nunito_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-nunito",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={nunito.className} style={{ margin: 0 }}>
        <SessionProvider>
          <AntdRegistry>
            <ThemeProvider>
              <AuthProvider>
                <TenantProvider>
                  <ModuleProvider>
                    {children}
                  </ModuleProvider>
                </TenantProvider>
              </AuthProvider>
            </ThemeProvider>
          </AntdRegistry>
        </SessionProvider>
      </body>
    </html>
  );
}
