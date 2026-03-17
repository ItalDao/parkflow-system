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
   Printer,
  FileText
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

type PaymentMethod = 'CASH' | 'CARD' | 'DIGITAL_WALLET' | 'PREPAID' | 'MONTHLY';

type ShiftSummary = {
   id: string;
   status: 'OPEN' | 'CLOSED';
   startTime: string;
   endTime?: string | null;
   initialCash: number;
   totalCash: number;
   totalCard: number;
   totalDigital: number;
   expectedTotal: number;
   actualTotal?: number | null;
   difference?: number | null;
   vehiclesServed: number;
   notes?: string | null;
   operatorId: string;
   operator: { firstName: string; lastName: string; email?: string };
};

type ShiftDetails = {
   shift: ShiftSummary & {
      parkingLotId: string;
      parkingLot?: { id: string; name: string; city?: string | null; address?: string | null };
      paymentsCount: number;
   };
   breakdown: Record<string, { count: number; total: number }>;
   payments: Array<{
      id: string;
      createdAt: string;
      amount: number;
      method: PaymentMethod;
      status: string;
      invoiceNumber?: string | null;
      cashReceived?: number | null;
      changeGiven?: number | null;
      ticket: { id: string; ticketCode: string; vehicle: { plate: string; type: string } };
      operator?: { firstName: string; lastName: string } | null;
   }>;
};

function getAuthHeaders() {
   return { Authorization: `Bearer ${localStorage.getItem('accessToken')}`, 'Content-Type': 'application/json' };
}

