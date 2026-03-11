export const DEV_USERS = [
    {
        id: "1",
        username: "admin",
        password: "admin", // In a real app, hash this!
        name: "Dev Admin",
        email: "admin@example.com",
        role: "admin",
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
            "report:gtp:read"
        ]
    },
    {
        id: "2",
        username: "viewer",
        password: "viewer",
        name: "Dev Viewer",
        email: "viewer@example.com",
        role: "viewer",
        permissions: ["dashboard:read", "node:read"]
    }
];
