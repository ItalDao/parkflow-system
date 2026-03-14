import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

async function check() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool as any);
  const prisma = new PrismaClient({ adapter });

  console.log('Users:', await prisma.user.findMany({ select: { email: true, firstName: true } }));
  console.log('Lots:', await prisma.parkingLot.findMany());
  
  await prisma.$disconnect();
}

check().catch(console.error);
