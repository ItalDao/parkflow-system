'use client';

import { 
  LayoutDashboard, 
  Map as MapIcon, 
  Ticket, 
  Car, 
  CreditCard, 
  Clock, 
  LineChart, 
  Users, 
  Settings, 
  LogOut, 
  Menu, 
  ParkingCircle, 
  Shield, 
  Bell, 
  Tag,
  Search,
  Thermometer,
  Droplets,
  Zap,
  Bike,
  Truck as TruckIcon,
  ChevronRight,
  MoreHorizontal,
  Calendar
} from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';

const menuItems = [
  { href: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={22} />, roles: ['SUPER_ADMIN', 'ADMIN'] },
  { href: '/dashboard/parking-map', label: 'Mensajes', icon: <MapIcon size={22} />, roles: ['SUPER_ADMIN', 'ADMIN', 'OPERATOR'] }, // 'Massage' in image -> probably Messages/Alerts
  { href: '/dashboard/tickets', label: 'Reservación', icon: <Ticket size={22} />, roles: ['SUPER_ADMIN', 'ADMIN', 'OPERATOR'] },
  { href: '/dashboard/management', label: 'Gestión', icon: <Settings size={22} />, roles: ['SUPER_ADMIN', 'ADMIN'] },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<{ firstName: string; lastName: string; role: string; email: string } | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const userData = localStorage.getItem('user');
    if (!token || !userData) {
      router.push('/');
      return;
    }
    setUser(JSON.parse(userData));
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    router.push('/');
  };

  if (!user) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}><div className="spinner" /></div>;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', position: 'relative' }}>
      {/* Top Pill NavBar */}
      <header className="navbar-pill animate-premium" style={{ 
        position: 'sticky', top: '20px', zIndex: 100, 
        margin: '0 20px 40px', justifyContent: 'space-between',
        height: '72px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
          <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px', paddingLeft: '12px' }}>
            Parkzone
          </div>
          <nav style={{ display: 'flex', gap: '4px' }}>
            {menuItems.map((item) => (
              <Link key={item.href} href={item.href} className={`nav-link-pill ${pathname === item.href ? 'active' : ''}`}>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
           <div style={{ display: 'flex', gap: '8px' }}>
              <div className="white-card" style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: 'none' }}><Search size={18} /></div>
              <Link href="/dashboard/settings" title="Ajustes de Sede" className="white-card" style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'inherit' }}><Settings size={18} /></Link>
              <Link href="/dashboard/notifications" title="Notificaciones" className="white-card" style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'inherit' }}><Bell size={18} /></Link>
           </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
               <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '14px', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1.2 }}>{user.firstName} {user.lastName}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>Usuario Parking</div>
               </div>
              <div style={{ position: 'relative' }}>
                 <div style={{ 
                   width: '40px', height: '40px', borderRadius: '50%', overflow: 'hidden', 
                   background: '#e2e8f0', border: '1px solid white',
                   display: 'flex', alignItems: 'center', justifyContent: 'center',
                   fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)'
                 }}>
                   {user.firstName[0]}
                 </div>
                <div style={{ position: 'absolute', bottom: -2, right: -2, width: '12px', height: '12px', background: '#10b981', borderRadius: '50%', border: '2px solid white' }} />
              </div>
              <button title="Cerrar Sesión" onClick={handleLogout} style={{ background: 'none', border: 'none', color: '#ef4444', padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <LogOut size={20} />
              </button>
           </div>
        </div>
      </header>

      {/* Main content Area */}
      <main style={{ padding: '0 20px 40px', maxWidth: '1440px', margin: '0 auto' }}>
        <div className="animate-premium">
          {children}
        </div>
      </main>
    </div>
  );
}
