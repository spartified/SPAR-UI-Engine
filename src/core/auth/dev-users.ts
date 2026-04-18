export const DEV_USERS = [
    {
        id: "1",
        username: "admin",
        password: "admin", // In a real app, hash this!
        name: "Dev Admin",
        email: "admin@example.com",
        role: "admin",
        account_id: 1, // Root Account
        permissions: [
            "dashboard:read",
            "report:telecom:read",
            "node:read",
            "node:update",
            "node:delete",
            "user:manage",
            "grafana",
            "gtp:imsi:manage",
            "gtp:mapping:manage",
            "gtp:session:manage",
            "report:gtp:read",
            "orion:dashboard:read",
            "orion:account:manage",
            "orion:user:manage",
            "orion:role:manage",
            "orion:inventory:manage",
            "orion:esim:manage",
            "orion:aggregator:manage",
            "orion:package:manage"
        ]
    },
    {
        id: "2",
        username: "viewer",
        password: "viewer",
        name: "Dev Viewer",
        email: "viewer@example.com",
        role: "viewer",
        account_id: 2, // Acme Enterprise
        permissions: ["dashboard:read", "node:read"]
    }
];
