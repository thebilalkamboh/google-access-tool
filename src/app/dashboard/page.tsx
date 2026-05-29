import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import DashboardClient from '@/components/DashboardClient';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const clients = await prisma.client.findMany({
    where: { userId: session.userId },
    include: { services: true },
    orderBy: { createdAt: 'desc' },
  });

  const user = await prisma.user.findUnique({ where: { id: session.userId } });

  return <DashboardClient initialClients={clients as any} userName={user?.name ?? ''} />;
}
