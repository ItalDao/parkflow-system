'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Users, 
  Calendar, 
  Car, 
  CreditCard, 
  PlusCircle, 
  Search, 
  MoreHorizontal,
  Mail,
  Phone,
  CheckCircle2,
  XCircle,
  AlertTriangle
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard?resource=subscriptions', {
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
      });
      if (res.ok) setSubscriptions(await res.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <div style={{ height: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner" /></div>;

  return (
    <div className="animate-premium">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
           <h2 style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>Clientes Mensuales</h2>
           <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Gestión de suscripciones, renovaciones y convenios</span>
        </div>
        <button className="btn-primary" style={{ padding: '0 32px', height: '56px' }}>
           <PlusCircle size={20} /> Nueva Mensualidad
        </button>
      </div>

      <div style={{ display: 'flex', gap: '24px', marginBottom: '32px' }}>
         <div className="white-card" style={{ flex: 1, padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ padding: '12px', borderRadius: '14px', background: 'rgba(233, 185, 73, 0.1)', color: 'var(--accent-gold)' }}><Users size={24} /></div>
            <div>
               <div style={{ fontSize: '24px', fontWeight: 900 }}>{subscriptions.length}</div>
               <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)' }}>CLIENTES ACTIVOS</div>
            </div>
         </div>
         <div className="white-card" style={{ flex: 1, padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ padding: '12px', borderRadius: '14px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--accent-success)' }}><Calendar size={24} /></div>
            <div>
               <div style={{ fontSize: '24px', fontWeight: 900 }}>{subscriptions.filter(s => s.status === 'ACTIVE').length}</div>
               <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)' }}>SUSCRIPCIONES AL DÍA</div>
            </div>
         </div>
         <div className="white-card" style={{ flex: 1, padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ padding: '12px', borderRadius: '14px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-danger)' }}><AlertTriangle size={24} /></div>
            <div>
               <div style={{ fontSize: '24px', fontWeight: 900 }}>0</div>
               <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)' }}>VENCIMIENTOS PRÓXIMOS</div>
            </div>
         </div>
      </div>

      <div className="glass-card" style={{ padding: '40px' }}>
         <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '32px' }}>
            <div style={{ position: 'relative', width: '360px' }}>
               <input className="white-card" style={{ border: 'none', padding: '14px 16px 14px 48px', width: '100%', fontSize: '14px', fontWeight: 700 }} placeholder="Buscar por nombre, placa o documento..." />
               <Search size={18} style={{ position: 'absolute', left: '16px', top: '14px', color: 'var(--text-muted)' }} />
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
               <button className="white-card" style={{ padding: '0 20px', fontSize: '13px', fontWeight: 800, border: 'none', cursor: 'pointer' }}>Filtrar</button>
               <button className="white-card" style={{ padding: '0 20px', fontSize: '13px', fontWeight: 800, border: 'none', cursor: 'pointer' }}>Exportar</button>
            </div>
         </div>

         <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%' }}>
               <thead>
                  <tr>
                     <th style={{ paddingBottom: '24px' }}>Cliente</th>
                     <th>Vehículo</th>
                     <th>Vigencia</th>
                     <th>Precio</th>
                     <th>Estado</th>
                     <th style={{ textAlign: 'right' }}>Acciones</th>
                  </tr>
               </thead>
               <tbody>
                  {subscriptions.map(sub => (
                    <tr key={sub.id}>
                       <td style={{ paddingTop: '24px', paddingBottom: '24px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                             <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: 'var(--accent-gold)' }}>
                                {sub.user.firstName[0]}
                             </div>
                             <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '15px', fontWeight: 900 }}>{sub.user.firstName} {sub.user.lastName}</span>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>{sub.user.email}</span>
                             </div>
                          </div>
                       </td>
                       <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                             <Car size={16} color="var(--text-muted)" />
                             <span style={{ fontSize: '14px', fontWeight: 800 }}>{sub.vehicle.plate}</span>
                          </div>
                       </td>
                       <td>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                             <span style={{ fontSize: '13px', fontWeight: 700 }}>{formatDate(sub.startDate)}</span>
                             <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Hasta: {formatDate(sub.endDate)}</span>
                          </div>
                       </td>
                       <td style={{ fontSize: '15px', fontWeight: 900 }}>{formatCurrency(sub.price)}</td>
                       <td>
                          <span className={`badge ${sub.status === 'ACTIVE' ? 'badge-success' : 'badge-danger'}`} style={{ padding: '8px 16px', borderRadius: '12px', fontSize: '11px', fontWeight: 800 }}>
                             {sub.status === 'ACTIVE' ? 'ACTIVA' : 'EXPIRADA'}
                          </span>
                       </td>
                       <td style={{ textAlign: 'right' }}>
                          <button className="white-card" style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}><MoreHorizontal size={16} /></button>
                       </td>
                    </tr>
                  ))}
                  {subscriptions.length === 0 && (
                    <tr>
                       <td colSpan={6} style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)', fontWeight: 600 }}> No se encontraron suscripciones registradas. </td>
                    </tr>
                  )}
               </tbody>
            </table>
         </div>
      </div>
    </div>
  );
}
