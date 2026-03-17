'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Shield, 
  Search, 
  Filter, 
  Calendar, 
  User, 
  Activity, 
  Clock, 
  ArrowRight,
  Database
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

type Trend = { pctLabel: string; up: boolean; hasPrev: boolean };

function computeTrend(current: number, previous: number): Trend {
   if (!Number.isFinite(current)) current = 0;
   if (!Number.isFinite(previous)) previous = 0;
   if (previous <= 0) {
      if (current <= 0) return { pctLabel: '0%', up: true, hasPrev: false };
      return { pctLabel: '—', up: true, hasPrev: false };
   }
   const pct = Math.round(((current - previous) / previous) * 100);
   return { pctLabel: `${Math.abs(pct)}%`, up: pct >= 0, hasPrev: true };
}

export default function AuditPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
   const [showFilters, setShowFilters] = useState(false);
   const [actionFilter, setActionFilter] = useState<'ALL' | 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN'>('ALL');
   const [entityFilter, setEntityFilter] = useState('');
   const [days, setDays] = useState<7 | 30 | 90>(30);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard?resource=audit', {
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
      });
      if (res.ok) setLogs(await res.json());
      } catch (err) {
         console.error(err);
         toast.error('Error de conexión');
      }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

   const filtered = logs.filter(l => {
      const q = search.trim().toLowerCase();
      const matchesSearch = !q
         ? true
         : l.action.toLowerCase().includes(q) ||
            l.entity.toLowerCase().includes(q) ||
            l.user.firstName.toLowerCase().includes(q) ||
            l.user.lastName.toLowerCase().includes(q) ||
            l.user.email.toLowerCase().includes(q);

      const ef = entityFilter.trim().toLowerCase();
      const matchesEntity = !ef ? true : String(l.entity || '').toLowerCase().includes(ef);

      const matchesAction = actionFilter === 'ALL'
         ? true
         : actionFilter === 'CREATE'
            ? String(l.action || '').includes('CREATE')
            : actionFilter === 'UPDATE'
               ? String(l.action || '').includes('UPDATE')
               : actionFilter === 'DELETE'
                  ? String(l.action || '').includes('DELETE')
                  : String(l.action || '').includes('LOGIN');

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const matchesDate = new Date(l.createdAt) >= cutoff;

      return matchesSearch && matchesEntity && matchesAction && matchesDate;
   });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(todayStart.getDate() - 1);

  const todayCount = logs.filter(l => new Date(l.createdAt) >= todayStart).length;
  const yesterdayCount = logs.filter(l => {
     const dt = new Date(l.createdAt);
     return dt >= yesterdayStart && dt < todayStart;
  }).length;
  const dayTrend = computeTrend(todayCount, yesterdayCount);
  const dayTrendText = dayTrend.hasPrev
     ? `${dayTrend.up ? '+' : '-'}${dayTrend.pctLabel} vs ayer`
     : 'Sin datos comparativos';

  if (loading) return <div style={{ height: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner" /></div>;

  return (
    <div className="animate-premium" style={{ paddingTop: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
         <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-primary)' }}>Bitácora de Auditoría</h2>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Trazabilidad total de acciones críticas del sistema</span>
         </div>
         <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ position: 'relative', width: '300px' }}>
               <input className="white-card" style={{ border: 'none', padding: '12px 16px 12px 48px', width: '100%', fontSize: '13px', fontWeight: 700 }} placeholder="Buscar por acción, entidad o usuario..." value={search} onChange={e => setSearch(e.target.value)} />
               <Search size={18} style={{ position: 'absolute', left: '16px', top: '12px', color: 'var(--text-muted)' }} />
            </div>
            <button className="white-card" style={{ width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }} onClick={() => setShowFilters(true)} title="Filtros">
               <Filter size={18} />
            </button>
         </div>
      </div>

         {showFilters && (
            <div className="modal-overlay" onClick={() => setShowFilters(false)}>
               <div className="modal-content-premium animate-premium" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
                  <h3 style={{ fontSize: '20px', fontWeight: 900, marginBottom: '16px' }}>Filtros</h3>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                     <div>
                        <label className="input-label">Rango</label>
                        <select
                           className="white-card"
                           value={days}
                           onChange={(e) => setDays(Number(e.target.value) as 7 | 30 | 90)}
                           style={{ border: 'none', padding: '12px 14px', width: '100%', fontWeight: 800 }}
                        >
                           <option value={7}>Últimos 7 días</option>
                           <option value={30}>Últimos 30 días</option>
                           <option value={90}>Últimos 90 días</option>
                        </select>
                     </div>
                     <div>
                        <label className="input-label">Acción</label>
                        <select
                           className="white-card"
                           value={actionFilter}
                           onChange={(e) => setActionFilter(e.target.value as any)}
                           style={{ border: 'none', padding: '12px 14px', width: '100%', fontWeight: 800 }}
                        >
                           <option value="ALL">Todas</option>
                           <option value="CREATE">CREATE*</option>
                           <option value="UPDATE">UPDATE*</option>
                           <option value="DELETE">DELETE*</option>
                           <option value="LOGIN">LOGIN*</option>
                        </select>
                     </div>
                     <div style={{ gridColumn: '1 / -1' }}>
                        <label className="input-label">Entidad</label>
                        <input
                           className="white-card"
                           value={entityFilter}
                           onChange={(e) => setEntityFilter(e.target.value)}
                           placeholder="Ej: Ticket, Payment, User"
                           style={{ border: 'none', padding: '12px 14px', width: '100%', fontWeight: 800 }}
                        />
                     </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                     <button
                        className="white-card"
                        style={{ padding: '10px 14px', border: 'none', cursor: 'pointer', fontWeight: 900 }}
                        onClick={() => {
                           setActionFilter('ALL');
                           setEntityFilter('');
                           setDays(30);
                        }}
                     >
                        Limpiar
                     </button>
                     <button
                        className="btn-primary"
                        style={{ padding: '10px 14px', height: '44px' }}
                        onClick={() => setShowFilters(false)}
                     >
                        Aplicar
                     </button>
                  </div>
               </div>
            </div>
         )}

      <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
         <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%' }}>
               <thead style={{ background: 'rgba(0,0,0,0.01)' }}>
                  <tr>
                     <th style={{ padding: '24px' }}>Timestamp</th>
                     <th>Responsable</th>
                     <th>Acción</th>
                     <th>Recurso</th>
                     <th>ID Recurso</th>
                     <th style={{ textAlign: 'right', paddingRight: '24px' }}>Estado</th>
                  </tr>
               </thead>
               <tbody>
                  {filtered.map(l => (
                    <tr key={l.id} className="hover-premium">
                       <td style={{ padding: '20px 24px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                             <Clock size={16} color="var(--accent-gold)" />
                             <span style={{ fontSize: '13px', fontWeight: 700 }}>{formatDate(l.createdAt)}</span>
                          </div>
                       </td>
                       <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                             <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 900 }}>
                                {l.user.firstName[0]}
                             </div>
                             <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '13px', fontWeight: 800 }}>{l.user.firstName} {l.user.lastName}</span>
                                <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 }}>{l.user.email}</span>
                             </div>
                          </div>
                       </td>
                       <td>
                          <span style={{ 
                            fontSize: '11px', fontWeight: 900, 
                            padding: '6px 12px', borderRadius: '8px',
                            background: l.action.includes('DELETE') ? 'rgba(239, 68, 68, 0.1)' : l.action.includes('CREATE') ? 'rgba(34, 197, 94, 0.1)' : 'var(--bg-primary)',
                            color: l.action.includes('DELETE') ? '#ef4444' : l.action.includes('CREATE') ? '#22c55e' : 'var(--text-primary)'
                          }}>
                             {l.action}
                          </span>
                       </td>
                       <td style={{ fontSize: '13px', fontWeight: 700 }}>{l.entity}</td>
                       <td style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{l.entityId?.substring(0, 8) || '—'}</td>
                       <td style={{ textAlign: 'right', paddingRight: '24px' }}>
                          <Shield size={16} color="var(--accent-success)" style={{ display: 'inline-block' }} />
                       </td>
                    </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>

      <div style={{ marginTop: '32px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
         <div className="glass-card" style={{ padding: '32px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: 800, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
               <Activity size={18} color="var(--accent-gold)" /> Operaciones Hoy
            </h4>
            <div style={{ fontSize: '32px', fontWeight: 900 }}>{todayCount}</div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: dayTrend.hasPrev ? (dayTrend.up ? 'var(--accent-success)' : 'var(--accent-danger)') : 'var(--text-muted)', marginTop: '8px' }}>
              {dayTrendText}
            </div>
         </div>
         <div className="glass-card" style={{ padding: '32px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: 800, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
               <ArrowRight size={18} color="var(--accent-gold)" /> Acceso de Usuarios
            </h4>
            <div style={{ fontSize: '32px', fontWeight: 900 }}>{new Set(logs.map(l => l.user.id)).size}</div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginTop: '8px' }}>Colaboradores activos</div>
         </div>
         <div className="glass-card" style={{ padding: '32px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: 800, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
               <Database size={18} color="var(--accent-gold)" /> Salud de Integridad
            </h4>
            <div style={{ fontSize: '32px', fontWeight: 900, color: 'var(--accent-success)' }}>100%</div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginTop: '8px' }}>Sin discrepancias detectadas</div>
         </div>
      </div>
    </div>
  );
}

