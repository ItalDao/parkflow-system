import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  console.log('Users:', await prisma.user.count());
  console.log('ParkingLots:', await prisma.parkingLot.count());
  console.log('Spaces:', await prisma.space.count());
  console.log('Tickets:', await prisma.ticket.count());
  console.log('Rates:', await prisma.rate.count());
}

check().catch(console.error).finally(() => prisma.$disconnect());
