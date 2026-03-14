'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { formatCurrency, formatDate } from '@/lib/utils';
import { 
  Calendar, 
  CreditCard, 
  User, 
  Car, 
  PlusCircle, 
  Search, 
  Filter, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Loader2, 
  ShieldCheck,
  Zap,
  Tag
} from 'lucide-react';

interface Subscription {
  id: string;
  type: string;
  status: string;
  startDate: string;
  endDate: string;
  price: number;
  autoRenew: boolean;
  user: { firstName: string; lastName: string; email: string };
  vehicle: { plate: string; type: string; brand?: string };
}

function getAuthHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem('accessToken')}`, 'Content-Type': 'application/json' };
}

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetchSubscriptions();
  }, [router]);

  const fetchSubscriptions = async () => {
    try {
      const res = await fetch('/api/dashboard?resource=subscriptions', { headers: getAuthHeaders() });
      if (res.status === 401) {
        localStorage.removeItem('accessToken');
        router.push('/');
        return;
      }
      if (res.ok) setSubscriptions(await res.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const filtered = subscriptions.filter(s => 
    s.user.email.toLowerCase().includes(search.toLowerCase()) ||
    s.vehicle.plate.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    active: subscriptions.filter(s => s.status === 'ACTIVE').length,
    expiring: subscriptions.filter(s => {
      const diff = new Date(s.endDate).getTime() - Date.now();
      return diff > 0 && diff < 7 * 24 * 60 * 60 * 1000;
    }).length,
    revenue: subscriptions.reduce((a, b) => a + b.price, 0),
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}><Loader2 className="animate-spin" size={40} color="var(--accent-primary)" /></div>;

  return (
    <div className="animate-premium">
      {/* Metrics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        {[
          { label: 'Abonados Activos', val: stats.active, icon: <ShieldCheck size={22} />, color: 'var(--accent-success)' },
          { label: 'Por Vencer (7 días)', val: stats.expiring, icon: <Clock size={22} />, color: 'var(--accent-warning)' },
          { label: 'Ingresos Mensualidades', val: formatCurrency(stats.revenue), icon: <Zap size={22} />, color: 'var(--accent-primary)' },
        ].map((s, i) => (
          <div key={i} className="glass-card glow" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '18px', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color }}>
              {s.icon}
            </div>
            <div>
              <p style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>{s.label}</p>
              <h3 style={{ fontSize: '24px', fontWeight: 900 }}>{s.val}</h3>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', gap: '20px' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
          <Search size={18} style={{ position: 'absolute', left: '16px', top: '15px', color: 'var(--text-muted)' }} />
          <input className="input-field" placeholder="Buscar por placa o cliente..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: '48px', height: '48px' }} />
        </div>
        <button className="btn-primary" onClick={() => setShowAdd(true)} style={{ display: 'flex', alignItems: 'center', gap: '10px', height: '48px' }}>
          <PlusCircle size={18} /> Nueva Mensualidad
        </button>
      </div>

      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ padding: '20px' }}>Cliente</th>
              <th>Vehículo</th>
              <th>Tipo</th>
              <th>Validez</th>
              <th>Estado</th>
              <th style={{ textAlign: 'right', paddingRight: '20px' }}>Precio</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id}>
                <td style={{ padding: '16px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                     <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                       <User size={18} color="var(--accent-primary)" />
                     </div>
                     <div>
                       <div style={{ fontWeight: 700, fontSize: '14px' }}>{s.user.firstName} {s.user.lastName}</div>
                       <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{s.user.email}</div>
                     </div>
                  </div>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, color: 'var(--text-primary)' }}>
                    <Car size={16} color="var(--text-muted)" /> {s.vehicle.plate}
                  </div>
                </td>
                <td><span className="badge badge-purple">{s.type === 'FIXED' ? 'ESPACIO FIJO' : 'FLOTANTE'}</span></td>
                <td>
                  <div style={{ fontSize: '12px', fontWeight: 600 }}>
                    <div>Hasta: {formatDate(s.endDate)}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{s.autoRenew ? 'Renovación automática' : 'Pago único'}</div>
                  </div>
                </td>
                <td>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                     {s.status === 'ACTIVE' ? <CheckCircle2 size={14} color="var(--accent-success)" /> : <AlertCircle size={14} color="var(--accent-danger)" />}
                     <span style={{ fontSize: '13px', fontWeight: 700 }}>{s.status === 'ACTIVE' ? 'Al día' : 'Vencido'}</span>
                   </div>
                </td>
                <td style={{ textAlign: 'right', paddingRight: '20px', fontWeight: 900, color: 'var(--accent-primary)' }}>
                  {formatCurrency(s.price)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
             <Tag size={48} style={{ marginBottom: '16px', opacity: 0.2 }} />
             <p>No hay mensualidades registradas con esos criterios.</p>
          </div>
        )}
      </div>

      {/* Placeholder Modal for Adding Subscription */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
           <div className="modal-content-premium animate-premium" onClick={e => e.stopPropagation()}>
             <h3 style={{ fontSize: '22px', fontWeight: 900, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <PlusCircle size={28} color="var(--accent-primary)" /> Nuevo Contrato
             </h3>
             <div className="form-grid">
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="input-label">Email del Cliente</label>
                  <input className="input-field" placeholder="cliente@ejemplo.com" />
                </div>
                <div className="form-group">
                  <label className="input-label">Placa</label>
                  <input className="input-field" placeholder="ABC-123" />
                </div>
                <div className="form-group">
                  <label className="input-label">Tipo Espacio</label>
                  <select className="input-field">
                    <option value="FLOTANTE">Flotante</option>
                    <option value="FIXED">Fijo (Reservado)</option>
                  </select>
                </div>
                <div className="form-group">
                   <label className="input-label">Meses</label>
                   <input type="number" className="input-field" defaultValue="1" />
                </div>
                <div className="form-group">
                   <label className="input-label">Valor Pactado</label>
                   <input type="number" className="input-field" placeholder="350000" />
                </div>
             </div>
             <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
                <button className="btn-primary" style={{ flex: 1, height: '56px' }}>Registrar Contrato</button>
                <button className="btn-secondary" style={{ flex: 1, height: '56px' }} onClick={() => setShowAdd(false)}>Cerrar</button>
             </div>
           </div>
        </div>
      )}
    </div>
  );
}
