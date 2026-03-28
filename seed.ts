import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

async function main() {
  console.log('🚀 INITIALIZING PARKING-OS FACTORY SEED...');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool as any);
  const prisma = new PrismaClient({ adapter });

  try {
    console.log('🧹 Wiping core systems...');
    // Absolute Wipe with correct priority
    await prisma.notification.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.ticket.deleteMany();
    await prisma.subscription.deleteMany();
    await prisma.space.deleteMany();
    await prisma.zone.deleteMany();
    await prisma.rate.deleteMany();
    await prisma.shift.deleteMany(); // ADDED SHIFTS
    await prisma.parkingLot.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.vehicle.deleteMany();
    await prisma.user.deleteMany();

    const hashedPassword = await bcrypt.hash('Admin123!', 10);

    console.log('👤 Creating Super Nodes...');
    const superAdmin = await prisma.user.create({
      data: {
        email: 'admin@parkingos.com',
        password: hashedPassword,
        firstName: 'Carlos',
        lastName: 'Rodríguez',
        role: 'SUPER_ADMIN',
      }
    });

    console.log('🏢 Initializing Parking Infrastructure...');
    const lot = await prisma.parkingLot.create({
      data: {
        name: 'ParkingOS Elite Industrial',
        address: 'Av. El Dorado #69-20, Bogotá',
        city: 'Bogotá',
        totalSpaces: 100,
        openTime: '00:00',
        closeTime: '23:59',
        is24Hours: true,
        adminId: superAdmin.id
      }
    });

    console.log('🗺️ Mapping Zones...');
    const zoneNames = ['ZONA_ALFA_VIP', 'ZONA_BETA_STD', 'ZONA_GAMMA_MOTO'];
    const zoneTypes = ['VIP', 'COVERED', 'MOTORCYCLE'];

    for (let j = 0; j < 3; j++) {
      const createdZone = await prisma.zone.create({
        data: { name: zoneNames[j], type: zoneTypes[j] as any, parkingLotId: lot.id }
      });
      
      const count = zoneTypes[j] === 'MOTORCYCLE' ? 10 : 15;
      for (let i = 1; i <= count; i++) {
        await prisma.space.create({
          data: {
            number: `${zoneNames[j][5]}${i.toString().padStart(2, '0')}`,
            zoneId: createdZone.id,
            floor: 1,
            status: i % 4 === 0 ? 'OCCUPIED' : 'AVAILABLE'
          }
        });
      }
    }

    console.log('💰 Setting Financial Protocols...');
    await prisma.rate.create({ data: { name: 'Auto', vehicleType: 'CAR', modality: 'HOURLY', price: 5000, parkingLotId: lot.id } as any });

    console.log('📈 Monitoring active traffic...');
    // Create one vehicle to avoid empty vehicles page
    const v = await prisma.vehicle.create({
      data: { plate: 'OSX-777', type: 'CAR', brand: 'BMW', model: 'M4', color: 'Austin Yellow' }
    });

    console.log('📄 Adding permit-based subscriber...');
    const permitUser = await prisma.user.create({
      data: {
        email: 'lucia.permit@parkingos.com',
        password: hashedPassword,
        firstName: 'Lucia',
        lastName: 'Permit',
        role: 'CUSTOMER',
      }
    });

    const permitVehicle = await prisma.vehicle.create({
      data: {
        plate: 'PER-111',
        type: 'CAR',
        brand: 'Toyota',
        model: 'Corolla',
        color: 'Silver',
        ownerId: permitUser.id,
      }
    });

    const assignedSpace = await prisma.space.findFirst({
      where: { zone: { parkingLotId: lot.id } },
      orderBy: { number: 'asc' },
    });

    const now = new Date();
    await prisma.subscription.create({
      data: {
        type: 'FIXED',
        status: 'ACTIVE',
        startDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        endDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        price: 0,
        autoRenew: true,
        userId: permitUser.id,
        vehicleId: permitVehicle.id,
        parkingLotId: lot.id,
        spaceId: assignedSpace?.id,
      }
    });

    console.log('✅ SYSTEM READY. SEED SUCCESSFUL.');
  } catch (error) {
    console.error('❌ SEED CRITICAL FAILURE:', error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
