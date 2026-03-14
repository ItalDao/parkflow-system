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
  User as UserIcon,
  MessageSquare
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
  { href: '/dashboard/parking-map', label: 'Mensajes', icon: <MessageSquare size={20} /> },
  { href: '/dashboard/tickets', label: 'Reservación', icon: <Ticket size={20} /> },
  { href: '/dashboard/management', label: 'Gestión', icon: <Settings size={20} /> },
];

export function PillNavBar({ user, onLogout }: { user: any, onLogout: () => void }) {
  const pathname = usePathname();

  return (
    <header className="navbar-pill animate-premium">
      {/* Brand/Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ 
          width: '36px', height: '36px', borderRadius: '12px', 
          background: 'var(--accent-gold)', display: 'flex', 
          alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(233, 185, 73, 0.4)'
        }}>
          <MapPin size={18} color="white" />
        </div>
        <span style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
          Parkzone
        </span>
      </div>

      {/* Navigation Links */}
      <nav style={{ 
        display: 'flex', gap: '8px', background: 'rgba(0,0,0,0.03)', 
        padding: '6px', borderRadius: 'var(--radius-pill)',
        border: '1px solid rgba(0,0,0,0.05)'
       }}>
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link 
              key={item.href} 
              href={item.href}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 24px', borderRadius: 'var(--radius-pill)',
                fontSize: '13px', fontWeight: 800, transition: 'all 0.3s ease',
                textDecoration: 'none',
                background: isActive ? 'white' : 'transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                boxShadow: isActive ? '0 4px 20px rgba(0,0,0,0.06)' : 'none',
                border: isActive ? '1px solid rgba(0,0,0,0.05)' : '1px solid transparent'
              }}
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
          <button className="icon-btn-pill"><Bell size={18} /></button>
        </div>

        <div style={{ width: '1px', height: '24px', background: 'rgba(0,0,0,0.1)' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '13px', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1 }}>
              {user?.firstName} {user?.lastName}
            </div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', marginTop: '4px' }}>
              Usuario Parking
            </div>
          </div>
          <div style={{ position: 'relative' }}>
             <div style={{ 
                width: '40px', height: '40px', borderRadius: '50%', 
                background: 'var(--bg-primary)', border: '2px solid white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)', overflow: 'hidden'
             }}>
                {user?.firstName[0]}
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

      <style jsx>{`
        .icon-btn-pill {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: 1px solid rgba(0,0,0,0.05);
          background: white;
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.3s ease;
        }
        .icon-btn-pill:hover {
          background: var(--bg-primary);
          transform: translateY(-2px);
        }
      `}</style>
    </header>
  );
}
