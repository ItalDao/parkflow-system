import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { getApiKeyPrefix, hashApiKey } from '@/lib/api-keys';

export async function POST() {
  try {
    const hasParkingLot = await prisma.parkingLot.findFirst();
    const hashedPassword = await hashPassword('Matias@Admin123');
    const baseUser = {
      password: hashedPassword,
      isActive: true,
      isBlocked: false,
      failedAttempts: 0,
      blockedUntil: null,
    };

    const [superAdmin, admin, operator1, operator2, customer1, customer2] = await Promise.all([
      prisma.user.upsert({
        where: { email: 'matias.superadmin@acuario.com' },
        update: { ...baseUser, firstName: 'Matias', lastName: 'SuperAdmin', phone: '+57 310 123 4567', role: 'SUPER_ADMIN' },
        create: { email: 'matias.superadmin@acuario.com', ...baseUser, firstName: 'Matias', lastName: 'SuperAdmin', phone: '+57 310 123 4567', role: 'SUPER_ADMIN' },
      }),
      prisma.user.upsert({
        where: { email: 'matias.admin@acuario.com' },
        update: { ...baseUser, firstName: 'Matias', lastName: 'Admin', phone: '+57 320 234 5678', role: 'ADMIN' },
        create: { email: 'matias.admin@acuario.com', ...baseUser, firstName: 'Matias', lastName: 'Admin', phone: '+57 320 234 5678', role: 'ADMIN' },
      }),
      prisma.user.upsert({
        where: { email: 'matias.operator@acuario.com' },
        update: { ...baseUser, firstName: 'Matias', lastName: 'Operador', phone: '+57 300 345 6789', role: 'OPERATOR' },
        create: { email: 'matias.operator@acuario.com', ...baseUser, firstName: 'Matias', lastName: 'Operador', phone: '+57 300 345 6789', role: 'OPERATOR' },
      }),
      prisma.user.upsert({
        where: { email: 'operador2@parkingos.com' },
        update: { ...baseUser, firstName: 'María', lastName: 'González', phone: '+57 311 456 7890', role: 'OPERATOR' },
        create: { email: 'operador2@parkingos.com', ...baseUser, firstName: 'María', lastName: 'González', phone: '+57 311 456 7890', role: 'OPERATOR' },
      }),
      prisma.user.upsert({
        where: { email: 'cliente1@email.com' },
        update: { ...baseUser, firstName: 'Pedro', lastName: 'Sánchez', phone: '+57 315 567 8901', role: 'CUSTOMER' },
        create: { email: 'cliente1@email.com', ...baseUser, firstName: 'Pedro', lastName: 'Sánchez', phone: '+57 315 567 8901', role: 'CUSTOMER' },
      }),
      prisma.user.upsert({
        where: { email: 'cliente2@email.com' },
        update: { ...baseUser, firstName: 'Laura', lastName: 'Ramírez', phone: '+57 318 678 9012', role: 'CUSTOMER' },
        create: { email: 'cliente2@email.com', ...baseUser, firstName: 'Laura', lastName: 'Ramírez', phone: '+57 318 678 9012', role: 'CUSTOMER' },
      }),
    ]);

    const firstLot = await prisma.parkingLot.findFirst({ select: { id: true } });
    const demoApiKeyRaw = process.env.SEED_API_KEY || 'pkos_demo_local_1234567890';
    const demoApiKeyHash = hashApiKey(demoApiKeyRaw);
    await prisma.apiKey.upsert({
      where: { keyHash: demoApiKeyHash },
      update: {
        isActive: true,
        scopes: 'tickets:read',
        parkingLotId: firstLot?.id || null,
      },
      create: {
        name: 'Demo API v1 key',
        keyPrefix: getApiKeyPrefix(demoApiKeyRaw),
        keyHash: demoApiKeyHash,
        scopes: 'tickets:read',
        isActive: true,
        createdByUserId: superAdmin.id,
        parkingLotId: firstLot?.id || null,
      },
    });

    if (hasParkingLot) {
      return NextResponse.json({
        message: 'Usuarios de prueba actualizados. El sistema ya está inicializado.',
        apiV1: {
          endpoint: '/api/v1/tickets',
          header: 'x-api-key',
          demoKey: demoApiKeyRaw,
        },
      });
    }

    // Create parking lot
    const parkingLot = await prisma.parkingLot.create({
      data: {
        name: 'ParkingOS Centro Comercial',
        address: 'Calle 100 #15-20, Centro Comercial Premium',
        city: 'Bogotá',
        phone: '+57 1 234 5678',
        totalSpaces: 60,
        openTime: '06:00',
        closeTime: '22:00',
        is24Hours: false,
        gracePeriod: 15,
        lostTicketFee: 50000,
        adminId: admin.id,
      },
    });

    // Update operators assignment
    await prisma.user.update({ where: { id: operator1.id }, data: { assignedLotId: parkingLot.id } });
    await prisma.user.update({ where: { id: operator2.id }, data: { assignedLotId: parkingLot.id } });

    // Create zones
    const zoneA = await prisma.zone.create({
      data: { name: 'Zona A - Cubierta', type: 'COVERED', parkingLotId: parkingLot.id },
    });
    const zoneB = await prisma.zone.create({
      data: { name: 'Zona B - VIP', type: 'VIP', parkingLotId: parkingLot.id },
    });
    const zoneC = await prisma.zone.create({
      data: { name: 'Zona C - Motos', type: 'MOTORCYCLE', parkingLotId: parkingLot.id },
    });
    const zoneD = await prisma.zone.create({
      data: { name: 'Zona D - Descubierta', type: 'UNCOVERED', parkingLotId: parkingLot.id },
    });

    // Create spaces (20 per zone for A and D, 10 for B and C)
    const createSpaces = async (zoneId: string, prefix: string, count: number, floor: number = 1) => {
      const spaces = [];
      for (let i = 1; i <= count; i++) {
        spaces.push(
          prisma.space.create({
            data: {
              number: `${prefix}${i.toString().padStart(2, '0')}`,
              zoneId,
              floor,
              status: Math.random() > 0.6 ? 'OCCUPIED' : 'AVAILABLE',
            },
          })
        );
      }
      return Promise.all(spaces);
    };

    const spacesA = await createSpaces(zoneA.id, 'A', 20);
    const spacesB = await createSpaces(zoneB.id, 'B', 10);
    const spacesC = await createSpaces(zoneC.id, 'C', 10);
    const spacesD = await createSpaces(zoneD.id, 'D', 20);

    // Create rates
    const rateData = [
      { name: 'Auto - Hora', vehicleType: 'CAR' as const, modality: 'HOURLY' as const, price: 5000 },
      { name: 'Auto - Día', vehicleType: 'CAR' as const, modality: 'DAILY' as const, price: 25000 },
      { name: 'Auto - Mensualidad', vehicleType: 'CAR' as const, modality: 'MONTHLY' as const, price: 350000 },
      { name: 'Moto - Hora', vehicleType: 'MOTORCYCLE' as const, modality: 'HOURLY' as const, price: 2000 },
      { name: 'Moto - Día', vehicleType: 'MOTORCYCLE' as const, modality: 'DAILY' as const, price: 10000 },
      { name: 'Moto - Mensualidad', vehicleType: 'MOTORCYCLE' as const, modality: 'MONTHLY' as const, price: 150000 },
      { name: 'Camioneta - Hora', vehicleType: 'VAN' as const, modality: 'HOURLY' as const, price: 7000 },
      { name: 'Camión - Hora', vehicleType: 'TRUCK' as const, modality: 'HOURLY' as const, price: 10000 },
      { name: 'Auto VIP - Hora', vehicleType: 'CAR' as const, modality: 'HOURLY' as const, price: 8000, isPeak: false },
    ];

    for (const rate of rateData) {
      await prisma.rate.create({
        data: { ...rate, parkingLotId: parkingLot.id },
      });
    }

    // Create vehicles
    const vehicles = [
      { plate: 'ABC-123', type: 'CAR' as const, brand: 'Toyota', model: 'Corolla', color: 'Blanco', ownerId: customer1.id },
      { plate: 'DEF-456', type: 'CAR' as const, brand: 'Mazda', model: 'CX-5', color: 'Rojo', ownerId: customer2.id },
      { plate: 'GHI-789', type: 'MOTORCYCLE' as const, brand: 'Yamaha', model: 'FZ', color: 'Negro' },
      { plate: 'JKL-012', type: 'VAN' as const, brand: 'Chevrolet', model: 'Tracker', color: 'Gris' },
      { plate: 'MNO-345', type: 'CAR' as const, brand: 'Renault', model: 'Sandero', color: 'Azul' },
      { plate: 'PQR-678', type: 'CAR' as const, brand: 'Kia', model: 'Sportage', color: 'Negro', ownerId: customer1.id },
      { plate: 'STU-901', type: 'MOTORCYCLE' as const, brand: 'Honda', model: 'CB190', color: 'Rojo' },
      { plate: 'VWX-234', type: 'TRUCK' as const, brand: 'Ford', model: 'Ranger', color: 'Blanco' },
    ];

    const createdVehicles = [];
    for (const v of vehicles) {
      createdVehicles.push(await prisma.vehicle.create({ data: v }));
    }

    // Create active tickets for occupied spaces
    const occupiedSpaces = [...spacesA, ...spacesB, ...spacesC, ...spacesD].filter(s => s.status === 'OCCUPIED');
    for (let i = 0; i < Math.min(occupiedSpaces.length, createdVehicles.length); i++) {
      const hoursAgo = Math.floor(Math.random() * 6) + 1;
      const entryTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
      const ticketCode = `PKG-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      await prisma.ticket.create({
        data: {
          ticketCode,
          vehicleId: createdVehicles[i].id,
          spaceId: occupiedSpaces[i].id,
          parkingLotId: parkingLot.id,
          operatorId: operator1.id,
          entryTime,
        },
      });
    }

    // Create some completed tickets with payments for chart data
    for (let day = 6; day >= 0; day--) {
      const numTickets = Math.floor(Math.random() * 8) + 5;
      for (let t = 0; t < numTickets; t++) {
        const date = new Date();
        date.setDate(date.getDate() - day);
        date.setHours(Math.floor(Math.random() * 14) + 6, Math.floor(Math.random() * 60), 0, 0);

        const hours = Math.floor(Math.random() * 5) + 1;
        const exitTime = new Date(date.getTime() + hours * 60 * 60 * 1000);
        const amount = hours * 5000;

        const tempVehicle = await prisma.vehicle.create({
          data: {
            plate: `TMP-${day}${t}${Math.random().toString(36).substring(2, 5).toUpperCase()}`,
            type: 'CAR',
          },
        });

        const availableSpace = spacesA[Math.floor(Math.random() * spacesA.length)];
        const ticketCode = `PKG-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}${day}${t}`;

        const ticket = await prisma.ticket.create({
          data: {
            ticketCode,
            status: 'COMPLETED',
            vehicleId: tempVehicle.id,
            spaceId: availableSpace.id,
            parkingLotId: parkingLot.id,
            operatorId: operator1.id,
            entryTime: date,
            exitTime,
            totalHours: hours,
            totalAmount: amount,
          },
        });

        const methods: Array<'CASH' | 'CARD' | 'DIGITAL_WALLET'> = ['CASH', 'CARD', 'DIGITAL_WALLET'];
        await prisma.payment.create({
          data: {
            amount,
            method: methods[Math.floor(Math.random() * methods.length)],
            status: 'COMPLETED',
            invoiceNumber: `INV-${Date.now()}-${day}-${t}`,
            ticketId: ticket.id,
            parkingLotId: parkingLot.id,
            operatorId: operator1.id,
            createdAt: exitTime,
          },
        });
      }
    }

    // Create subscription
    await prisma.subscription.create({
      data: {
        type: 'FIXED',
        status: 'ACTIVE',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        price: 350000,
        autoRenew: true,
        userId: customer1.id,
        vehicleId: createdVehicles[0].id,
        parkingLotId: parkingLot.id,
      },
    });

    // Create notifications
    const notifications = [
      { title: 'Bienvenido a ParkingOS', message: 'Tu cuenta ha sido creada exitosamente.', type: 'info', userId: superAdmin.id },
      { title: 'Parqueadero al 90%', message: 'La ocupación ha superado el 90%. Considera activar tarifas dinámicas.', type: 'warning', userId: admin.id },
      { title: 'Nuevo abonado registrado', message: 'Pedro Sánchez ha adquirido una mensualidad para ABC-123.', type: 'success', userId: admin.id },
      { title: 'Turno iniciado', message: 'Juan López ha abierto su turno de la mañana.', type: 'info', userId: admin.id },
    ];

    for (const n of notifications) {
      await prisma.notification.create({ data: n });
    }

    return NextResponse.json({
      message: 'Base de datos poblada exitosamente.',
      data: {
        users: 6,
        parkingLots: 1,
        zones: 4,
        spaces: 60,
        vehicles: vehicles.length,
        rates: rateData.length,
      },
      apiV1: {
        endpoint: '/api/v1/tickets',
        header: 'x-api-key',
        demoKey: demoApiKeyRaw,
      },
    });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json({ error: 'Error al poblar la base de datos', details: String(error) }, { status: 500 });
  }
}
