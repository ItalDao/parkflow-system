'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { formatCurrency } from '@/lib/utils';
import { Banknote, BarChart3, TrendingUp, Ticket, Car, ParkingCircle } from 'lucide-react';

interface ChartData { date: string; day: string; revenue: number; transactions: number }
interface Stats { totalSpaces: number; occupiedSpaces: number; availableSpaces: number; occupancyRate: number; todayRevenue: number; monthRevenue: number; todayVehicles: number }

function getAuthHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem('accessToken')}`, 'Content-Type': 'application/json' };
}

export default function ReportsPage() {
  const [chart, setChart] = useState<ChartData[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const router = useRouter();

  const fetchData = useCallback(async () => {
    try {
      const [c, s] = await Promise.all([
        fetch('/api/dashboard?resource=revenue-chart', { headers: getAuthHeaders() }),
        fetch('/api/dashboard?resource=stats', { headers: getAuthHeaders() }),
      ]);
      
      if (c.status === 401) {
        localStorage.removeItem('accessToken');
        router.push('/');
        return;
      }
      
      if (c.ok) setChart(await c.json());
      if (s.ok) setStats(await s.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const maxRev = Math.max(...chart.map(d => d.revenue), 1);
  const totalRev = chart.reduce((a, d) => a + d.revenue, 0);
  const totalTx = chart.reduce((a, d) => a + d.transactions, 0);
  const avgRev = chart.length > 0 ? totalRev / chart.length : 0;

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}><div className="spinner" /></div>;

  return (
    <div className="animate-fade-in">
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        {[
          { label: 'Recaudación Semanal', value: formatCurrency(totalRev), icon: <Banknote size={22} />, color: 'var(--accent-primary)', trend: '+12.5%' },
          { label: 'Proyección Mensual', value: formatCurrency(stats?.monthRevenue || 0), icon: <BarChart3 size={22} />, color: 'var(--accent-secondary)', trend: '+5.2%' },
          { label: 'Ticket Promedio', value: formatCurrency(avgRev), icon: <TrendingUp size={22} />, color: 'var(--accent-success)', trend: 'Estable' },
          { label: 'Flujo de Vehículos', value: String(totalTx), icon: <Car size={22} />, color: 'var(--accent-info)', trend: 'Activo' },
        ].map((kpi, i) => (
          <div key={i} className="glass-card glow" style={{ padding: '28px', borderLeft: `4px solid ${kpi.color}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', alignItems: 'center' }}>
              <div style={{ padding: '10px', borderRadius: '12px', background: `${kpi.color}11`, color: kpi.color }}>{kpi.icon}</div>
              <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--accent-success)', padding: '4px 8px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.08)' }}>{kpi.trend}</span>
            </div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>{kpi.label}</div>
            <div style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
        {/* Revenue chart */}
        <div className="glass-card accent-border" style={{ padding: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
             <h3 style={{ fontSize: '18px', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '10px' }}>
               <TrendingUp size={20} color="var(--accent-primary)" /> Ingresos por Jornada
             </h3>
             <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Últimos 7 días</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', height: '260px', paddingBottom: '20px' }}>
            {chart.map((d, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '100%', borderRadius: '10px 10px 4px 4px',
                  background: 'var(--accent-gradient)',
                  height: `${Math.max((d.revenue / maxRev) * 100, 5)}%`,
                  transition: 'height 1s cubic-bezier(0.16, 1, 0.3, 1)', 
                  opacity: i === chart.length - 1 ? 1 : 0.6,
                  position: 'relative',
                  boxShadow: '0 4px 12px rgba(2, 132, 199, 0.2)'
                }}>
                   <div style={{ position: 'absolute', top: '-24px', width: '100%', textAlign: 'center', fontSize: '10px', fontWeight: 900, color: 'var(--accent-primary)' }}>
                     {d.revenue > 0 ? `${(d.revenue / 1000).toFixed(0)}k` : ''}
                   </div>
                </div>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>{d.day}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Transactions chart */}
        <div className="glass-card accent-border" style={{ padding: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
             <h3 style={{ fontSize: '18px', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '10px' }}>
               <Car size={20} color="var(--accent-secondary)" /> Frecuencia de Vehículos
             </h3>
             <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Flujo de tráfico</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', height: '260px', paddingBottom: '20px' }}>
            {chart.map((d, i) => {
              const maxTx = Math.max(...chart.map(x => x.transactions), 1);
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '100%', borderRadius: '10px 10px 4px 4px',
                    background: 'linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)',
                    height: `${Math.max((d.transactions / maxTx) * 100, 5)}%`,
                    transition: 'height 1s cubic-bezier(0.16, 1, 0.3, 1)', 
                    opacity: 0.8,
                    position: 'relative'
                  }}>
                     <div style={{ position: 'absolute', top: '-24px', width: '100%', textAlign: 'center', fontSize: '10px', fontWeight: 900, color: 'var(--accent-secondary)' }}>
                       {d.transactions}
                     </div>
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>{d.day}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
