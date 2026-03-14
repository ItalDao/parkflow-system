import { type ClassValue, clsx } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return inputs.filter(Boolean).join(" ");
}

export function formatCurrency(amount: number, currency: string = 'COP'): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export function generateTicketCode(): string {
  const prefix = 'PKG';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

export function getTimeAgo(date: Date | string): string {
  const now = new Date();
  const past = new Date(date);
  const diff = now.getTime() - past.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return 'Ahora';
  if (minutes < 60) return `Hace ${minutes}m`;
  if (hours < 24) return `Hace ${hours}h`;
  return `Hace ${days}d`;
}

export function getOccupancyColor(percentage: number): string {
  if (percentage < 50) return 'text-emerald-400';
  if (percentage < 75) return 'text-amber-400';
  if (percentage < 90) return 'text-orange-400';
  return 'text-red-400';
}

export function getOccupancyBgColor(percentage: number): string {
  if (percentage < 50) return 'bg-emerald-400/20';
  if (percentage < 75) return 'bg-amber-400/20';
  if (percentage < 90) return 'bg-orange-400/20';
  return 'bg-red-400/20';
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    AVAILABLE: 'bg-emerald-500',
    OCCUPIED: 'bg-red-500',
    RESERVED: 'bg-blue-500',
    MAINTENANCE: 'bg-amber-500',
    OUT_OF_SERVICE: 'bg-gray-500',
    ACTIVE: 'bg-emerald-500',
    COMPLETED: 'bg-blue-500',
    CANCELLED: 'bg-gray-500',
    LOST: 'bg-red-500',
    EXPIRED: 'bg-amber-500',
  };
  return colors[status] || 'bg-gray-500';
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    AVAILABLE: 'Disponible',
    OCCUPIED: 'Ocupado',
    RESERVED: 'Reservado',
    MAINTENANCE: 'Mantenimiento',
    OUT_OF_SERVICE: 'Fuera de servicio',
    ACTIVE: 'Activo',
    COMPLETED: 'Completado',
    CANCELLED: 'Cancelado',
    LOST: 'Perdido',
    EXPIRED: 'Expirado',
  };
  return labels[status] || status;
}

import { Car, Bike, Truck, Zap, Calendar, Ship } from 'lucide-react';
import React from 'react';

export function getVehicleTypeIcon(type: string, size: number = 20) {
  const icons: Record<string, React.ReactNode> = {
    CAR: <Car size={size} />,
    MOTORCYCLE: <Bike size={size} />,
    TRUCK: <Truck size={size} />,
    VAN: <Ship size={size} />, // Using Ship/Bus for Van as proxy
    ELECTRIC: <Zap size={size} />,
    BICYCLE: <Bike size={size} />,
  };
  return icons[type] || <Car size={size} />;
}

export function getVehicleTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    CAR: 'Automóvil',
    MOTORCYCLE: 'Motocicleta',
    TRUCK: 'Camión',
    VAN: 'Camioneta',
    ELECTRIC: 'Eléctrico',
    BICYCLE: 'Bicicleta',
  };
  return labels[type] || type;
}
