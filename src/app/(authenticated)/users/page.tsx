"use client";
import { ConfigEngine } from '@/components/Engines/ConfigEngine';
import usersSchema from '@/schemas/orion-users.json';

export default function OrionUsersPage() {
    return (
        <div>
            <h1 style={{ marginBottom: 24 }}>User Management</h1>
            <ConfigEngine schema={usersSchema as any} />
        </div>
    );
}
