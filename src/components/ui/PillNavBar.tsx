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
  LogOut,
  MessageSquare,
  Clock,
  Activity,
  Users,
  Wallet,
  FileSearch,
  UserCircle2,
  ChevronDown
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  roles?: Array<'SUPER_ADMIN' | 'ADMIN' | 'OPERATOR'>;
  primary?: boolean;
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} />, primary: true },
  { href: '/dashboard/parking-map', label: 'Mapa', icon: <MapPin size={18} />, primary: true },
  { href: '/dashboard/tickets', label: 'Tickets', icon: <Ticket size={18} />, primary: true },
  { href: '/dashboard/shifts', label: 'Turnos', icon: <Clock size={18} />, primary: true },
  { href: '/dashboard/reports', label: 'Reportes', icon: <Activity size={18} />, roles: ['SUPER_ADMIN', 'ADMIN'], primary: true },
  { href: '/dashboard/payments', label: 'Pagos', icon: <Wallet size={18} />, roles: ['SUPER_ADMIN', 'ADMIN'], primary: true },
  { href: '/dashboard/management', label: 'Gestión', icon: <Settings size={18} />, roles: ['SUPER_ADMIN', 'ADMIN'], primary: true },
  { href: '/dashboard/users', label: 'Usuarios', icon: <Users size={18} />, roles: ['SUPER_ADMIN', 'ADMIN'] },
  { href: '/dashboard/subscriptions', label: 'Suscripciones', icon: <UserCircle2 size={18} />, roles: ['SUPER_ADMIN', 'ADMIN'] },
  { href: '/dashboard/audit', label: 'Auditoría', icon: <FileSearch size={18} />, roles: ['SUPER_ADMIN'] },
  { href: '/dashboard/settings', label: 'Settings', icon: <Settings size={18} />, roles: ['SUPER_ADMIN', 'ADMIN'] },
];

type NavbarUser = {
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: string;
};

export function PillNavBar({ user, onLogout }: { user: NavbarUser | null; onLogout: () => void }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement | null>(null);

  const role = String(user?.role || '').toUpperCase();
  const visibleNavItems = navItems.filter((item) => {
    if (!item.roles || item.roles.length === 0) return true;
    return item.roles.includes(role as 'SUPER_ADMIN' | 'ADMIN' | 'OPERATOR');
  });
  const primaryNavItems = visibleNavItems.filter((item) => item.primary);
  const secondaryNavItems = visibleNavItems.filter((item) => !item.primary);
  const secondaryActive = secondaryNavItems.some((item) => pathname === item.href);

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onClickOutside = (evt: MouseEvent) => {
      if (!moreRef.current) return;
      if (!moreRef.current.contains(evt.target as Node)) {
        setMoreOpen(false);
      }
    };
    window.addEventListener('mousedown', onClickOutside);
    return () => window.removeEventListener('mousedown', onClickOutside);
  }, []);

  const roleLabel = (() => {
    const role = String(user?.role || '').toUpperCase();
    if (role === 'SUPER_ADMIN') return 'Super Admin';
    if (role === 'ADMIN') return 'Administrador';
    if (role === 'OPERATOR') return 'Operador';
    return 'Usuario';
  })();

  return (
    <header className="navbar-pill navbar-future animate-premium">
      {/* Brand/Logo */}
      <div className="navbar-pill__brand">
        <div className="navbar-pill__logo">
          <MapPin size={18} color="white" />
        </div>
        <span className="navbar-pill__name">ParkingOS</span>
      </div>

      {/* Navigation Links */}
      <nav className="nav-pill-group" aria-label="Navegación principal">
        {primaryNavItems.map((item) => {
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

      {secondaryNavItems.length > 0 && (
        <div ref={moreRef} className={`nav-more-group ${moreOpen ? 'open' : ''} navbar-more-slot`}>
          <button
            type="button"
            className={`nav-link-pill nav-more-btn ${secondaryActive ? 'active' : ''}`}
            onClick={() => setMoreOpen((v) => !v)}
            aria-expanded={moreOpen}
            aria-haspopup="menu"
          >
            <span>Más</span>
            <ChevronDown size={14} />
          </button>
          <div className="nav-more-menu" role="menu">
            {secondaryNavItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link key={item.href} href={item.href} className={`nav-more-item ${isActive ? 'active' : ''}`} role="menuitem">
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* User & Actions */}
      <div className="navbar-actions">
        <div className="navbar-quick-actions" style={{ display: 'flex', gap: '10px' }}>
          <Link href="/dashboard/profile" className="icon-btn-pill" title="Mi perfil">
            <UserCircle2 size={18} />
          </Link>
          <Link href="/dashboard/messages" className="icon-btn-pill"><MessageSquare size={18} /></Link>
          <Link href="/dashboard/notifications" className="icon-btn-pill" title="Notificaciones">
            <Bell size={18} />
          </Link>
        </div>

        <div className="navbar-separator" style={{ width: '1px', height: '24px', background: 'rgba(0,0,0,0.1)' }} />

        <div className="navbar-user-block" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div className="navbar-user-meta">
            <div className="navbar-user-name">{user?.firstName || 'Usuario'}</div>
            <div className="navbar-user-role">{roleLabel}</div>
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
            className="icon-btn-pill"
            title="Cerrar sesión"
            style={{ 
              color: 'var(--accent-danger)'
            }}
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>
    </header>
  );
}
