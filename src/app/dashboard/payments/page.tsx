'use client';

import { useState, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { formatCurrency, formatDate } from '@/lib/utils';

interface Payment {
  id: string; amount: number; method: string; status: string; invoiceNumber?: string;
  createdAt: string;
  ticket: { ticketCode: string; vehicle: { plate: string } };
  operator?: { firstName: string; lastName: string };
}

import { useRouter } from 'next/navigation';
import { Banknote, CreditCard, Smartphone, Ticket, CalendarDays, Search, Filter, Download } from 'lucide-react';

const methodLabel: Record<string, ReactNode> = {
  CASH: <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-success)' }}><Banknote size={16} /> Efectivo</div>, 
  CARD: <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-primary)' }}><CreditCard size={16} /> Tarjeta</div>, 
  DIGITAL_WALLET: <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#a855f7' }}><Smartphone size={16} /> Billetera Digital</div>, 
  PREPAID: <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-gold)' }}><Ticket size={16} /> Prepago</div>, 
  MONTHLY: <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}><CalendarDays size={16} /> Mensualidad</div>,
};

function getAuthHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem('accessToken')}`, 'Content-Type': 'application/json' };
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/dashboard?resource=payments', { headers: getAuthHeaders() });
        
        if (res.status === 401) {
          localStorage.removeItem('accessToken');
          router.push('/');
          return;
        }

        if (res.ok) setPayments(await res.json());
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    })();
  }, [router]);

  const totalToday = payments.filter(p => new Date(p.createdAt).toDateString() === new Date().toDateString())
    .reduce((a, p) => a + p.amount, 0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return payments;
    return payments.filter((p) => {
      const plate = p.ticket?.vehicle?.plate?.toLowerCase() || '';
      const code = p.ticket?.ticketCode?.toLowerCase() || '';
      const invoice = (p.invoiceNumber || '').toLowerCase();
      return plate.includes(q) || code.includes(q) || invoice.includes(q);
    });
  }, [payments, query]);

  const exportCsv = () => {
    const rows = filtered.map((p) => ({
      factura: p.invoiceNumber || '',
      ticket: p.ticket?.ticketCode || '',
      placa: p.ticket?.vehicle?.plate || '',
      metodo: p.method,
      monto: p.amount,
      operador: p.operator ? `${p.operator.firstName} ${p.operator.lastName}` : 'Sistema',
      fecha: p.createdAt,
      estado: p.status,
    }));

    const header = Object.keys(rows[0] || { factura: '', ticket: '', placa: '', metodo: '', monto: 0, operador: '', fecha: '', estado: '' });
    const escape = (v: unknown) => {
      const s = String(v ?? '');
      const needsQuotes = /[\n\r,\"]/g.test(s);
      const escaped = s.replace(/\"/g, '""');
      return needsQuotes ? `"${escaped}"` : escaped;
    };
    const csv = [header.join(','), ...rows.map(r => header.map(h => escape((r as any)[h])).join(','))].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pagos_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}><div className="spinner" /></div>;

  return (
    <div className="animate-fade-in">
      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        <div className="glass-card glow" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: 'var(--accent-success)' }} />
          <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Recaudación Hoy</div>
          <div style={{ fontSize: '32px', fontWeight: 900, color: 'var(--accent-success)' }}>{formatCurrency(totalToday)}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Actualizado en tiempo real</div>
        </div>
        <div className="glass-card glow" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: 'var(--accent-primary)' }} />
          <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Transacciones Finalizadas</div>
          <div style={{ fontSize: '32px', fontWeight: 900, color: 'var(--accent-primary)' }}>{payments.length}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Basado en los últimos 50 registros</div>
        </div>
        <div className="glass-card glow" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: 'var(--accent-warning)' }} />
          <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Ticket de Venta Medio</div>
          <div style={{ fontSize: '32px', fontWeight: 900, color: 'var(--accent-warning)' }}>
            {formatCurrency(payments.length > 0 ? payments.reduce((a, p) => a + p.amount, 0) / payments.length : 0)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Promedio de facturación bruta</div>
        </div>
      </div>

      <div className="glass-card" style={{ padding: '30px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
           <h3 style={{ fontSize: '18px', fontWeight: 900 }}>Historial de Transacciones</h3>
           <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input className="input-field" placeholder="Buscar por placa, ticket o factura..." value={query} onChange={e => setQuery(e.target.value)} style={{ width: '300px', paddingLeft: '40px', height: '40px', fontSize: '13px' }} />
              </div>
              <button className="btn-secondary" style={{ height: '40px', padding: '0 20px' }} onClick={exportCsv} disabled={filtered.length === 0}>
                <Download size={16} /> Exportar
              </button>
           </div>
        </div>
        <table className="data-table">
          <thead>
            <tr><th>Factura</th><th>Placa</th><th>Método</th><th>Monto</th><th>Operador</th><th>Fecha</th><th>Estado</th></tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id}>
                <td style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent-primary)' }}>{p.invoiceNumber || 'N/A'}</td>
                <td style={{ fontWeight: 800, letterSpacing: '0.5px', color: 'var(--text-primary)' }}>{p.ticket.vehicle.plate}</td>
                <td>{methodLabel[p.method] || p.method}</td>
                <td style={{ fontWeight: 900, color: 'var(--text-primary)', fontSize: '15px' }}>{formatCurrency(p.amount)}</td>
                <td style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{p.operator ? `${p.operator.firstName} ${p.operator.lastName}` : 'Sistema'}</td>
                <td style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>{formatDate(p.createdAt)}</td>
                <td><span className="badge badge-success" style={{ padding: '6px 14px', borderRadius: '10px', fontSize: '11px', fontWeight: 800 }}>COMPLETADO</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
