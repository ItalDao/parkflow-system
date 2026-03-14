import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth';

function getUserFromRequest(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  return verifyAccessToken(authHeader.substring(7));
}

async function createAuditLog(userId: string, action: string, entity: string, entityId?: string, details?: any) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entity,
        entityId,
        details: details ? JSON.stringify(details) : null,
      }
    });
  } catch (err) { console.error('Audit log failed:', err); }
}

export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const resource = searchParams.get('resource');

    // Security Hardening: Strict RBAC for sensitive resources
    if (user.role === 'OPERATOR' && ['audit', 'users', 'stats'].includes(resource || '')) {
      return NextResponse.json({ error: 'Acceso denegado: Se requieren permisos de Admin' }, { status: 403 });
    }

    // Dashboard stats
    if (resource === 'stats') {
      const parkingLot = await prisma.parkingLot.findFirst({
        include: {
          zones: { include: { spaces: true } },
          tickets: { where: { status: 'ACTIVE' } },
        },
      });

      if (!parkingLot) {
        return NextResponse.json({
          totalSpaces: 0,
          occupiedSpaces: 0,
          availableSpaces: 0,
          occupancyRate: 0,
          todayRevenue: 0,
          todayVehicles: 0,
          activeTickets: 0,
          monthRevenue: 0,
        });
      }

      const allSpaces = parkingLot.zones.flatMap(z => z.spaces);
      const totalSpaces = allSpaces.length;
      const occupiedSpaces = allSpaces.filter(s => s.status === 'OCCUPIED').length;
      const availableSpaces = allSpaces.filter(s => s.status === 'AVAILABLE').length;
      const reservedSpaces = allSpaces.filter(s => s.status === 'RESERVED').length;
      const maintenanceSpaces = allSpaces.filter(s => s.status === 'MAINTENANCE').length;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

      const todayPayments = await prisma.payment.aggregate({
        where: { createdAt: { gte: today }, status: 'COMPLETED', parkingLotId: parkingLot.id },
        _sum: { amount: true },
        _count: true,
      });

      const monthPayments = await prisma.payment.aggregate({
        where: { createdAt: { gte: monthStart }, status: 'COMPLETED', parkingLotId: parkingLot.id },
        _sum: { amount: true },
      });

      const todayTickets = await prisma.ticket.count({
        where: { createdAt: { gte: today }, parkingLotId: parkingLot.id },
      });

      return NextResponse.json({
        totalSpaces,
        occupiedSpaces,
        availableSpaces,
        reservedSpaces,
        maintenanceSpaces,
        occupancyRate: totalSpaces > 0 ? Math.round((occupiedSpaces / totalSpaces) * 100) : 0,
        todayRevenue: todayPayments._sum.amount || 0,
        todayVehicles: todayTickets,
        activeTickets: parkingLot.tickets.length,
        monthRevenue: monthPayments._sum.amount || 0,
        todayTransactions: todayPayments._count || 0,
        parkingLot: {
          id: parkingLot.id,
          name: parkingLot.name,
          address: parkingLot.address,
        },
      });
    }

    // Zone and spaces for map
    if (resource === 'zones') {
      const parkingLot = await prisma.parkingLot.findFirst({
        include: {
          zones: {
            include: {
              spaces: {
                include: {
                  tickets: {
                    where: { status: 'ACTIVE' },
                    include: { vehicle: true },
                    take: 1,
                  },
                },
              },
              _count: { select: { spaces: true } }
            },
          },
        },
      });

      return NextResponse.json(parkingLot?.zones || []);
    }

    // Recent tickets
    if (resource === 'tickets') {
      const status = searchParams.get('status');
      const whereClause: Record<string, unknown> = {};
      if (status) whereClause.status = status;

      const tickets = await prisma.ticket.findMany({
        where: whereClause,
        include: {
          vehicle: true,
          space: { include: { zone: true } },
          operator: { select: { firstName: true, lastName: true } },
          payment: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      return NextResponse.json(tickets);
    }

    // Vehicles
    if (resource === 'vehicles') {
      const vehicles = await prisma.vehicle.findMany({
        include: { _count: { select: { tickets: true } } },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      return NextResponse.json(vehicles);
    }

    // Revenue chart data
    if (resource === 'revenue-chart') {
      const days = 7;
      const data = [];
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);

        const revenue = await prisma.payment.aggregate({
          where: {
            createdAt: { gte: date, lt: nextDate },
            status: 'COMPLETED',
          },
          _sum: { amount: true },
          _count: true,
        });

        data.push({
          date: date.toISOString().split('T')[0],
          day: date.toLocaleDateString('es-CO', { weekday: 'short' }),
          revenue: revenue._sum.amount || 0,
          transactions: revenue._count || 0,
        });
      }
      return NextResponse.json(data);
    }

    // Users list
    if (resource === 'users') {
      if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
      }
      const users = await prisma.user.findMany({
        select: {
          id: true, email: true, firstName: true, lastName: true,
          role: true, isActive: true, lastLoginAt: true, createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });
      return NextResponse.json(users);
    }

    // Shifts
    if (resource === 'shifts') {
      const shifts = await prisma.shift.findMany({
        include: {
          operator: { select: { firstName: true, lastName: true } },
          _count: { select: { payments: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
      return NextResponse.json(shifts);
    }

    if (resource === 'current-shift') {
      const shift = await prisma.shift.findFirst({
        where: { operatorId: user.userId, status: 'OPEN' },
        include: { operator: { select: { firstName: true, lastName: true } } },
      });
      return NextResponse.json(shift);
    }

    if (resource === 'shifts-history') {
      const shifts = await prisma.shift.findMany({
        where: user.role === 'OPERATOR' ? { operatorId: user.userId } : {},
        include: {
          operator: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
      return NextResponse.json(shifts);
    }

    // Payments
    if (resource === 'payments') {
      const payments = await prisma.payment.findMany({
        include: {
          ticket: { include: { vehicle: true } },
          operator: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      return NextResponse.json(payments);
    }

    // Rates
    if (resource === 'rates') {
      const rates = await prisma.rate.findMany({
        include: { zone: true },
        orderBy: { name: 'asc' },
      });
      return NextResponse.json(rates);
    }

    if (resource === 'lots') {
      const lots = await prisma.parkingLot.findMany({
        include: { _count: { select: { zones: true } } }
      });
      return NextResponse.json(lots);
    }

    // Audit logs (SUPER_ADMIN only)
    if (resource === 'audit') {
      if (user.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Prohibido' }, { status: 403 });
      const logs = await prisma.auditLog.findMany({
        include: { user: { select: { firstName: true, lastName: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      return NextResponse.json(logs);
    }

    // Subscriptions
    if (resource === 'subscriptions') {
      const subs = await prisma.subscription.findMany({
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
          vehicle: { select: { plate: true, type: true, brand: true } }
        },
        orderBy: { endDate: 'desc' }
      });
      return NextResponse.json(subs);
    }

    // Notifications
    if (resource === 'notifications') {
      const notes = await prisma.notification.findMany({
        where: { userId: user.userId },
        orderBy: { createdAt: 'desc' },
        take: 50
      });
      return NextResponse.json(notes);
    }

    return NextResponse.json({ error: 'Recurso no encontrado' }, { status: 404 });
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// POST - Create resources
export async function POST(request: NextRequest) {
  try {
    const tokenUser = getUserFromRequest(request);
    if (!tokenUser) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { resource } = body;

    // Security Hardening
    if (tokenUser.role === 'OPERATOR' && ['user', 'rate', 'seed'].includes(resource)) {
      return NextResponse.json({ error: 'Operación restringida a Administradores' }, { status: 403 });
    }

    // Booking Logic for Reservation Module
    if (resource === 'booking') {
      const { plate, vehicleType, arriveTime, exitTime, spaceId } = body;
      const parkingLot = await prisma.parkingLot.findFirst();
      if (!parkingLot) return NextResponse.json({ error: 'No hay parqueadero' }, { status: 400 });

      let vehicle = await prisma.vehicle.findUnique({ where: { plate } });
      if (!vehicle) vehicle = await prisma.vehicle.create({ data: { plate, type: vehicleType || 'CAR' } });

      const ticketCode = `RES-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const ticket = await prisma.ticket.create({
        data: {
          ticketCode,
          vehicleId: vehicle.id,
          spaceId,
          parkingLotId: parkingLot.id,
          operatorId: tokenUser.userId,
          status: 'ACTIVE', // Simplification: reservation is an active entry in this mock
        }
      });
      await prisma.space.update({ where: { id: spaceId }, data: { status: 'RESERVED' } });
      await createAuditLog(tokenUser.userId, 'CREATE_BOOKING', 'Ticket', ticket.id, { plate });
      return NextResponse.json(ticket);
    }
    if (resource === 'entry') {
      const { plate, vehicleType, spaceId } = body;

      let vehicle = await prisma.vehicle.findUnique({ where: { plate } });
      if (!vehicle) {
        vehicle = await prisma.vehicle.create({
          data: { plate, type: vehicleType || 'CAR' },
        });
      }

      if (vehicle.isBlacklisted) {
        return NextResponse.json({ error: 'Vehículo en lista negra: ' + vehicle.blacklistReason }, { status: 403 });
      }

      const parkingLot = await prisma.parkingLot.findFirst();
      if (!parkingLot) return NextResponse.json({ error: 'No hay parqueadero configurado' }, { status: 400 });

      const ticketCode = `PKG-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      const ticket = await prisma.ticket.create({
        data: {
          ticketCode,
          vehicleId: vehicle.id,
          spaceId,
          parkingLotId: parkingLot.id,
          operatorId: tokenUser.userId,
        },
        include: { vehicle: true, space: { include: { zone: true } } },
      });

      await prisma.space.update({
        where: { id: spaceId },
        data: { status: 'OCCUPIED' },
      });

      return NextResponse.json(ticket);
    }

    // Register vehicle exit
    if (resource === 'exit') {
      const { ticketId, paymentMethod, cashReceived } = body;

      const ticket = await prisma.ticket.findUnique({
        where: { id: ticketId },
        include: { vehicle: true, space: { include: { zone: true } } },
      });

      if (!ticket || ticket.status !== 'ACTIVE') {
        return NextResponse.json({ error: 'Ticket no encontrado o ya procesado' }, { status: 400 });
      }

      const now = new Date();
      const entryTime = new Date(ticket.entryTime);
      const diffMs = now.getTime() - entryTime.getTime();
      const totalHours = Math.max(diffMs / (1000 * 60 * 60), 0);

      const rate = await prisma.rate.findFirst({
        where: {
          parkingLotId: ticket.parkingLotId,
          vehicleType: ticket.vehicle.type,
          isActive: true,
        },
      });

      const hourlyRate = rate?.price || 3000;
      const totalAmount = Math.ceil(totalHours) * hourlyRate;

      const changeGiven = paymentMethod === 'CASH' && cashReceived ? cashReceived - totalAmount : 0;

      const activeShift = await prisma.shift.findFirst({
        where: { operatorId: tokenUser.userId, status: 'OPEN' },
      });

      const payment = await prisma.payment.create({
        data: {
          amount: totalAmount,
          method: paymentMethod || 'CASH',
          status: 'COMPLETED',
          cashReceived: cashReceived || null,
          changeGiven: changeGiven > 0 ? changeGiven : null,
          invoiceNumber: `INV-${Date.now()}`,
          ticketId: ticket.id,
          parkingLotId: ticket.parkingLotId,
          operatorId: tokenUser.userId,
          shiftId: activeShift?.id || null,
        },
      });

      await prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          status: 'COMPLETED',
          exitTime: now,
          totalHours: Math.round(totalHours * 100) / 100,
          totalAmount,
        },
      });

      await prisma.space.update({
        where: { id: ticket.spaceId },
        data: { status: 'AVAILABLE' },
      });

      if (activeShift) {
        const cashAdd = paymentMethod === 'CASH' ? totalAmount : 0;
        const cardAdd = paymentMethod === 'CARD' ? totalAmount : 0;
        const digitalAdd = paymentMethod === 'DIGITAL_WALLET' ? totalAmount : 0;
        await prisma.shift.update({
          where: { id: activeShift.id },
          data: {
            totalCash: { increment: cashAdd },
            totalCard: { increment: cardAdd },
            totalDigital: { increment: digitalAdd },
            expectedTotal: { increment: totalAmount },
            vehiclesServed: { increment: 1 },
          },
        });
      }

      return NextResponse.json({ ticket: { ...ticket, exitTime: now, totalHours, totalAmount }, payment });
    }

    // Open shift
    if (resource === 'open-shift') {
      const { initialCash } = body;
      const parkingLot = await prisma.parkingLot.findFirst();
      if (!parkingLot) return NextResponse.json({ error: 'No hay parqueadero configurado' }, { status: 400 });

      const existingShift = await prisma.shift.findFirst({
        where: { operatorId: tokenUser.userId, status: 'OPEN' },
      });
      if (existingShift) {
        return NextResponse.json({ error: 'Ya tienes un turno abierto' }, { status: 400 });
      }

      const shift = await prisma.shift.create({
        data: {
          operatorId: tokenUser.userId,
          parkingLotId: parkingLot.id,
          initialCash: initialCash || 0,
        },
        include: { operator: { select: { firstName: true, lastName: true } } },
      });

      return NextResponse.json(shift);
    }

    // Close shift
    if (resource === 'close-shift') {
      const { shiftId, actualTotal, notes } = body;

      const shift = await prisma.shift.update({
        where: { id: shiftId },
        data: {
          status: 'CLOSED',
          endTime: new Date(),
          actualTotal,
          difference: actualTotal - (await prisma.shift.findUnique({ where: { id: shiftId } }))!.expectedTotal,
          notes,
        },
        include: { operator: { select: { firstName: true, lastName: true } } },
      });

      return NextResponse.json(shift);
    }

    // Create user
    if (resource === 'users') {
      if (tokenUser.role !== 'SUPER_ADMIN' && tokenUser.role !== 'ADMIN') {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
      }
      const { email, password, firstName, lastName, role } = body;
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash(password || '123456', 10);
      
      const user = await prisma.user.create({
        data: { email, password: hashedPassword, firstName, lastName, role: role || 'OPERATOR' }
      });
      
      await createAuditLog(tokenUser.userId, 'CREATE_USER', 'User', user.id, { email, role });
      return NextResponse.json(user);
    }

    // Create rate
    if (resource === 'rates') {
      if (tokenUser.role !== 'SUPER_ADMIN' && tokenUser.role !== 'ADMIN') {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
      }
      const parkingLot = await prisma.parkingLot.findFirst();
      const rate = await prisma.rate.create({
        data: { ...body.data, parkingLotId: parkingLot?.id }
      });
      await createAuditLog(tokenUser.userId, 'CREATE_RATE', 'Rate', rate.id, body.data);
      return NextResponse.json(rate);
    }

    return NextResponse.json({ error: 'Recurso no válido' }, { status: 400 });
  } catch (error) {
    console.error('Dashboard POST error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// PUT - Update resources
export async function PUT(request: NextRequest) {
  try {
    const tokenUser = getUserFromRequest(request);
    if (!tokenUser) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const body = await request.json();
    const { resource, id, data } = body;

    if (tokenUser.role !== 'SUPER_ADMIN' && tokenUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 });
    }

    if (resource === 'users') {
      const user = await prisma.user.update({
        where: { id },
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          role: data.role,
          isActive: data.isActive,
        },
        select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true }
      });
      await createAuditLog(tokenUser.userId, 'UPDATE_USER', 'User', id, data);
      return NextResponse.json(user);
    }

    if (resource === 'vehicles') {
      const vehicle = await prisma.vehicle.update({
        where: { id },
        data: {
          brand: data.brand,
          model: data.model,
          color: data.color,
          isBlacklisted: data.isBlacklisted,
          blacklistReason: data.blacklistReason,
        }
      });
      await createAuditLog(tokenUser.userId, 'UPDATE_VEHICLE', 'Vehicle', id, data);
      return NextResponse.json(vehicle);
    }

    if (resource === 'rates') {
      const rate = await prisma.rate.update({
        where: { id },
        data: {
          name: data.name,
          price: data.price,
          isActive: data.isActive,
        }
      });
      await createAuditLog(tokenUser.userId, 'UPDATE_RATE', 'Rate', id, data);
      return NextResponse.json(rate);
    }

    // Extend Duration Logic
    if (resource === 'extend') {
      const { ticketId, additionalHours } = body;
      const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
      if (!ticket) return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 });
      
      // We just log the extension in this demo, real logic would update expiry/rate
      await createAuditLog(tokenUser.userId, 'EXTEND_STAY', 'Ticket', ticketId, { additionalHours });
      return NextResponse.json({ success: true, message: 'Estancia extendida exitosamente' });
    }

    if (resource === 'notifications') {
      const note = await prisma.notification.update({
        where: { id, userId: tokenUser.userId },
        data: { isRead: data.isRead }
      });
      return NextResponse.json(note);
    }

    return NextResponse.json({ error: 'Recurso no válido' }, { status: 400 });
  } catch (error) {
    console.error('Dashboard PUT error:', error);
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 });
  }
}

// DELETE - Remove resources
export async function DELETE(request: NextRequest) {
  try {
    const tokenUser = getUserFromRequest(request);
    if (!tokenUser) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    if (tokenUser.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Solo SuperAdmin puede eliminar registros físicos' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const resource = searchParams.get('resource');
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    if (resource === 'users') {
      await prisma.user.delete({ where: { id } });
      await createAuditLog(tokenUser.userId, 'DELETE_USER', 'User', id);
      return NextResponse.json({ success: true });
    }

    if (resource === 'vehicles') {
      await prisma.vehicle.delete({ where: { id } });
      await createAuditLog(tokenUser.userId, 'DELETE_VEHICLE', 'Vehicle', id);
      return NextResponse.json({ success: true });
    }
    
    if (resource === 'tickets') {
       await prisma.ticket.delete({ where: { id } });
       await createAuditLog(tokenUser.userId, 'DELETE_TICKET', 'Ticket', id);
       return NextResponse.json({ success: true });
    }

    if (resource === 'notifications') {
       await prisma.notification.delete({ where: { id, userId: tokenUser.userId } });
       return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Recurso no válido' }, { status: 400 });
  } catch (error) {
    console.error('Dashboard DELETE error:', error);
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 });
  }
}
