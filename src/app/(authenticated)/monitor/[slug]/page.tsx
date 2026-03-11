import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { MODULE_REGISTRY } from '@/config/modules';
import { Result, Button } from 'antd';
import MonitorClient from '@/components/Monitor/MonitorClient';
import { redirect } from 'next/navigation';

export default async function DynamicMonitorPage(props: { params: Promise<{ slug: string }> }) {
    const params = await props.params;
    const session = await getServerSession(authOptions);
    const user: any = session?.user;

    const pathname = `/monitor/${params.slug}`;
    const currentModule = MODULE_REGISTRY.find(m => m.path === pathname);

    if (!currentModule || !user?.permissions?.includes(currentModule.permission)) {
        return (
            <Result
                status="403"
                title="403"
                subTitle="Sorry, you are not authorized to access this Monitoring dashboard."
                extra={<Button type="primary" href="/dashboard">Back Home</Button>}
            />
        );
    }

    // Resolve URL from environment variables on the server side
    let finalUrl = currentModule.externalUrl;

    // Map the module IDs to their respective environment variables to ensure we get runtime values
    if (currentModule.id === 'monitor-server') {
        finalUrl = process.env.NEXT_PUBLIC_GRAFANA_URL_SERVER;
    } else if (currentModule.id === 'monitor-database') {
        finalUrl = process.env.NEXT_PUBLIC_GRAFANA_URL_DB;
    } else if (currentModule.id === 'monitor-app') {
        finalUrl = process.env.NEXT_PUBLIC_GRAFANA_URL_APP;
    }

    return <MonitorClient title={currentModule.title} url={finalUrl} />;
}
