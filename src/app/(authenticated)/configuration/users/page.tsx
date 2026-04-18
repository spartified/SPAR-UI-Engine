"use client";
import React from 'react';
import { ConfigEngine } from '@/components/Engines/ConfigEngine';
import usersSchema from '@/schemas/users.json';

export default function PlatformUsersPage() {
    return (
        <div>
            <h1 style={{ marginBottom: 24 }}>Platform User Management</h1>
            <ConfigEngine schema={usersSchema as any} />
        </div>
    );
}
