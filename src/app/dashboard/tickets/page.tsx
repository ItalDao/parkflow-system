'use client';

import { useState, useEffect, useCallback } from 'react';
import { formatCurrency, formatDate, getStatusLabel, getVehicleTypeIcon } from '@/lib/utils';
import { 
  PlusCircle, 
  LogOut, 
  Loader2, 
  CheckCircle2, 
  Search, 
  MapPin, 
  Clock, 
  Timer, 
  Banknote, 
  QrCode, 
  Printer, 
  Activity, 
  AlertCircle,
  MoreHorizontal,
  ChevronRight,
  Filter
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

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [filter, setFilter] = useState('');
  const [showEntry, setShowEntry] = useState(false);
  const [showExit, setShowExit] = useState(false);
  const [entryForm, setEntryForm] = useState({ plate: '', vehicleType: 'CAR', spaceId: '' });
  const [exitSearch, setExitSearch] = useState('');
  const [exitTicket, setExitTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [viewingTicket, setViewingTicket] = useState<Ticket | null>(null);

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
      if (ticketsRes.ok) setTickets(await ticketsRes.ok ? await ticketsRes.json() : []);
      if (zonesRes.ok) setZones(await zonesRes.ok ? await zonesRes.json() : []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleEntry = async () => {
    setProcessing(true);
    try {
      const res = await fetch('/api/dashboard', {
        method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ resource: 'entry', ...entryForm }),
      });
      if (res.ok) {
        setShowEntry(false); setEntryForm({ plate: '', vehicleType: 'CAR', spaceId: '' });
        fetchData();
      } else { const data = await res.json(); alert(data.error); }
    } catch { alert('Error al registrar entrada'); }
    finally { setProcessing(false); }
  };

  const handleSearchExit = () => {
    const found = tickets.find(t => t.status === 'ACTIVE' &&
      (t.vehicle.plate.toUpperCase().includes(exitSearch.toUpperCase()) || t.ticketCode.toUpperCase().includes(exitSearch.toUpperCase()))
    );
    setExitTicket(found || null);
  };

  const handleExit = async () => {
    if (!exitTicket) return;
    setProcessing(true);
    try {
      const res = await fetch('/api/dashboard', {
        method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ resource: 'exit', ticketId: exitTicket.id, paymentMethod: 'CASH' }),
      });
      if (res.ok) {
        setShowExit(false); setExitTicket(null); setExitSearch('');
        fetchData();
      } else { const d = await res.json(); alert(d.error); }
    } catch { alert('Error al registrar salida'); }
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
              <input className="white-card" style={{ border: 'none', padding: '12px 16px 12px 48px', width: '100%', fontSize: '13px', fontWeight: 700 }} placeholder="Buscar por placa o código..." />
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
                 {tickets.map(t => (
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
                            <button onClick={() => window.print()} className="white-card" style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}><Printer size={16} /></button>
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
    </div>
  );
}
