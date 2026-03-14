'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Banknote, 
  BarChart3, 
  TrendingUp, 
  Car, 
  Calendar, 
  Download, 
  MoreHorizontal,
  ArrowUpRight,
  ArrowDownRight,
  Search
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface ChartData { date: string; day: string; revenue: number; transactions: number }
interface Stats { monthRevenue: number; todayRevenue: number; avgTicket: number; totalTickets: number }

export default function ReportsPage() {
  const [chart, setChart] = useState<ChartData[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem('accessToken')}` };
      const [cRes, sRes] = await Promise.all([
        fetch('/api/dashboard?resource=revenue-chart', { headers }),
        fetch('/api/dashboard?resource=stats', { headers }),
      ]);
      
      if (cRes.ok) setChart(await cRes.json());
      if (sRes.ok) {
        const s = await sRes.json();
        setStats({
          monthRevenue: s.monthRevenue,
          todayRevenue: s.todayRevenue,
          avgTicket: s.todayRevenue / (s.todayTransactions || 1),
          totalTickets: s.todayVehicles
        });
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const maxRev = Math.max(...chart.map(d => d.revenue), 1);

  if (loading) return <div style={{ height: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner" /></div>;

  return (
    <div className="animate-premium">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
           <h2 style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>Reportes Financieros</h2>
           <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Análisis de ingresos, ocupación y rendimiento operativo</span>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
           <button className="white-card" style={{ padding: '0 24px', height: '48px', display: 'flex', alignItems: 'center', gap: '10px', border: 'none', cursor: 'pointer', fontWeight: 800 }}>
              <Calendar size={18} /> Últimos 7 días
           </button>
           <button className="btn-primary" style={{ padding: '0 32px', height: '48px' }}>
              <Download size={18} /> Exportar PDF
           </button>
        </div>
      </div>

      {/* KPI Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px', marginBottom: '40px' }}>
         {[
           { label: 'Ingresos Mensuales', value: formatCurrency(stats?.monthRevenue || 0), icon: <Banknote size={22} />, up: true, trend: '12%' },
           { label: 'Ingresos Hoy', value: formatCurrency(stats?.todayRevenue || 0), icon: <TrendingUp size={22} />, up: true, trend: '5%' },
           { label: 'Ticket Promedio', value: formatCurrency(stats?.avgTicket || 0), icon: <BarChart3 size={22} />, up: false, trend: '2%' },
           { label: 'Vehículos Hoy', value: String(stats?.totalTickets || 0), icon: <Car size={22} />, up: true, trend: '8%' },
         ].map((kpi, i) => (
           <div key={i} className="glass-card glow" style={{ padding: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                 <div style={{ padding: '12px', borderRadius: '16px', background: 'var(--bg-primary)', color: 'var(--accent-gold)' }}>{kpi.icon}</div>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: kpi.up ? 'var(--accent-success)' : 'var(--accent-danger)', fontSize: '12px', fontWeight: 800 }}>
                    {kpi.up ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />} {kpi.trend}
                 </div>
              </div>
              <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>{kpi.label}</div>
              <div style={{ fontSize: '26px', fontWeight: 900 }}>{kpi.value}</div>
           </div>
         ))}
      </div>

      {/* Main Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: '32px' }}>
         <div className="glass-card" style={{ padding: '40px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '48px' }}>
               <h3 style={{ fontSize: '18px', fontWeight: 900 }}>Flujo de Ingresos Diarios</h3>
               <MoreHorizontal size={20} color="var(--text-muted)" />
            </div>
            
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '24px', height: '300px', paddingBottom: '32px', borderBottom: '1px solid var(--border-color)' }}>
               {chart.map((d, i) => (
                 <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                    <div style={{ 
                       width: '100%', borderRadius: '12px 12px 4px 4px',
                       background: i === chart.length - 1 ? 'var(--accent-gold)' : 'var(--text-primary)',
                       height: `${(d.revenue / maxRev) * 100}%`,
                       minHeight: '8px',
                       transition: 'height 1s ease',
                       position: 'relative',
                       opacity: i === chart.length - 1 ? 1 : 0.8
                    }}>
                       <div style={{ position: 'absolute', top: '-24px', width: '100%', textAlign: 'center', fontSize: '11px', fontWeight: 900 }}>
                          {d.revenue > 0 ? `$${(d.revenue / 1000).toFixed(0)}k` : ''}
                       </div>
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-muted)' }}>{d.day}</span>
                 </div>
               ))}
            </div>
         </div>

         <div className="glass-card" style={{ padding: '40px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 900, marginBottom: '40px' }}>Distribución por Método</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
               {[
                 { label: 'Efectivo', pct: 65, color: 'var(--accent-gold)' },
                 { label: 'Tarjeta Crédito', pct: 25, color: 'var(--text-primary)' },
                 { label: 'Digital (Nequi/Daviplata)', pct: 10, color: 'var(--accent-success)' }
               ].map(m => (
                 <div key={m.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '13px', fontWeight: 800 }}>
                       <span>{m.label}</span>
                       <span>{m.pct}%</span>
                    </div>
                    <div style={{ width: '100%', height: '10px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-pill)', overflow: 'hidden' }}>
                       <div style={{ width: `${m.pct}%`, height: '100%', background: m.color, borderRadius: 'var(--radius-pill)' }} />
                    </div>
                 </div>
               ))}
            </div>

            <div style={{ marginTop: '48px', padding: '24px', borderRadius: '24px', background: 'var(--bg-primary)', display: 'flex', gap: '16px', alignItems: 'center' }}>
               <div style={{ padding: '10px', borderRadius: '12px', background: 'white' }}><Download size={18} /></div>
               <div>
                  <div style={{ fontSize: '13px', fontWeight: 800 }}>Reporte Detallado</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>Descargar desglose de transacciones</div>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
