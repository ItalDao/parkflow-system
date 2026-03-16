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
   Search,
   FileDown
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface ChartData { date: string; day: string; revenue: number; transactions: number }
interface Stats { monthRevenue: number; todayRevenue: number; avgTicket: number; totalTickets: number }

type BreakdownItem = { method: string; total: number; count: number };
type BreakdownResponse = { days: number; total: number; items: BreakdownItem[] };

function getAuthHeaders() {
   return { Authorization: `Bearer ${localStorage.getItem('accessToken')}` };
}

function methodLabel(method: string) {
   switch (method) {
      case 'CASH':
         return 'Efectivo';
      case 'CARD':
         return 'Tarjeta';
      case 'DIGITAL_WALLET':
         return 'Billetera Digital';
      case 'PREPAID':
         return 'Prepago';
      case 'MONTHLY':
         return 'Mensualidad';
      default:
         return method;
   }
}

function buildReportsPrintableHtml(args: { days: number; stats: Stats | null; chart: ChartData[]; breakdown: BreakdownResponse | null }) {
   const safe = (s: unknown) => String(s ?? '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
   const { days, stats, chart, breakdown } = args;

   const breakdownRows = (breakdown?.items || [])
      .map((it) => {
         const pct = breakdown?.total ? Math.round((it.total / breakdown.total) * 100) : 0;
         return `<tr><td>${safe(methodLabel(it.method))}</td><td style="text-align:right;">${safe(it.count)}</td><td style="text-align:right; font-weight:900;">${safe(formatCurrency(it.total))}</td><td style="text-align:right;">${safe(pct)}%</td></tr>`;
      })
      .join('');

   const chartRows = chart
      .map((d) => `<tr><td>${safe(d.date)}</td><td>${safe(d.day)}</td><td style="text-align:right; font-weight:900;">${safe(formatCurrency(d.revenue))}</td><td style="text-align:right;">${safe(d.transactions)}</td></tr>`)
      .join('');

   return `<!doctype html>
   <html lang="es">
      <head>
         <meta charset="utf-8" />
         <meta name="viewport" content="width=device-width, initial-scale=1" />
         <title>Reporte Financiero</title>
         <style>
            body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 0; padding: 24px; }
            .card { border: 2px solid #111827; border-radius: 16px; padding: 18px; max-width: 920px; margin: 0 auto; }
            .muted { color: #6b7280; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; }
            .title { font-size: 22px; font-weight: 900; margin: 0; }
            .grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 10px; margin-top: 12px; }
            .kpi { border: 1px solid #e5e7eb; border-radius: 14px; padding: 12px; }
            .kpi .v { font-size: 16px; font-weight: 900; }
            .hr { height: 1px; background: #e5e7eb; margin: 14px 0; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 10px 8px; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
            th { text-align: left; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: .05em; }
            @media print { body { padding: 0; } .card { border: none; } }
         </style>
      </head>
      <body>
         <div class="card">
            <div style="display:flex; justify-content:space-between; align-items:baseline; gap: 16px;">
               <div>
                  <div class="muted">Reporte</div>
                  <h1 class="title">Finanzas (últimos ${safe(days)} días)</h1>
               </div>
               <div style="text-align:right;">
                  <div class="muted">Generado</div>
                  <div style="font-weight:900;">${safe(new Date().toLocaleString('es-CO'))}</div>
               </div>
            </div>

            <div class="grid">
               <div class="kpi"><div class="muted">Ingresos Mensuales</div><div class="v">${safe(formatCurrency(stats?.monthRevenue || 0))}</div></div>
               <div class="kpi"><div class="muted">Ingresos Hoy</div><div class="v">${safe(formatCurrency(stats?.todayRevenue || 0))}</div></div>
               <div class="kpi"><div class="muted">Ticket Promedio</div><div class="v">${safe(formatCurrency(stats?.avgTicket || 0))}</div></div>
               <div class="kpi"><div class="muted">Vehículos Hoy</div><div class="v">${safe(String(stats?.totalTickets || 0))}</div></div>
            </div>

            <div class="hr"></div>

            <div class="muted" style="margin-bottom:8px;">Distribución por Método</div>
            <table>
               <thead><tr><th>Método</th><th style="text-align:right;">Transacciones</th><th style="text-align:right;">Total</th><th style="text-align:right;">%</th></tr></thead>
               <tbody>${breakdownRows || '<tr><td colspan="4" style="color:#6b7280;">Sin datos</td></tr>'}</tbody>
            </table>

            <div class="hr"></div>

            <div class="muted" style="margin-bottom:8px;">Ingresos Diarios</div>
            <table>
               <thead><tr><th>Fecha</th><th>Día</th><th style="text-align:right;">Ingresos</th><th style="text-align:right;">Transacciones</th></tr></thead>
               <tbody>${chartRows || '<tr><td colspan="4" style="color:#6b7280;">Sin datos</td></tr>'}</tbody>
            </table>
         </div>
         <script>window.focus(); window.print();</script>
      </body>
   </html>`;
}

export default function ReportsPage() {
  const [chart, setChart] = useState<ChartData[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
   const [days, setDays] = useState(7);
   const [breakdown, setBreakdown] = useState<BreakdownResponse | null>(null);

  const fetchData = useCallback(async () => {
    try {
         const headers = getAuthHeaders();
         const [cRes, sRes, bRes] = await Promise.all([
            fetch(`/api/dashboard?resource=revenue-chart&days=${days}`, { headers }),
            fetch('/api/dashboard?resource=stats', { headers }),
            fetch(`/api/dashboard?resource=payment-method-breakdown&days=${days}`, { headers }),
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
         if (bRes.ok) setBreakdown(await bRes.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
   }, [days]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const maxRev = Math.max(...chart.map(d => d.revenue), 1);

  if (loading) return <div style={{ height: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner" /></div>;

   const totalBreakdown = breakdown?.total || 0;

   const handlePrint = () => {
      const html = buildReportsPrintableHtml({ days, stats, chart, breakdown });
      const win = window.open('', '_blank', 'noopener,noreferrer');
      if (!win) return;
      win.document.open();
      win.document.write(html);
      win.document.close();
   };

   const exportPaymentsCsv = async () => {
      try {
         const res = await fetch(`/api/dashboard?resource=payments&days=${days}&take=500`, { headers: getAuthHeaders() });
         if (!res.ok) return;
         const payments: any[] = await res.json();
         const rows = payments.map((p) => ({
            factura: p.invoiceNumber || '',
            ticket: p.ticket?.ticketCode || '',
            placa: p.ticket?.vehicle?.plate || '',
            metodo: p.method,
            monto: p.amount,
            operador: p.operator ? `${p.operator.firstName} ${p.operator.lastName}` : '',
            fecha: p.createdAt,
            estado: p.status,
         }));
         const header = Object.keys(rows[0] || { factura: '', ticket: '', placa: '', metodo: '', monto: 0, operador: '', fecha: '', estado: '' });
         const csv = [header.join(','), ...rows.map((r) => header.map((k) => JSON.stringify((r as any)[k] ?? '')).join(','))].join('\n');
         const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
         const url = URL.createObjectURL(blob);
         const a = document.createElement('a');
         a.href = url;
         a.download = `pagos_${days}d.csv`;
         document.body.appendChild(a);
         a.click();
         a.remove();
         URL.revokeObjectURL(url);
      } catch (err) {
         console.error(err);
      }
   };

  return (
    <div className="animate-premium">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
           <h2 style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>Reportes Financieros</h2>
           <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Análisis de ingresos, ocupación y rendimiento operativo</span>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
           <button
             className="white-card"
             style={{ padding: '0 24px', height: '48px', display: 'flex', alignItems: 'center', gap: '10px', border: 'none', cursor: 'pointer', fontWeight: 800 }}
             onClick={() => setDays((d) => (d === 7 ? 30 : 7))}
             title="Cambiar rango"
           >
              <Calendar size={18} /> Últimos {days} días
           </button>
           <button className="btn-primary" style={{ padding: '0 32px', height: '48px' }} onClick={handlePrint}>
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
               {(breakdown?.items?.length ? breakdown.items : []).map((m, idx) => {
                 const pct = totalBreakdown ? Math.round((m.total / totalBreakdown) * 100) : 0;
                 const color = idx === 0 ? 'var(--accent-gold)' : idx === 1 ? 'var(--text-primary)' : 'var(--accent-success)';
                 return (
                   <div key={m.method}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '13px', fontWeight: 800 }}>
                         <span>{methodLabel(m.method)}</span>
                         <span>{pct}%</span>
                      </div>
                      <div style={{ width: '100%', height: '10px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-pill)', overflow: 'hidden' }}>
                         <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 'var(--radius-pill)' }} />
                      </div>
                   </div>
                 );
               })}
               {(!breakdown?.items || breakdown.items.length === 0) && (
                 <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-muted)' }}>Sin datos para el rango seleccionado.</div>
               )}
            </div>

            <div
              style={{ marginTop: '48px', padding: '24px', borderRadius: '24px', background: 'var(--bg-primary)', display: 'flex', gap: '16px', alignItems: 'center', cursor: 'pointer' }}
              onClick={exportPaymentsCsv}
              title="Descargar CSV de pagos"
            >
               <div style={{ padding: '10px', borderRadius: '12px', background: 'white' }}><FileDown size={18} /></div>
               <div>
                  <div style={{ fontSize: '13px', fontWeight: 800 }}>Reporte Detallado</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>Descargar CSV de pagos (últimos {days} días)</div>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
