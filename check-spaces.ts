import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

async function check() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool as any);
  const prisma = new PrismaClient({ adapter });

  const lot = await prisma.parkingLot.findFirst({
    include: { zones: { include: { spaces: true } } }
  });
  
  console.log('Lot:', lot?.name);
  console.log('Zones:', lot?.zones.length);
  console.log('Total Spaces (count):', lot?.zones.reduce((a, z) => a + z.spaces.length, 0));
  
  await prisma.$disconnect();
}

check().catch(console.error);
