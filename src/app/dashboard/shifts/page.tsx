'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  PlayCircle, 
  StopCircle, 
  History, 
  Banknote, 
  CreditCard, 
  Activity, 
  AlertCircle,
  MoreHorizontal,
  ChevronRight,
  Printer,
  FileText
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function ShiftsPage() {
  const [activeShift, setActiveShift] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialCash, setInitialCash] = useState('');
  const [showOpenModal, setShowOpenModal] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem('accessToken')}` };
      const [currRes, histRes] = await Promise.all([
        fetch('/api/dashboard?resource=current-shift', { headers }),
        fetch('/api/dashboard?resource=shifts-history', { headers })
      ]);
      
      if (currRes.ok) setActiveShift(await currRes.json());
      if (histRes.ok) setHistory(await histRes.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleOpenShift = async () => {
    if (!initialCash) return;
    try {
      const res = await fetch('/api/dashboard', {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ resource: 'open-shift', initialCash: parseFloat(initialCash) })
      });
      if (res.ok) {
        setShowOpenModal(false);
        fetchData();
      }
    } catch (err) { console.error(err); }
  };

  const handleCloseShift = async () => {
    if (!confirm('¿Estás seguro de cerrar el turno actual?')) return;
    try {
      const res = await fetch('/api/dashboard', {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ resource: 'close-shift' })
      });
      if (res.ok) fetchData();
    } catch (err) { console.error(err); }
  };

  if (loading) return <div style={{ height: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner" /></div>;

  return (
    <div className="animate-premium">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
           <h2 style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>Control de Turnos</h2>
           <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Apertura, cierre y arqueo de caja operativa</span>
        </div>
        {!activeShift ? (
          <button className="btn-primary" style={{ padding: '0 32px', height: '56px' }} onClick={() => setShowOpenModal(true)}>
             <PlayCircle size={20} /> Iniciar Jornada
          </button>
        ) : (
          <button className="btn-primary" style={{ padding: '0 32px', height: '56px', background: 'var(--accent-danger)' }} onClick={handleCloseShift}>
             <StopCircle size={20} /> Finalizar Jornada
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '32px' }}>
         {/* Current State */}
         <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            <div className="glass-card" style={{ padding: '40px' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '40px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 900 }}>Turno en Curso</h3>
                  {activeShift && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-success)', fontSize: '12px', fontWeight: 800 }}>
                       <Activity size={14} className="animate-pulse" /> EN LÍNEA
                    </div>
                  )}
               </div>

               {activeShift ? (
                 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px' }}>
                    <div className="white-card" style={{ padding: '24px' }}>
                       <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '8px' }}>BASE DE CAJA</div>
                       <div style={{ fontSize: '22px', fontWeight: 900 }}>{formatCurrency(activeShift.initialCash)}</div>
                    </div>
                    <div className="white-card" style={{ padding: '24px' }}>
                       <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '8px' }}>RECAUDO EFECTIVO</div>
                       <div style={{ fontSize: '22px', fontWeight: 900, color: 'var(--accent-success)' }}>{formatCurrency(activeShift.totalCash)}</div>
                    </div>
                    <div className="white-card" style={{ padding: '24px' }}>
                       <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '8px' }}>TOTAL ESPERADO</div>
                       <div style={{ fontSize: '22px', fontWeight: 900 }}>{formatCurrency(activeShift.expectedTotal)}</div>
                    </div>
                 </div>
               ) : (
                 <div style={{ textAlign: 'center', padding: '60px 0' }}>
                    <div style={{ opacity: 0.1, marginBottom: '24px' }}><StopCircle size={80} /></div>
                    <h4 style={{ fontWeight: 800, color: 'var(--text-muted)' }}>No hay un turno activo actualmente.</h4>
                    <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '8px' }}>Inicia una jornada para comenzar a registrar operaciones.</p>
                 </div>
               )}
            </div>

            <div className="glass-card" style={{ padding: '40px' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '32px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 900 }}>Historial de Turnos</h3>
                  <button style={{ background: 'none', border: 'none', color: 'var(--accent-gold)', fontWeight: 800, cursor: 'pointer', fontSize: '13px' }}>Ver Todo</button>
               </div>
               <div style={{ overflowX: 'auto' }}>
                  <table className="data-table" style={{ width: '100%' }}>
                     <thead>
                        <tr>
                           <th>Operador</th>
                           <th>Apertura</th>
                           <th>Cierre</th>
                           <th>Recaudado</th>
                           <th>Vehículos</th>
                           <th style={{ textAlign: 'right' }}>Acciones</th>
                        </tr>
                     </thead>
                     <tbody>
                        {history.map(shift => (
                          <tr key={shift.id}>
                             <td style={{ paddingTop: '20px', paddingBottom: '20px' }}>
                                <div style={{ fontWeight: 800 }}>{shift.operator.firstName} {shift.operator.lastName}</div>
                             </td>
                             <td style={{ fontSize: '13px', fontWeight: 700 }}>{formatDate(shift.startTime)}</td>
                             <td style={{ fontSize: '13px', fontWeight: 700 }}>{shift.endTime ? formatDate(shift.endTime) : 'Activo'}</td>
                             <td style={{ fontWeight: 900 }}>{formatCurrency(shift.actualTotal || shift.expectedTotal)}</td>
                             <td style={{ fontWeight: 800 }}>{shift.vehiclesServed}</td>
                             <td style={{ textAlign: 'right' }}>
                                <button className="white-card" style={{ padding: '8px 16px', border: 'none', cursor: 'pointer' }}><FileText size={16} /></button>
                             </td>
                          </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            </div>
         </div>

         {/* Sidebar Stats */}
         <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            <div className="glass-card" style={{ padding: '32px' }}>
               <h3 style={{ fontSize: '16px', fontWeight: 900, marginBottom: '24px' }}>Resumen de Métodos</h3>
               <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {[
                    { label: 'Efectivo', value: activeShift?.totalCash || 0, icon: <Banknote size={16} />, color: 'var(--accent-success)' },
                    { label: 'Tarjeta', value: activeShift?.totalCard || 0, icon: <CreditCard size={16} />, color: 'var(--accent-info)' },
                    { label: 'Billetera Digital', value: activeShift?.totalDigital || 0, icon: <Activity size={16} />, color: 'var(--accent-warning)' }
                  ].map(m => (
                    <div key={m.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderRadius: '16px', background: 'white' }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ color: m.color }}>{m.icon}</div>
                          <span style={{ fontSize: '13px', fontWeight: 700 }}>{m.label}</span>
                       </div>
                       <span style={{ fontSize: '14px', fontWeight: 900 }}>{formatCurrency(m.value)}</span>
                    </div>
                  ))}
               </div>
            </div>

            <div className="glass-card" style={{ padding: '32px', background: 'var(--text-primary)', color: 'white' }}>
               <h3 style={{ fontSize: '16px', fontWeight: 900, marginBottom: '24px' }}>Nota de Seguridad</h3>
               <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                  <AlertCircle size={24} color="var(--accent-gold)" />
                  <p style={{ fontSize: '13px', lineHeight: 1.6, opacity: 0.8 }}>
                    Recuerda realizar el arqueo cada vez que finalices tu jornada. La diferencia entre lo esperado y lo real será auditada.
                  </p>
               </div>
            </div>
         </div>
      </div>

      {/* Open Shift Modal */}
      {showOpenModal && (
        <div className="modal-overlay" onClick={() => setShowOpenModal(false)}>
           <div className="modal-content-premium animate-premium" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
              <h3 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '24px' }}>Abrir Caja</h3>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '32px' }}>Ingresa el monto base con el que inicias esta jornada operativa.</p>
              
              <div className="form-group" style={{ marginBottom: '32px' }}>
                 <label className="input-label">Monto de Apertura (Base)</label>
                 <div style={{ position: 'relative' }}>
                    <input 
                      type="number" 
                      className="input-field" 
                      placeholder="0.00" 
                      value={initialCash} 
                      onChange={e => setInitialCash(e.target.value)}
                      style={{ height: '64px', fontSize: '24px', fontWeight: 900, paddingLeft: '44px' }} 
                    />
                    <Banknote size={24} style={{ position: 'absolute', left: '16px', top: '20px', color: 'var(--accent-gold)' }} />
                 </div>
              </div>

              <button className="btn-primary" style={{ width: '100%', height: '64px', fontSize: '16px' }} onClick={handleOpenShift}>
                 Iniciar Jornada Operativa
              </button>
           </div>
        </div>
      )}
    </div>
  );
}
