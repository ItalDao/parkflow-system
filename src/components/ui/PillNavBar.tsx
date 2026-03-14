'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  MapPin, 
  Ticket, 
  Settings, 
  Bell, 
  Search,
  LogOut,
  MessageSquare,
  Clock,
  Activity
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { href: '/dashboard/parking-map', label: 'Mapa', icon: <MapPin size={18} /> },
  { href: '/dashboard/tickets', label: 'Tickets', icon: <Ticket size={18} /> },
  { href: '/dashboard/shifts', label: 'Turnos', icon: <Clock size={18} /> },
  { href: '/dashboard/reports', label: 'Reportes', icon: <Activity size={18} /> },
  { href: '/dashboard/management', label: 'Gestión', icon: <Settings size={18} /> },
];

type NavbarUser = {
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: string;
};

export function PillNavBar({ user, onLogout }: { user: NavbarUser | null; onLogout: () => void }) {
  const pathname = usePathname();

  const roleLabel = (() => {
    const role = String(user?.role || '').toUpperCase();
    if (role === 'SUPER_ADMIN') return 'Super Admin';
    if (role === 'ADMIN') return 'Administrador';
    if (role === 'OPERATOR') return 'Operador';
    return 'Usuario';
  })();

  return (
    <header className="navbar-pill animate-premium">
      {/* Brand/Logo */}
      <div className="navbar-pill__brand">
        <div className="navbar-pill__logo">
          <MapPin size={18} color="white" />
        </div>
        <span className="navbar-pill__name">ParkingOS</span>
      </div>

      {/* Navigation Links */}
      <nav className="nav-pill-group" aria-label="Navegación principal">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link 
              key={item.href} 
              href={item.href}
              className={`nav-link-pill ${isActive ? 'active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User & Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="icon-btn-pill"><Search size={18} /></button>
          <Link href="/dashboard/messages" className="icon-btn-pill"><MessageSquare size={18} /></Link>
          <button className="icon-btn-pill"><Bell size={18} /></button>
        </div>

        <div style={{ width: '1px', height: '24px', background: 'rgba(0,0,0,0.1)' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '13px', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1 }}>
              {user?.firstName} {user?.lastName}
            </div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', marginTop: '4px' }}>
              {roleLabel}
            </div>
          </div>
          <div style={{ position: 'relative' }}>
             <div style={{ 
                width: '40px', height: '40px', borderRadius: '50%', 
                background: 'var(--bg-primary)', border: '2px solid white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)', overflow: 'hidden'
             }}>
                {(user?.firstName?.[0] || user?.email?.[0] || '?').toUpperCase()}
             </div>
             <div style={{ 
                position: 'absolute', bottom: 1, right: 1, 
                width: '10px', height: '10px', background: 'var(--accent-success)', 
                borderRadius: '50%', border: '2px solid white' 
             }} />
          </div>
          <button 
            onClick={onLogout}
            style={{ 
              background: 'none', border: 'none', color: 'var(--accent-danger)', 
              cursor: 'pointer', padding: '6px' 
            }}
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>
    </header>
  );
}
