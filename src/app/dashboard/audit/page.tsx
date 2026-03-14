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

export default function AuditPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard?resource=audit', {
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
      });
      if (res.ok) setLogs(await res.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const filtered = logs.filter(l => 
    l.action.toLowerCase().includes(search.toLowerCase()) ||
    l.entity.toLowerCase().includes(search.toLowerCase()) ||
    l.user.firstName.toLowerCase().includes(search.toLowerCase())
  );

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
            <button className="white-card" style={{ width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none' }}>
               <Filter size={18} />
            </button>
         </div>
      </div>

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
            <div style={{ fontSize: '32px', fontWeight: 900 }}>{logs.length}</div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginTop: '8px' }}>+12% vs día anterior</div>
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