function buildShiftPrintableHtml(details: ShiftDetails) {
   const safe = (s: unknown) => String(s ?? '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
   const { shift, breakdown } = details;
   const lotName = shift.parkingLot?.name || 'Sede';

   const methods: Array<{ key: PaymentMethod; label: string }> = [
      { key: 'CASH', label: 'Efectivo' },
      { key: 'CARD', label: 'Tarjeta' },
      { key: 'DIGITAL_WALLET', label: 'Billetera Digital' },
      { key: 'PREPAID', label: 'Prepago' },
      { key: 'MONTHLY', label: 'Mensualidad' },
   ];

   const breakdownRows = methods
      .map((m) => {
         const b = breakdown[m.key] || { count: 0, total: 0 };
         return `<tr><td>${safe(m.label)}</td><td style="text-align:right;">${safe(b.count)}</td><td style="text-align:right; font-weight:900;">${safe(formatCurrency(b.total || 0))}</td></tr>`;
      })
      .join('');

   return `<!doctype html>
   <html lang="es">
      <head>
         <meta charset="utf-8" />
         <meta name="viewport" content="width=device-width, initial-scale=1" />
         <title>Reporte de Turno</title>
         <style>
            body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 0; padding: 24px; }
            .card { border: 2px solid #111827; border-radius: 16px; padding: 18px; max-width: 760px; margin: 0 auto; }
            .muted { color: #6b7280; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; }
            .title { font-size: 22px; font-weight: 900; margin: 0; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
            .hr { height: 1px; background: #e5e7eb; margin: 14px 0; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 10px 8px; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
            th { text-align: left; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: .05em; }
            @media print { body { padding: 0; } .card { border: none; } }
         </style>
      </head>
      <body>
         <div class="card">
            <div style="display:flex; justify-content:space-between; gap:16px; align-items:baseline;">
               <div>
                  <div class="muted">${safe(lotName)}</div>
                  <h1 class="title">Reporte de Turno</h1>
               </div>
               <div style="text-align:right;">
                  <div class="muted">Turno</div>
                  <div style="font-weight:900; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;">${safe(shift.id)}</div>
               </div>
            </div>

            <div class="hr"></div>

            <div class="grid">
               <div>
                  <div class="muted">Operador</div>
                  <div style="font-weight:900;">${safe(`${shift.operator.firstName} ${shift.operator.lastName}`)}</div>
                  <div style="font-weight:700; color:#6b7280; font-size:12px;">${safe(shift.operator.email || '')}</div>
               </div>
               <div style="text-align:right;">
                  <div class="muted">Periodo</div>
                  <div style="font-weight:900;">${safe(formatDate(shift.startTime))}</div>
                  <div style="font-weight:900;">${safe(shift.endTime ? formatDate(shift.endTime) : 'Activo')}</div>
               </div>
            </div>

            <div class="hr"></div>

            <div class="grid">
               <div>
                  <div class="muted">Total Esperado</div>
                  <div style="font-weight:900; font-size:18px;">${safe(formatCurrency(shift.expectedTotal || 0))}</div>
               </div>
               <div style="text-align:right;">
                  <div class="muted">Total Real</div>
                  <div style="font-weight:900; font-size:18px;">${safe(formatCurrency(shift.actualTotal || 0))}</div>
               </div>
            </div>

            <div class="grid" style="margin-top: 10px;">
               <div>
                  <div class="muted">Base de Caja</div>
                  <div style="font-weight:900;">${safe(formatCurrency(shift.initialCash || 0))}</div>
               </div>
               <div style="text-align:right;">
                  <div class="muted">Diferencia</div>
                  <div style="font-weight:900;">${safe(formatCurrency(shift.difference || 0))}</div>
               </div>
            </div>

            <div class="hr"></div>

            <div class="muted" style="margin-bottom:8px;">Desglose por Método</div>
            <table>
               <thead><tr><th>Método</th><th style="text-align:right;">Transacciones</th><th style="text-align:right;">Total</th></tr></thead>
               <tbody>${breakdownRows}</tbody>
            </table>
         </div>
         <script>window.focus(); window.print();</script>
      </body>
   </html>`;
}

export default function ShiftsPage() {
   const [activeShift, setActiveShift] = useState<ShiftSummary | null>(null);
   const [history, setHistory] = useState<ShiftSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialCash, setInitialCash] = useState('');
  const [showOpenModal, setShowOpenModal] = useState(false);
   const [showCloseModal, setShowCloseModal] = useState(false);
   const [actualTotal, setActualTotal] = useState('');
   const [closeNotes, setCloseNotes] = useState('');
   const [closing, setClosing] = useState(false);

    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [historyExpanded, setHistoryExpanded] = useState(false);

    const [reportLoading, setReportLoading] = useState(false);
    const [report, setReport] = useState<ShiftDetails | null>(null);
    const [showReportModal, setShowReportModal] = useState(false);

  const fetchData = useCallback(async () => {
    try {
         const headers = { Authorization: `Bearer ${localStorage.getItem('accessToken')}` };
      const [currRes, histRes] = await Promise.all([
        fetch('/api/dashboard?resource=current-shift', { headers }),
            fetch(`/api/dashboard?resource=shifts-history&take=${historyExpanded ? 50 : 10}`, { headers })
      ]);
      
      if (currRes.ok) setActiveShift(await currRes.json());
      if (histRes.ok) setHistory(await histRes.json());
      } catch (err) {
         console.error(err);
         toast.error('Error de conexión');
      }
    finally { setLoading(false); }
   }, [historyExpanded]);

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
            setInitialCash('');
        fetchData();
         } else {
            const data = await res.json().catch(() => ({}));
            toast.error((data as { error?: string }).error || 'No se pudo abrir el turno');
      }
      } catch (err) {
         console.error(err);
         toast.error('Error de conexión');
      }
  };

    const fetchShiftReport = async (shiftId: string) => {
       setReportLoading(true);
       try {
          const res = await fetch(`/api/dashboard?resource=shift-details&shiftId=${encodeURIComponent(shiftId)}`, {
             headers: getAuthHeaders(),
          });
          if (!res.ok) {
             const data = await res.json().catch(() => ({}));
             toast.error((data as { error?: string }).error || 'No se pudo cargar el reporte');
             return;
          }
          const data = (await res.json()) as ShiftDetails;
          setReport(data);
          setShowReportModal(true);
       } catch (err) {
          console.error(err);
         toast.error('Error de conexión');
       } finally {
          setReportLoading(false);
       }
    };

   const handleCloseShift = () => {
      if (!activeShift) return;
      setActualTotal('');
      setCloseNotes('');
      setShowCloseModal(true);
   };

   const submitCloseShift = async () => {
      if (!activeShift) return;
      const parsed = Number(actualTotal);
      if (!Number.isFinite(parsed)) return;
      setClosing(true);
      try {
         const res = await fetch('/api/dashboard', {
            method: 'POST',
            headers: {
               Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
               'Content-Type': 'application/json',
            },
            body: JSON.stringify({ resource: 'close-shift', shiftId: activeShift.id, actualTotal: parsed, notes: closeNotes }),
         });
         if (res.ok) {
            const closed = (await res.json().catch(() => null)) as ShiftSummary | null;
            setShowCloseModal(false);
            await fetchData();
            if (closed?.id) {
              await fetchShiftReport(closed.id);
            }
         } else {
            const data = await res.json().catch(() => ({}));
            toast.error(data.error || 'No se pudo cerrar el turno');
         }
      } catch (err) {
         console.error(err);
         toast.error('Error de conexión');
      } finally {
         setClosing(false);
      }
   };

   const handlePrintReport = () => {
      if (!report) return;
      const html = buildShiftPrintableHtml(report);
      const win = window.open('', '_blank', 'noopener,noreferrer');
      if (!win) {
         toast.error('No se pudo abrir la ventana de impresión (bloqueada)');
         return;
      }
      win.document.open();
      win.document.write(html);
      win.document.close();
   };

   const methodLabel = (method: PaymentMethod) => {
      switch (method) {
         case 'CASH':
            return 'Efectivo';
         case 'CARD':
            return 'Tarjeta';
         case 'DIGITAL_WALLET':
            return 'Billetera';
         case 'PREPAID':
            return 'Prepago';
         case 'MONTHLY':
            return 'Mensualidad';
         default:
            return method;
      }
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
                           <button
                              style={{ background: 'none', border: 'none', color: 'var(--accent-gold)', fontWeight: 800, cursor: 'pointer', fontSize: '13px' }}
                              onClick={() => {
                                 setHistoryExpanded(true);
                                 setShowHistoryModal(true);
                              }}
                           >
                              Ver Todo
                           </button>
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
                                <button
                                  className="white-card"
                                  style={{ padding: '8px 16px', border: 'none', cursor: 'pointer', opacity: reportLoading ? 0.7 : 1 }}
                                  onClick={() => void fetchShiftReport(shift.id)}
                                  disabled={reportLoading}
                                  title="Ver reporte"
                                >
                                  <FileText size={16} />
                                </button>
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

         {/* Close Shift Modal */}
         {showCloseModal && activeShift && (
            <div className="modal-overlay" onClick={() => !closing && setShowCloseModal(false)}>
               <div className="modal-content-premium animate-premium" style={{ maxWidth: '520px' }} onClick={e => e.stopPropagation()}>
                  <h3 style={{ fontSize: '24px', fontWeight: 900, marginBottom: '8px' }}>Cierre de Turno (Arqueo)</h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '28px', fontWeight: 700 }}>
                     Registra el total real contado para comparar contra el esperado.
                  </p>

                  <div className="white-card" style={{ padding: '20px', marginBottom: '20px' }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Esperado</span>
                        <span style={{ fontSize: '14px', fontWeight: 900 }}>{formatCurrency(activeShift.expectedTotal)}</span>
                     </div>
                     <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '11px', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Efectivo</span>
                        <span style={{ fontSize: '14px', fontWeight: 900 }}>{formatCurrency(activeShift.totalCash)}</span>
                     </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: '20px' }}>
                     <label className="input-label">Total Real (conteo)</label>
                     <input
                        type="number"
                        className="input-field"
                        placeholder="0"
                        value={actualTotal}
                        onChange={(e) => setActualTotal(e.target.value)}
                        style={{ height: '64px', fontSize: '22px', fontWeight: 900 }}
                     />
                  </div>

                  <div className="form-group" style={{ marginBottom: '28px' }}>
                     <label className="input-label">Notas (opcional)</label>
                     <textarea
                        className="input-field"
                        value={closeNotes}
                        onChange={(e) => setCloseNotes(e.target.value)}
                        placeholder="Ej: faltante por billete roto, diferencia por datáfono..."
                        style={{ minHeight: '96px', paddingTop: '14px' }}
                     />
                  </div>

                  <button
                     className="btn-primary"
                     style={{ width: '100%', height: '64px', fontSize: '15px', background: 'var(--accent-danger)' }}
                     onClick={submitCloseShift}
                     disabled={closing || !actualTotal}
                  >
                     {closing ? 'Cerrando…' : 'Cerrar Turno y Generar Reporte'}
                  </button>
               </div>
            </div>
         )}

         {/* History Modal */}
         {showHistoryModal && (
            <div
               className="modal-overlay"
               onClick={() => {
                  setShowHistoryModal(false);
                  setHistoryExpanded(false);
               }}
            >
               <div
                  className="modal-content-premium animate-premium"
                  style={{ maxWidth: '980px' }}
                  onClick={(e) => e.stopPropagation()}
               >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px' }}>
                     <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <History size={18} />
                        <h3 style={{ fontSize: '20px', fontWeight: 900 }}>Historial Completo</h3>
                     </div>
                     <button
                        className="white-card"
                        style={{ padding: '10px 14px', border: 'none', cursor: 'pointer', fontWeight: 900 }}
                        onClick={() => {
                           setShowHistoryModal(false);
                           setHistoryExpanded(false);
                        }}
                     >
                        Cerrar
                     </button>
                  </div>

                  <div style={{ overflowX: 'auto' }}>
                     <table className="data-table" style={{ width: '100%' }}>
                        <thead>
                           <tr>
                              <th>Operador</th>
                              <th>Apertura</th>
                              <th>Cierre</th>
                              <th>Esperado</th>
                              <th>Real</th>
                              <th>Diferencia</th>
                              <th>Vehículos</th>
                              <th style={{ textAlign: 'right' }}>Acciones</th>
                           </tr>
                        </thead>
                        <tbody>
                           {history.map((shift) => (
                              <tr key={shift.id}>
                                 <td style={{ paddingTop: '18px', paddingBottom: '18px' }}>
                                    <div style={{ fontWeight: 900 }}>{shift.operator.firstName} {shift.operator.lastName}</div>
                                 </td>
                                 <td style={{ fontSize: '13px', fontWeight: 700 }}>{formatDate(shift.startTime)}</td>
                                 <td style={{ fontSize: '13px', fontWeight: 700 }}>{shift.endTime ? formatDate(shift.endTime) : 'Activo'}</td>
                                 <td style={{ fontWeight: 900 }}>{formatCurrency(shift.expectedTotal || 0)}</td>
                                 <td style={{ fontWeight: 900 }}>{formatCurrency(shift.actualTotal || 0)}</td>
                                 <td style={{ fontWeight: 900 }}>{formatCurrency(shift.difference || 0)}</td>
                                 <td style={{ fontWeight: 900 }}>{shift.vehiclesServed}</td>
                                 <td style={{ textAlign: 'right' }}>
                                    <button
                                       className="white-card"
                                       style={{ padding: '8px 16px', border: 'none', cursor: 'pointer' }}
                                       onClick={() => void fetchShiftReport(shift.id)}
                                       title="Ver reporte"
                                    >
                                       <FileText size={16} />
                                    </button>
                                 </td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>
               </div>
            </div>
         )}

         {/* Report Modal */}
         {showReportModal && report && (
            <div className="modal-overlay" onClick={() => setShowReportModal(false)}>
               <div
                  className="modal-content-premium animate-premium"
                  style={{ maxWidth: '980px' }}
                  onClick={(e) => e.stopPropagation()}
               >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px' }}>
                     <div>
                        <div style={{ fontSize: '11px', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                           {report.shift.parkingLot?.name || 'Sede'}
                        </div>
                        <h3 style={{ fontSize: '22px', fontWeight: 900 }}>Reporte de Turno</h3>
                     </div>
                     <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                           className="white-card"
                           style={{ padding: '10px 14px', border: 'none', cursor: 'pointer', fontWeight: 900 }}
                           onClick={handlePrintReport}
                        >
                           <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                              <Printer size={16} /> Imprimir
                           </span>
                        </button>
                        <button
                           className="white-card"
                           style={{ padding: '10px 14px', border: 'none', cursor: 'pointer', fontWeight: 900 }}
                           onClick={() => setShowReportModal(false)}
                        >
                           Cerrar
                        </button>
                     </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '18px' }}>
                     <div className="white-card" style={{ padding: '18px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 900, color: 'var(--text-muted)', marginBottom: '8px' }}>TOTAL ESPERADO</div>
                        <div style={{ fontSize: '20px', fontWeight: 900 }}>{formatCurrency(report.shift.expectedTotal || 0)}</div>
                     </div>
                     <div className="white-card" style={{ padding: '18px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 900, color: 'var(--text-muted)', marginBottom: '8px' }}>TOTAL REAL</div>
                        <div style={{ fontSize: '20px', fontWeight: 900 }}>{formatCurrency(report.shift.actualTotal || 0)}</div>
                     </div>
                     <div className="white-card" style={{ padding: '18px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 900, color: 'var(--text-muted)', marginBottom: '8px' }}>DIFERENCIA</div>
                        <div style={{ fontSize: '20px', fontWeight: 900 }}>{formatCurrency(report.shift.difference || 0)}</div>
                     </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '18px' }}>
                     <div className="white-card" style={{ padding: '18px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 900, color: 'var(--text-muted)', marginBottom: '8px' }}>OPERADOR</div>
                        <div style={{ fontSize: '14px', fontWeight: 900 }}>{report.shift.operator.firstName} {report.shift.operator.lastName}</div>
                        {report.shift.operator.email && (
                           <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-muted)' }}>{report.shift.operator.email}</div>
                        )}
                     </div>
                     <div className="white-card" style={{ padding: '18px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 900, color: 'var(--text-muted)', marginBottom: '8px' }}>PERIODO</div>
                        <div style={{ fontSize: '13px', fontWeight: 900 }}>{formatDate(report.shift.startTime)}</div>
                        <div style={{ fontSize: '13px', fontWeight: 900 }}>{report.shift.endTime ? formatDate(report.shift.endTime) : 'Activo'}</div>
                     </div>
                  </div>

                  <div className="white-card" style={{ padding: '18px', marginBottom: '18px' }}>
                     <div style={{ fontSize: '11px', fontWeight: 900, color: 'var(--text-muted)', marginBottom: '10px' }}>DESGLOSE POR MÉTODO</div>
                     <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
                        {(['CASH', 'CARD', 'DIGITAL_WALLET', 'PREPAID', 'MONTHLY'] as PaymentMethod[]).map((m) => {
                           const b = report.breakdown[m] || { count: 0, total: 0 };
                           return (
                              <div key={m} style={{ padding: '12px 14px', borderRadius: '14px', background: 'rgba(17, 24, 39, 0.04)' }}>
                                 <div style={{ fontSize: '11px', fontWeight: 900, color: 'var(--text-muted)', marginBottom: '6px' }}>{methodLabel(m)}</div>
                                 <div style={{ fontSize: '13px', fontWeight: 900 }}>{formatCurrency(b.total || 0)}</div>
                                 <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-muted)' }}>{b.count} pagos</div>
                              </div>
                           );
                        })}
                     </div>
                  </div>

                  <div className="white-card" style={{ padding: '18px' }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 900, color: 'var(--text-muted)' }}>PAGOS ({report.shift.paymentsCount})</div>
                        <div style={{ fontSize: '11px', fontWeight: 900, color: 'var(--text-muted)' }}>Últimos {report.payments.length}</div>
                     </div>
                     <div style={{ overflowX: 'auto' }}>
                        <table className="data-table" style={{ width: '100%' }}>
                           <thead>
                              <tr>
                                 <th>Fecha</th>
                                 <th>Ticket</th>
                                 <th>Placa</th>
                                 <th>Método</th>
                                 <th style={{ textAlign: 'right' }}>Monto</th>
                              </tr>
                           </thead>
                           <tbody>
                              {report.payments.map((p) => (
                                 <tr key={p.id}>
                                    <td style={{ fontSize: '13px', fontWeight: 800 }}>{formatDate(p.createdAt)}</td>
                                    <td style={{ fontWeight: 900, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{p.ticket.ticketCode}</td>
                                    <td style={{ fontWeight: 900 }}>{p.ticket.vehicle.plate}</td>
                                    <td style={{ fontWeight: 900 }}>{methodLabel(p.method)}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 900 }}>{formatCurrency(p.amount)}</td>
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                     </div>
                  </div>
               </div>
            </div>
         )}
    </div>
  );
}

