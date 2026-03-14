'use client';

import { useState, useEffect } from 'react';
import { formatDate } from '@/lib/utils';
import { Shield, Search, History, User, Activity, Loader2, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface AuditLog {
  id: string;
  action: string;
  entity: string;
  entityId?: string;
  details?: string;
  createdAt: string;
  user: { firstName: string; lastName: string; email: string };
}

function getAuthHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem('accessToken')}`, 'Content-Type': 'application/json' };
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchLogs();
  }, [router]);

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/dashboard?resource=audit', { headers: getAuthHeaders() });
      if (res.status === 401) {
        localStorage.removeItem('accessToken');
        router.push('/');
        return;
      }
      if (res.ok) setLogs(await res.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const filtered = logs.filter(l => 
    l.action.toLowerCase().includes(search.toLowerCase()) ||
    l.entity.toLowerCase().includes(search.toLowerCase()) ||
    `${l.user.firstName} ${l.user.lastName}`.toLowerCase().includes(search.toLowerCase())
  );

  const getActionColor = (action: string) => {
    if (action.startsWith('CREATE')) return 'var(--accent-success)';
    if (action.startsWith('DELETE')) return '#ef4444';
    if (action.startsWith('UPDATE')) return 'var(--accent-primary)';
    return 'var(--text-secondary)';
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}><Loader2 className="animate-spin" size={40} color="var(--accent-primary)" /></div>;

  return (
    <div className="animate-premium">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginBottom: '32px', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <div style={{ 
            width: '56px', height: '56px', borderRadius: '18px', background: 'var(--bg-card)', 
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)',
            boxShadow: 'var(--shadow-premium)'
          }}>
            <Shield size={28} />
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>Bitácora de Auditoría</h2>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: 600 }}>Registro inmutable de seguridad</p>
          </div>
        </div>
        <div style={{ position: 'relative' }}>
           <Search size={18} style={{ position: 'absolute', left: '16px', top: '15px', color: 'var(--text-muted)' }} />
           <input className="input-field" placeholder="Filtrar por acción o usuario..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: '48px' }} />
        </div>
      </div>

      <div className="glass-card animate-premium" style={{ padding: '0', overflow: 'hidden' }}>
        <table className="data-table">
          <thead style={{ background: 'var(--bg-primary)' }}>
            <tr>
              <th style={{ padding: '20px' }}>Evento</th>
              <th>Entidad</th>
              <th>Responsable</th>
              <th>Fecha y Hora</th>
              <th style={{ textAlign: 'right', paddingRight: '20px' }}>Detalles</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(l => (
              <tr key={l.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '16px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: getActionColor(l.action) }} />
                    <span style={{ fontWeight: 800, fontSize: '13px', color: 'var(--text-primary)' }}>{l.action}</span>
                  </div>
                </td>
                <td>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                     <Activity size={14} />
                     <span style={{ fontSize: '14px', fontWeight: 600 }}>{l.entity}</span>
                     <span style={{ fontSize: '11px', opacity: 0.6 }}>ID: {l.entityId?.substring(0,8) || 'N/A'}</span>
                   </div>
                </td>
                <td>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800 }}>
                        {l.user.firstName[0]}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '14px', fontWeight: 700 }}>{l.user.firstName} {l.user.lastName}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{l.user.email}</span>
                      </div>
                   </div>
                </td>
                <td style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>
                  {formatDate(l.createdAt)}
                </td>
                 <td style={{ textAlign: 'right', paddingRight: '20px' }}>
                    {l.details ? (
                      <button className="btn-secondary" style={{ padding: '8px 16px', fontSize: '11px', borderRadius: '10px', display: 'inline-flex', alignItems: 'center', gap: '6px' }} onClick={() => setSelectedLog(l)}>
                         <History size={14} /> Inspeccionar
                      </button>
                    ) : <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>—</span>}
                 </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
             <History size={48} style={{ marginBottom: '16px', opacity: 0.2 }} />
             <p>No se encontraron registros de auditoría.</p>
          </div>
        )}
      </div>

      {selectedLog && (
        <div className="modal-overlay" onClick={() => setSelectedLog(null)}>
          <div className="modal-content-premium animate-premium" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
             <h3 style={{ fontSize: '20px', fontWeight: 900, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
               <Shield size={24} color="var(--accent-primary)" /> Detalles de la Operación
             </h3>
             <div style={{ background: 'var(--bg-primary)', padding: '24px', borderRadius: '20px', border: '1px solid var(--border-color)', marginBottom: '24px' }}>
                <pre style={{ margin: 0, fontSize: '13px', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontWeight: 600 }}>
                  {JSON.stringify(JSON.parse(selectedLog.details || '{}'), null, 2)}
                </pre>
             </div>
             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', fontSize: '14px' }}>
                <div>
                   <span style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '4px' }}>OPERADOR</span>
                   <span style={{ fontWeight: 700 }}>{selectedLog.user.firstName} {selectedLog.user.lastName}</span>
                </div>
                <div>
                   <span style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '4px' }}>FECHA</span>
                   <span style={{ fontWeight: 700 }}>{formatDate(selectedLog.createdAt)}</span>
                </div>
             </div>
             <button className="btn-primary" style={{ width: '100%', marginTop: '32px' }} onClick={() => setSelectedLog(null)}>
               Cerrar Inspector
             </button>
          </div>
        </div>
      )}
    </div>
  );
}
