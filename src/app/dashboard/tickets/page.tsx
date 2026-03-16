'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { formatCurrency, formatDate, getStatusLabel, getVehicleTypeIcon } from '@/lib/utils';
import QRCode from 'qrcode';
import toast from 'react-hot-toast';
import { 
  PlusCircle, 
  LogOut, 
  Loader2, 
  Search, 
  MapPin, 
  Clock, 
   QrCode,
   Printer,
  AlertCircle,
   X
} from 'lucide-react';

interface Ticket {
  id: string; ticketCode: string; status: string; entryTime: string; exitTime?: string;
  totalHours?: number; totalAmount?: number;
  vehicle: { plate: string; type: string; brand?: string; color?: string };
  space: { number: string; zone: { name: string } };
  operator?: { firstName: string; lastName: string };
  payment?: { amount: number; method: string };
}

interface Zone { id: string; name: string; spaces: Array<{ id: string; number: string; status: string }> }

type PaymentMethod = 'CASH' | 'CARD' | 'DIGITAL_WALLET' | 'PREPAID' | 'MONTHLY';

type TicketQuote = {
   ticket: {
      id: string;
      ticketCode: string;
      entryTime: string;
      vehicle: { plate: string; type: string };
      space: { number: string; zone: { name: string } };
   };
   pricing: {
      totalHours: number;
      hourlyRate: number;
      gracePeriodMinutes: number;
      amount: number;
      lostTicketFee: number;
      isLostTicket: boolean;
   };
   serverTime: string;
};

function getAuthHeaders() {
   return { Authorization: `Bearer ${localStorage.getItem('accessToken')}`, 'Content-Type': 'application/json' };
}

function extractQueryFromScan(input: string): string {
   const raw = (input || '').trim();
   if (!raw) return '';
   if (raw.startsWith('{') && raw.endsWith('}')) {
      try {
         const parsed = JSON.parse(raw) as { ticketCode?: string; plate?: string; ticketId?: string };
         return (parsed.ticketCode || parsed.plate || parsed.ticketId || raw).trim();
      } catch {
         return raw;
      }
   }
   return raw;
}

