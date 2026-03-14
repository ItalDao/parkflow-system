'use client';

import { 
  LayoutDashboard, 
  Map as MapIcon, 
  Ticket, 
  Settings, 
  LogOut, 
  Bell, 
  Search
} from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { PillNavBar } from '@/components/ui/PillNavBar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
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
      <PillNavBar user={user} onLogout={handleLogout} />

      {/* Main content Area */}
      <main style={{ padding: '0 20px 40px', maxWidth: '1440px', margin: '0 auto' }}>
        <div className="animate-premium">
          {children}
        </div>
      </main>
    </div>
  );
}
