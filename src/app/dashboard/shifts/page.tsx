'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { formatCurrency, formatDate } from '@/lib/utils';
import { PlayCircle, CheckCircle2, Lock, AlertTriangle, Clock, History, User, Banknote, Car, Activity } from 'lucide-react';

interface Shift {
  id: string; status: string; startTime: string; endTime?: string;
  initialCash: number; totalCash: number; totalCard: number; totalDigital: number;
  expectedTotal: number; actualTotal?: number; difference?: number;
  vehiclesServed: number; notes?: string;
  operator: { firstName: string; lastName: string };
  _count: { payments: number };
}

function getAuthHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem('accessToken')}`, 'Content-Type': 'application/json' };
}

export default function ShiftsPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [openingShift, setOpeningShift] = useState(false);
  const [closingShift, setClosingShift] = useState<string | null>(null);
  const [actualTotal, setActualTotal] = useState('');
  const [initialCash, setInitialCash] = useState('');
  const router = useRouter();

  const fetchShifts = async () => {
    try {
      const res = await fetch('/api/dashboard?resource=shifts', { headers: getAuthHeaders() });
      if (res.status === 401) {
        localStorage.removeItem('accessToken');
        router.push('/');
        return;
      }
      if (res.ok) setShifts(await res.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchShifts(); }, [router]);

  const handleOpenShift = async () => {
    try {
      const res = await fetch('/api/dashboard', {
        method: 'POST', headers: getAuthHeaders(),
        body: JSON.stringify({ resource: 'open-shift', initialCash: Number(initialCash) || 0 }),
      });
      const data = await res.json();
      if (!res.ok) alert(data.error);
      else { setOpeningShift(false); setInitialCash(''); fetchShifts(); }
    } catch { alert('Error al abrir turno'); }
  };

  const handleCloseShift = async () => {
    if (!closingShift || !actualTotal) return;
    try {
      const res = await fetch('/api/dashboard', {
        method: 'POST', headers: getAuthHeaders(),
        body: JSON.stringify({ resource: 'close-shift', shiftId: closingShift, actualTotal: Number(actualTotal), notes: '' }),
      });
      if (res.ok) {
        setClosingShift(null);
        setActualTotal('');
        fetchShifts();
      } else {
        const d = await res.json();
        alert(d.error);
      }
    } catch {
      alert('Error al cerrar turno');
    }
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}><div className="spinner" /></div>;

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        <button className="btn-primary" onClick={() => setOpeningShift(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><PlayCircle size={18} /> Abrir Turno</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {shifts.map((s: Shift) => (
          <div key={s.id} className="glass-card animate-premium" style={{ 
            padding: '28px', borderLeft: `6px solid ${s.status === 'OPEN' ? 'var(--accent-success)' : 'var(--border-color)'}`,
            position: 'relative', overflow: 'hidden'
          }}>
            {s.status === 'OPEN' && <div className="shimmer" style={{ position: 'absolute', inset: 0, opacity: 0.1, pointerEvents: 'none' }} />}
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div style={{ 
                  width: '50px', height: '50px', borderRadius: '14px', 
                  background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--accent-primary)', border: '1px solid var(--border-color)'
                }}>
                  <User size={24} />
                </div>
                <div>
                  <h4 style={{ fontSize: '16px', fontWeight: 900, color: 'var(--text-primary)' }}>{s.operator.firstName} {s.operator.lastName}</h4>
                  <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={12} /> {formatDate(s.startTime)}
                  </p>
                </div>
              </div>
              <span className={`badge ${s.status === 'OPEN' ? 'badge-success' : 'badge-info'}`} style={{ padding: '6px 14px', borderRadius: '10px', fontSize: '11px', fontWeight: 800 }}>
                {s.status === 'OPEN' ? 'ACTIVO' : 'FINALIZADO'}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
              <div style={{ padding: '16px', borderRadius: '14px', background: 'white', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Recaudación</div>
                <div style={{ fontSize: '18px', fontWeight: 900, color: 'var(--accent-success)' }}>{formatCurrency(s.totalCash + s.totalCard + s.totalDigital)}</div>
              </div>
              <div style={{ padding: '16px', borderRadius: '14px', background: 'white', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Operaciones</div>
                <div style={{ fontSize: '18px', fontWeight: 900, color: 'var(--accent-primary)' }}>{s.vehiclesServed} vehículos</div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                 <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} title="Efectivo" />
                 <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6' }} title="Tarjeta" />
                 <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#a855f7' }} title="Digital" />
              </div>
              {s.status === 'OPEN' ? (
                <button className="btn-primary" onClick={() => setClosingShift(s.id)} style={{ padding: '8px 20px', fontSize: '12px' }}>
                  <Lock size={14} /> Cerrar Turno
                </button>
              ) : s.difference !== null && (
                <div style={{ 
                  fontSize: '12px', fontWeight: 800, 
                  color: s.difference === 0 ? 'var(--accent-success)' : 'var(--accent-danger)',
                  display: 'flex', alignItems: 'center', gap: '4px'
                }}>
                  {s.difference === 0 ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                  DIF: {formatCurrency(s.difference ?? 0)}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Opening Modal */}
      {openingShift && (
        <div className="modal-overlay" onClick={() => setOpeningShift(false)}>
           <div className="modal-content-premium animate-premium" onClick={e => e.stopPropagation()}>
              <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '22px', background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', margin: '0 auto 20px', boxShadow: '0 10px 20px rgba(2, 132, 199, 0.2)' }}>
                  <PlayCircle size={32} />
                </div>
                <h3 style={{ fontSize: '22px', fontWeight: 900, color: 'var(--text-primary)' }}>Iniciar Jornada</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px' }}>Ingresa la base de efectivo para apertura</p>
              </div>
              
              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label className="input-label">Fondo de Caja (COP)</label>
                <div style={{ position: 'relative' }}>
                  <Banknote size={20} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input className="input-field" type="number" placeholder="50000" value={initialCash} onChange={e => setInitialCash(e.target.value)} style={{ paddingLeft: '48px', height: '54px', fontSize: '18px', fontWeight: 700 }} />
                </div>
              </div>

              <button className="btn-primary" style={{ width: '100%', height: '56px', fontSize: '16px' }} onClick={handleOpenShift}>
                Confirmar Apertura
              </button>
           </div>
        </div>
      )}

      {/* Closing Modal */}
      {closingShift && (
        <div className="modal-overlay" onClick={() => setClosingShift(null)}>
           <div className="modal-content-premium animate-premium" onClick={e => e.stopPropagation()}>
              <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '22px', background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', margin: '0 auto 20px', boxShadow: '0 10px 20px rgba(2, 132, 199, 0.2)' }}>
                  <Lock size={32} />
                </div>
                <h3 style={{ fontSize: '22px', fontWeight: 900, color: 'var(--text-primary)' }}>Arqueo de Caja</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px' }}>Registra el efectivo final para el cierre</p>
              </div>

              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label className="input-label">Efectivo Físico en Caja (COP)</label>
                <div style={{ position: 'relative' }}>
                  <Banknote size={20} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input className="input-field" type="number" placeholder="0" value={actualTotal} onChange={e => setActualTotal(e.target.value)} style={{ paddingLeft: '48px', height: '54px', fontSize: '18px', fontWeight: 700 }} />
                </div>
              </div>

              <button className="btn-primary" style={{ width: '100%', height: '56px', fontSize: '16px' }} onClick={handleCloseShift}>
                Finalizar Turno y Cuadrar
              </button>
           </div>
        </div>
      )}
    </div>
  );
}
