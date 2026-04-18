"use client";
import { ConfigEngine } from '@/components/Engines/ConfigEngine';
import rolesSchema from '@/schemas/orion-roles.json';

export default function OrionRolesPage() {
    return (
        <div>
            <h1 style={{ marginBottom: 24 }}>Roles &amp; Permissions</h1>
            <ConfigEngine schema={rolesSchema as any} />
        </div>
    );
}
