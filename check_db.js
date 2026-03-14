
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const users = await prisma.user.count();
  const zones = await prisma.zone.count();
  const spaces = await prisma.space.count();
  const tickets = await prisma.ticket.count();
  const subscriptions = await prisma.subscription.count();
  const notifications = await prisma.notification.count();
  
  console.log({ users, zones, spaces, tickets, subscriptions, notifications });
  process.exit(0);
}

check();