function buildPrintableHtml(params: { ticket: Ticket; qrDataUrl?: string | null; title: string }) {
   const { ticket, qrDataUrl, title } = params;
   const safe = (s: unknown) => String(s ?? '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
   return `<!doctype html>
<html lang="es">
   <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${safe(title)}</title>
      <style>
         :root { color-scheme: light; }
         body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 0; padding: 24px; }
         .card { border: 2px solid #111827; border-radius: 16px; padding: 18px; max-width: 520px; margin: 0 auto; }
         .row { display: flex; justify-content: space-between; gap: 16px; }
         .muted { color: #6b7280; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; }
         .big { font-size: 28px; font-weight: 900; letter-spacing: .12em; }
         .code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 900; letter-spacing: .06em; }
         .hr { height: 1px; background: #e5e7eb; margin: 14px 0; }
         img { max-width: 220px; border-radius: 12px; border: 1px solid #e5e7eb; }
         @media print { body { padding: 0; } .card { border: none; } }
      </style>
   </head>
   <body>
      <div class="card">
         <div class="row" style="align-items: baseline;">
            <div>
               <div class="muted">Ticket</div>
               <div class="code">#${safe(ticket.ticketCode)}</div>
            </div>
            <div style="text-align: right;">
               <div class="muted">Estado</div>
               <div style="font-weight: 900;">${safe(getStatusLabel(ticket.status))}</div>
            </div>
         </div>
         <div class="hr"></div>
         <div class="row">
            <div>
               <div class="muted">Placa</div>
               <div class="big">${safe(ticket.vehicle.plate)}</div>
            </div>
            <div style="text-align:right;">
               <div class="muted">Zona / Espacio</div>
               <div style="font-weight: 900;">${safe(ticket.space.zone.name)} · ${safe(ticket.space.number)}</div>
            </div>
         </div>
         <div class="hr"></div>
         <div class="row" style="align-items: center;">
            <div>
               <div class="muted">Entrada</div>
               <div style="font-weight: 800;">${safe(formatDate(ticket.entryTime))}</div>
               <div class="muted" style="margin-top: 10px;">Salida</div>
               <div style="font-weight: 800;">${safe(ticket.exitTime ? formatDate(ticket.exitTime) : '—')}</div>
            </div>
            ${qrDataUrl ? `<div style="text-align:center;"><div class="muted">QR</div><img src="${qrDataUrl}" alt="QR" /></div>` : ''}
         </div>
         <div class="hr"></div>
         <div class="row">
            <div>
               <div class="muted">Monto</div>
               <div style="font-weight: 900; font-size: 18px;">${safe(ticket.totalAmount ? formatCurrency(ticket.totalAmount) : '—')}</div>
            </div>
            <div style="text-align:right;">
               <div class="muted">Operador</div>
               <div style="font-weight: 800;">${safe(ticket.operator ? `${ticket.operator.firstName} ${ticket.operator.lastName}` : 'Sistema')}</div>
            </div>
         </div>
      </div>
      <script>
         window.focus();
         window.print();
      </script>
   </body>
</html>`;
}

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [filter, setFilter] = useState('');
   const [query, setQuery] = useState('');
  const [showEntry, setShowEntry] = useState(false);
  const [showExit, setShowExit] = useState(false);
  const [entryForm, setEntryForm] = useState({ plate: '', vehicleType: 'CAR', spaceId: '' });
  const [exitSearch, setExitSearch] = useState('');
  const [exitTicket, setExitTicket] = useState<Ticket | null>(null);
   const [exitPaymentMethod, setExitPaymentMethod] = useState<PaymentMethod>('CASH');
   const [cashReceived, setCashReceived] = useState('');
   const [lostTicket, setLostTicket] = useState(false);
   const [quote, setQuote] = useState<TicketQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [viewingTicket, setViewingTicket] = useState<Ticket | null>(null);
   const [viewingQrDataUrl, setViewingQrDataUrl] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [ticketsRes, zonesRes] = await Promise.all([
        fetch(`/api/dashboard?resource=tickets${filter ? `&status=${filter}` : ''}`, { 
           headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` } 
        }),
        fetch('/api/dashboard?resource=zones', { 
           headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` } 
        }),
      ]);
      if (ticketsRes.ok) setTickets(await ticketsRes.json());
      if (zonesRes.ok) setZones(await zonesRes.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { fetchData(); }, [fetchData]);

   const filteredTickets = useMemo(() => {
      const q = query.trim().toLowerCase();
      if (!q) return tickets;
      return tickets.filter((t) => {
         const plate = t.vehicle?.plate?.toLowerCase() || '';
         const code = t.ticketCode?.toLowerCase() || '';
         return plate.includes(q) || code.includes(q);
      });
   }, [tickets, query]);

   useEffect(() => {
      let cancelled = false;
      (async () => {
         if (!viewingTicket) {
            setViewingQrDataUrl(null);
            return;
         }
         try {
            const payload = viewingTicket.ticketCode;
            const url = await QRCode.toDataURL(payload, { margin: 1, width: 260 });
            if (!cancelled) setViewingQrDataUrl(url);
         } catch (err) {
            console.error('QR generation failed:', err);
            if (!cancelled) setViewingQrDataUrl(null);
         }
      })();
      return () => {
         cancelled = true;
      };
   }, [viewingTicket]);

  const handleEntry = async () => {
      if (!entryForm.plate.trim() || !entryForm.spaceId) return;
    setProcessing(true);
    try {
      const res = await fetch('/api/dashboard', {
            method: 'POST', headers: getAuthHeaders(),
        body: JSON.stringify({ resource: 'entry', ...entryForm }),
      });
      if (res.ok) {
        setShowEntry(false); setEntryForm({ plate: '', vehicleType: 'CAR', spaceId: '' });
        fetchData();
         } else {
             const data = await res.json().catch(() => ({} as { error?: string }));
             toast.error((data as { error?: string }).error || 'No se pudo registrar la entrada');
         }
      } catch {
         toast.error('Error al registrar entrada');
      }
    finally { setProcessing(false); }
  };

   const handleSearchExit = async () => {
      const q = extractQueryFromScan(exitSearch);
      if (!q) return;

      try {
         const res = await fetch(`/api/dashboard?resource=tickets&status=ACTIVE&q=${encodeURIComponent(q)}&take=1`, {
            headers: getAuthHeaders(),
         });
         if (!res.ok) {
            setExitTicket(null);
            return;
         }
         const data = (await res.json()) as Ticket[];
         setExitTicket(data[0] || null);
      } catch (err) {
         console.error(err);
         setExitTicket(null);
      }
   };

   useEffect(() => {
      let cancelled = false;
      (async () => {
         setQuote(null);
         if (!exitTicket) return;
         try {
            const res = await fetch(
               `/api/dashboard?resource=ticket-quote&ticketId=${encodeURIComponent(exitTicket.id)}&lostTicket=${lostTicket ? 'true' : 'false'}`,
               { headers: getAuthHeaders() }
            );
            if (!res.ok) return;
            const data = (await res.json()) as TicketQuote;
            if (!cancelled) setQuote(data);
         } catch (err) {
            console.error(err);
         }
      })();
      return () => {
         cancelled = true;
      };
   }, [exitTicket, lostTicket]);

  const handleExit = async () => {
    if (!exitTicket) return;
    setProcessing(true);
    try {
         const cash = cashReceived.trim() ? Number(cashReceived) : undefined;
         if (exitPaymentMethod === 'CASH' && cashReceived.trim() && (!Number.isFinite(cash) || (cash ?? 0) < 0)) {
            toast.error('Monto recibido inválido');
            return;
         }

      const res = await fetch('/api/dashboard', {
            method: 'POST', headers: getAuthHeaders(),
            body: JSON.stringify({
               resource: 'exit',
               ticketId: exitTicket.id,
               paymentMethod: exitPaymentMethod,
               cashReceived: exitPaymentMethod === 'CASH' ? cash : undefined,
               lostTicket,
            }),
      });
      if (res.ok) {
            setShowExit(false);
            setExitTicket(null);
            setExitSearch('');
            setCashReceived('');
            setExitPaymentMethod('CASH');
            setLostTicket(false);
            setQuote(null);
        fetchData();
         } else {
             const d = await res.json().catch(() => ({} as { error?: string }));
             toast.error((d as { error?: string }).error || 'No se pudo registrar la salida');
         }
      } catch {
         toast.error('Error al registrar salida');
      }
    finally { setProcessing(false); }
  };

  const availableSpaces = zones.flatMap(z => z.spaces.filter(s => s.status === 'AVAILABLE').map(s => ({ ...s, zoneName: z.name })));

  if (loading) return <div style={{ height: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner" /></div>;

  return (
    <div className="animate-premium" style={{ paddingTop: '10px' }}>
      
      {/* Header Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
         <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>Centro Operativo</h2>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Gestión de ingresos y liquidación de tickets</span>
         </div>
         <div style={{ display: 'flex', gap: '12px' }}>
            <button className="white-card" style={{ padding: '0 24px', height: '48px', display: 'flex', alignItems: 'center', gap: '8px', border: 'none', cursor: 'pointer', fontWeight: 800, color: 'var(--text-primary)' }} onClick={() => setShowExit(true)}>
               <LogOut size={18} color="var(--accent-danger)" /> Procesar Salida
            </button>
            <button className="btn-primary" style={{ padding: '0 32px', height: '48px' }} onClick={() => setShowEntry(true)}>
               <PlusCircle size={18} /> Nueva Entrada
            </button>
         </div>
      </div>

      {/* Filters & Table */}
      <div className="glass-card" style={{ padding: '40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
           <div style={{ display: 'flex', gap: '8px' }}>
              {['', 'ACTIVE', 'COMPLETED', 'CANCELLED'].map(f => (
                <button key={f} 
                  onClick={() => setFilter(f)} 
                  style={{ 
                    padding: '10px 24px', borderRadius: 'var(--radius-pill)', border: 'none',
                    fontSize: '13px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.3s ease',
                    background: filter === f ? 'var(--accent-primary)' : 'white',
                    color: filter === f ? 'white' : 'var(--text-muted)'
                  }}>
                  {f === '' ? 'Todos' : getStatusLabel(f)}
                </button>
              ))}
           </div>
           <div style={{ position: 'relative', width: '300px' }}>
              <input
                className="white-card"
                style={{ border: 'none', padding: '12px 16px 12px 48px', width: '100%', fontSize: '13px', fontWeight: 700 }}
                placeholder="Buscar por placa o código..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <Search size={18} style={{ position: 'absolute', left: '16px', top: '12px', color: 'var(--text-muted)' }} />
           </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
           <table className="data-table" style={{ width: '100%' }}>
              <thead>
                 <tr>
                    <th style={{ paddingBottom: '24px' }}>Vehículo / Ticket</th>
                    <th>Zona / Espacio</th>
                    <th>Entrada</th>
                    <th>Salida</th>
                    <th>Monto</th>
                    <th>Estado</th>
                    <th style={{ textAlign: 'right' }}>Acciones</th>
                 </tr>
              </thead>
              <tbody>
                         {filteredTickets.map(t => (
                   <tr key={t.id}>
                      <td style={{ paddingTop: '24px', paddingBottom: '24px' }}>
                         <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div className="white-card" style={{ width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                               {getVehicleTypeIcon(t.vehicle.type, 24)}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                               <span style={{ fontSize: '15px', fontWeight: 900 }}>{t.vehicle.plate}</span>
                               <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>#{t.ticketCode}</span>
                            </div>
                         </div>
                      </td>
                      <td>
                         <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '14px', fontWeight: 800 }}>{t.space.zone.name}</span>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Slot {t.space.number}</span>
                         </div>
                      </td>
                      <td style={{ fontSize: '13px', fontWeight: 700 }}>{formatDate(t.entryTime)}</td>
                      <td style={{ fontSize: '13px', fontWeight: 700 }}>{t.exitTime ? formatDate(t.exitTime) : '—'}</td>
                      <td style={{ fontSize: '15px', fontWeight: 900 }}>{t.totalAmount ? formatCurrency(t.totalAmount) : '—'}</td>
                      <td>
                         <span className={`badge ${t.status === 'ACTIVE' ? 'badge-success' : t.status === 'COMPLETED' ? 'badge-info' : 'badge-danger'}`} style={{ padding: '8px 16px', borderRadius: '12px', fontSize: '11px', fontWeight: 800 }}>
                            {getStatusLabel(t.status)}
                         </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                         <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                          <button onClick={() => setViewingTicket(t)} className="white-card" style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}><QrCode size={16} /></button>
                                          <button
                                             onClick={async () => {
                                                try {
                                                   const qr = await QRCode.toDataURL(t.ticketCode, { margin: 1, width: 220 });
                                                   const w = window.open('', '_blank', 'width=640,height=760');
                                                   if (!w) return;
                                                   w.document.open();
                                                   w.document.write(buildPrintableHtml({ ticket: t, qrDataUrl: qr, title: 'Ticket' }));
                                                   w.document.close();
                                                } catch (err) {
                                                   console.error(err);
                                                   const w = window.open('', '_blank', 'width=640,height=760');
                                                   if (!w) return;
                                                   w.document.open();
                                                   w.document.write(buildPrintableHtml({ ticket: t, qrDataUrl: null, title: 'Ticket' }));
                                                   w.document.close();
                                                }
                                             }}
                                             className="white-card"
                                             style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}
                                          >
                                             <Printer size={16} />
                                          </button>
                         </div>
                      </td>
                   </tr>
                 ))}
              </tbody>
           </table>
        </div>
      </div>

      {/* Entry Modal */}
      {showEntry && (
        <div className="modal-overlay" onClick={() => setShowEntry(false)}>
          <div className="modal-content-premium animate-premium" style={{ maxWidth: '560px' }} onClick={e => e.stopPropagation()}>
             <h3 style={{ fontSize: '24px', fontWeight: 900, marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '12px' }}>
               <PlusCircle size={28} color="var(--accent-gold)" /> Nueva Entrada
             </h3>
             <div className="form-grid" style={{ marginBottom: '32px' }}>
                <div className="form-group">
                   <label className="input-label">Placa</label>
                   <input className="input-field" placeholder="ABC-123" value={entryForm.plate} onChange={e => setEntryForm({ ...entryForm, plate: e.target.value.toUpperCase() })} style={{ fontSize: '24px', fontWeight: 900, textAlign: 'center', letterSpacing: '4px', height: '64px' }} />
                </div>
                <div className="form-group">
                   <label className="input-label">Vehículo</label>
                   <select className="input-field" value={entryForm.vehicleType} onChange={e => setEntryForm({ ...entryForm, vehicleType: e.target.value })} style={{ height: '64px', fontWeight: 800 }}>
                      <option value="CAR">Automóvil</option>
                      <option value="MOTORCYCLE">Motocicleta</option>
                      <option value="VAN">Camioneta</option>
                   </select>
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                   <label className="input-label">Ubicación</label>
                   <select className="input-field" value={entryForm.spaceId} onChange={e => setEntryForm({ ...entryForm, spaceId: e.target.value })} style={{ height: '64px', fontWeight: 800 }}>
                      <option value="">Selecciona espacio...</option>
                      {availableSpaces.map(s => (
                        <option key={s.id} value={s.id}>{s.zoneName} — Slot {s.number}</option>
                      ))}
                   </select>
                </div>
             </div>
             <button className="btn-primary" style={{ width: '100%', height: '64px', fontSize: '16px' }} onClick={handleEntry} disabled={processing}>
                {processing ? <Loader2 className="animate-spin" /> : 'Registrar Ingreso'}
             </button>
          </div>
        </div>
      )}

      {/* Exit Modal */}
      {showExit && (
        <div className="modal-overlay" onClick={() => setShowExit(false)}>
           <div className="modal-content-premium animate-premium" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
              <h3 style={{ fontSize: '24px', fontWeight: 900, marginBottom: '32px' }}>Liquidación de Salida</h3>
              <div style={{ position: 'relative', marginBottom: '32px' }}>
                 <input className="input-field" placeholder="Buscar placa o ticket..." value={exitSearch} onChange={e => setExitSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearchExit()} style={{ height: '56px', paddingRight: '120px' }} />
                 <button onClick={handleSearchExit} style={{ position: 'absolute', right: '8px', top: '8px', bottom: '8px', background: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: '12px', padding: '0 20px', fontWeight: 800 }}>BUSCAR</button>
              </div>

              {exitTicket ? (
                <div className="white-card" style={{ padding: '32px', border: '2px solid var(--accent-gold)' }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
                      <span style={{ fontSize: '28px', fontWeight: 900, letterSpacing: '2px' }}>{exitTicket.vehicle.plate}</span>
                      <span className="badge badge-success">ACTIVO</span>
                   </div>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', fontSize: '14px', fontWeight: 700 }}><MapPin size={16} /> {exitTicket.space.zone.name} - Slot {exitTicket.space.number}</div>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', fontSize: '14px', fontWeight: 700 }}><Clock size={16} /> {formatDate(exitTicket.entryTime)}</div>
                   </div>

                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                                 <div>
                                    <label className="input-label">Método</label>
                                    <select className="input-field" value={exitPaymentMethod} onChange={(e) => setExitPaymentMethod(e.target.value as PaymentMethod)} style={{ height: '50px', fontWeight: 800 }}>
                                       <option value="CASH">Efectivo</option>
                                       <option value="CARD">Tarjeta</option>
                                       <option value="DIGITAL_WALLET">Billetera digital</option>
                                       <option value="PREPAID">Prepago</option>
                                       <option value="MONTHLY">Mensualidad</option>
                                    </select>
                                 </div>
                                 <div>
                                    <label className="input-label">Ticket perdido</label>
                                    <button
                                       className="white-card"
                                       style={{ width: '100%', height: '50px', border: 'none', fontWeight: 900, cursor: 'pointer', background: lostTicket ? 'rgba(220, 38, 38, 0.12)' : 'white' }}
                                       onClick={() => setLostTicket((v) => !v)}
                                       type="button"
                                    >
                                       {lostTicket ? 'SI' : 'NO'}
                                    </button>
                                 </div>
                              </div>

                              {exitPaymentMethod === 'CASH' && (
                                 <div style={{ marginBottom: '16px' }}>
                                    <label className="input-label">Efectivo recibido (opcional)</label>
                                    <input className="input-field" type="number" placeholder="0" value={cashReceived} onChange={(e) => setCashReceived(e.target.value)} style={{ height: '50px', fontWeight: 900 }} />
                                    {quote && cashReceived.trim() && Number.isFinite(Number(cashReceived)) && (
                                       <div style={{ marginTop: '8px', fontSize: '12px', fontWeight: 800, color: 'var(--text-muted)' }}>
                                          Cambio estimado: {formatCurrency(Math.max(0, Number(cashReceived) - quote.pricing.amount))}
                                       </div>
                                    )}
                                 </div>
                              )}

                              <div className="white-card" style={{ padding: '16px', marginBottom: '18px' }}>
                                 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <span style={{ fontSize: '11px', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Monto</span>
                                    <span style={{ fontSize: '14px', fontWeight: 900 }}>{quote ? formatCurrency(quote.pricing.amount) : 'Calculando…'}</span>
                                 </div>
                                 <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: '11px', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Tiempo</span>
                                    <span style={{ fontSize: '13px', fontWeight: 800 }}>{quote ? `${quote.pricing.totalHours} h` : '—'}</span>
                                 </div>
                              </div>

                   <button className="btn-primary" style={{ width: '100%', height: '60px' }} onClick={handleExit} disabled={processing}>
                      {processing ? <Loader2 className="animate-spin" /> : 'Confirmar y Cobrar'}
                   </button>
                </div>
              ) : exitSearch && (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                   <AlertCircle size={48} style={{ opacity: 0.1, marginBottom: '16px' }} />
                   <p style={{ fontWeight: 800 }}>No se encontró un ticket activo.</p>
                </div>
              )}
           </div>
        </div>
      )}

         {/* QR / Print Modal */}
         {viewingTicket && (
            <div className="modal-overlay" onClick={() => setViewingTicket(null)}>
               <div className="modal-content-premium animate-premium" style={{ maxWidth: '560px' }} onClick={(e) => e.stopPropagation()}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                     <div>
                        <h3 style={{ fontSize: '22px', fontWeight: 900, marginBottom: '4px' }}>Ticket #{viewingTicket.ticketCode}</h3>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>{viewingTicket.vehicle.plate} · {viewingTicket.space.zone.name} · Slot {viewingTicket.space.number}</div>
                     </div>
                     <button className="white-card" style={{ width: '40px', height: '40px', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setViewingTicket(null)}>
                        <X size={18} />
                     </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '16px', alignItems: 'center' }}>
                     <div className="white-card" style={{ padding: '18px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                           <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: '11px', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Entrada</span>
                              <span style={{ fontSize: '13px', fontWeight: 800 }}>{formatDate(viewingTicket.entryTime)}</span>
                           </div>
                           <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: '11px', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Estado</span>
                              <span style={{ fontSize: '13px', fontWeight: 900 }}>{getStatusLabel(viewingTicket.status)}</span>
                           </div>
                           <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: '11px', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Monto</span>
                              <span style={{ fontSize: '13px', fontWeight: 900 }}>{viewingTicket.totalAmount ? formatCurrency(viewingTicket.totalAmount) : '—'}</span>
                           </div>
                        </div>
                     </div>

                     <div className="white-card" style={{ padding: '18px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                        {viewingQrDataUrl ? (
                           <img src={viewingQrDataUrl} alt="QR" style={{ width: '220px', height: '220px', objectFit: 'contain', borderRadius: '14px' }} />
                        ) : (
                           <div style={{ width: '220px', height: '220px', borderRadius: '14px', border: '2px dashed var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontWeight: 900 }}>Generando…</div>
                        )}
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800 }}>Escanea para buscar por código</div>
                     </div>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', marginTop: '18px' }}>
                     <button
                        className="white-card"
                        style={{ flex: 1, height: '56px', border: 'none', fontWeight: 900, cursor: 'pointer' }}
                        onClick={() => {
                           const w = window.open('', '_blank', 'width=640,height=760');
                           if (!w) return;
                           w.document.open();
                           w.document.write(buildPrintableHtml({ ticket: viewingTicket, qrDataUrl: viewingQrDataUrl, title: 'Ticket' }));
                           w.document.close();
                        }}
                     >
                        <Printer size={16} /> Imprimir
                     </button>
                     <button className="btn-primary" style={{ flex: 1, height: '56px' }} onClick={() => setViewingTicket(null)}>
                        Cerrar
                     </button>
                  </div>
               </div>
            </div>
         )}
    </div>
  );
}
