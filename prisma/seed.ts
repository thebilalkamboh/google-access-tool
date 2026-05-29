import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash('AccessKit@123', 10);
  await prisma.user.upsert({
    where: { email: 'e.bilalkamboh@gmail.com' },
    update: { password },
    create: {
      email: 'e.bilalkamboh@gmail.com',
      password,
      name: 'Click Track Marketing',
    },
  });
  console.log('Seed complete. Login: e.bilalkamboh@gmail.com / AccessKit@123');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
