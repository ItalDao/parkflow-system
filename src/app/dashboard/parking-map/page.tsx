'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Map as MapIcon, 
  RotateCcw,
  X
} from 'lucide-react';
import { getVehicleTypeIcon } from '@/lib/utils';
import toast from 'react-hot-toast';

function getAuthHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem('accessToken')}`, 'Content-Type': 'application/json' };
}

type TicketLite = {
  id: string;
  ticketCode: string;
  entryTime: string;
  vehicle: { plate: string; type: string; brand?: string | null; color?: string | null };
};

interface Space {
  id: string; number: string; status: string; floor: number;
  tickets: TicketLite[];
}

interface Zone {
  id: string; name: string; type: string; spaces: Space[];
}

export default function ParkingMapPage() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [activeZoneId, setActiveZoneId] = useState<string>('');
  const [selectedSpace, setSelectedSpace] = useState<Space | null>(null);
  const [loading, setLoading] = useState(true);

  const [showEntry, setShowEntry] = useState(false);
  const [showExit, setShowExit] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [entryForm, setEntryForm] = useState({ plate: '', vehicleType: 'CAR' });
  const [exitPaymentMethod, setExitPaymentMethod] = useState<'CASH' | 'CARD' | 'DIGITAL_WALLET'>('CASH');

  const fetchZones = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard?resource=zones', { 
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` } 
      });
      if (res.ok) {
        const data = await res.json();
        setZones(data);
        if (data.length > 0 && !activeZoneId) setActiveZoneId(data[0].id);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [activeZoneId]);

  useEffect(() => { fetchZones(); }, [fetchZones]);

  const currentZone = zones.find(z => z.id === activeZoneId);
  const totalSpaces = zones.reduce((a, z) => a + z.spaces.length, 0);
  const occupiedSpaces = zones.reduce((a, z) => a + z.spaces.filter(s => s.status === 'OCCUPIED').length, 0);
  const availableSpaces = totalSpaces - occupiedSpaces;

  const selectedTicket = selectedSpace?.tickets?.[0] || null;
  const canEntry = selectedSpace?.status === 'AVAILABLE';
  const canExit = selectedSpace?.status === 'OCCUPIED' && !!selectedTicket;

  const handleRegister = () => {
    if (!selectedSpace) return;
    if (canEntry) {
      setEntryForm({ plate: '', vehicleType: 'CAR' });
      setShowEntry(true);
      return;
    }
    if (canExit) {
      setExitPaymentMethod('CASH');
      setShowExit(true);
    }
  };

  const submitEntry = async () => {
    if (!selectedSpace) return;
    const plate = entryForm.plate.trim().toUpperCase();
    if (!plate) return;
    setProcessing(true);
    try {
      const res = await fetch('/api/dashboard', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ resource: 'entry', plate, vehicleType: entryForm.vehicleType, spaceId: selectedSpace.id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error((data as { error?: string }).error || 'No se pudo registrar la entrada');
        return;
      }
      setShowEntry(false);
      setSelectedSpace(null);
      await fetchZones();
    } catch (err) {
      console.error(err);
      toast.error('Error al registrar entrada');
    } finally {
      setProcessing(false);
    }
  };

  const submitExit = async () => {
    if (!selectedTicket) return;
    setProcessing(true);
    try {
      const res = await fetch('/api/dashboard', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ resource: 'exit', ticketId: selectedTicket.id, paymentMethod: exitPaymentMethod }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error((data as { error?: string }).error || 'No se pudo procesar la salida');
        return;
      }
      setShowExit(false);
      setSelectedSpace(null);
      await fetchZones();
    } catch (err) {
      console.error(err);
      toast.error('Error al procesar salida');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <div style={{ height: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner" /></div>;

  return (
    <div className="animate-premium" style={{ display: 'grid', gridTemplateColumns: '2.4fr 1fr', gap: '32px', paddingTop: '10px' }}>
      
      {/* LEFT COLUMN: Map View */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        <div className="glass-card" style={{ padding: '40px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '40px' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
               <h2 style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>Infraestructura de Zonas</h2>
               <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Mapa interactivo de ocupación · Bogotá</span>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
               <button onClick={fetchZones} className="white-card" style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}><RotateCcw size={18} /></button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px', marginBottom: '40px', overflowX: 'auto', paddingBottom: '8px' }}>
            {zones.map(zone => (
              <button 
                key={zone.id}
                onClick={() => setActiveZoneId(zone.id)}
                style={{ 
                  padding: '16px 32px', borderRadius: 'var(--radius-pill)', border: 'none',
                  fontSize: '14px', fontWeight: 800, cursor: 'pointer', transition: 'all 0.3s ease',
                  background: activeZoneId === zone.id ? 'var(--accent-gold)' : 'white',
                  color: activeZoneId === zone.id ? 'var(--text-primary)' : 'var(--text-muted)',
                  boxShadow: activeZoneId === zone.id ? '0 8px 24px rgba(233, 185, 73, 0.4)' : 'none',
                  whiteSpace: 'nowrap'
                }}
              >
                {zone.name}
              </button>
            ))}
          </div>

          {/* Grid Layout */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '20px' }}>
             {currentZone?.spaces.map((space) => {
               const vehicle = space.tickets?.[0]?.vehicle;
               const isSelected = selectedSpace?.id === space.id;
               return (
                 <div key={space.id} 
                    onClick={() => setSelectedSpace(space)}
                    className="white-card" 
                    style={{ 
                        padding: '24px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
                        border: isSelected ? '3px solid var(--accent-gold)' : '2px solid transparent',
                        background: isSelected ? 'rgba(233, 185, 73, 0.08)' : 'white',
                        transition: 'all 0.3s ease', cursor: 'pointer',
                        position: 'relative'
                    }}
                 >
                  {space.status === 'OCCUPIED' && vehicle ? (
                     <div style={{ position: 'relative' }}>
                        {getVehicleTypeIcon(vehicle.type, 32)}
                        <div style={{ position: 'absolute', top: -4, right: -4, width: '10px', height: '10px', background: 'var(--accent-danger)', borderRadius: '50%', border: '2px solid white' }} />
                     </div>
                   ) : (
                     <div style={{ width: '32px', height: '32px', border: '2px dashed #e2e8f0', borderRadius: '8px', 
                        background: space.status === 'RESERVED' ? 'rgba(233, 185, 73, 0.1)' : 'transparent' 
                     }} />
                   )}
                   <span style={{ fontSize: '12px', fontWeight: 900, color: space.status === 'AVAILABLE' ? '#cbd5e1' : 'var(--text-primary)' }}>{space.number}</span>
                 </div>
               );
             })}
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Details */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        
        {/* Status Hub */}
        <div className="glass-card" style={{ padding: '32px' }}>
           <h3 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '24px' }}>Estado General</h3>
           <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="white-card" style={{ padding: '20px', textAlign: 'center' }}>
                 <div style={{ fontSize: '24px', fontWeight: 900, color: 'var(--accent-success)' }}>{availableSpaces}</div>
                 <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>DISPONIBLES</div>
              </div>
              <div className="white-card" style={{ padding: '20px', textAlign: 'center' }}>
                 <div style={{ fontSize: '24px', fontWeight: 900, color: 'var(--accent-danger)' }}>{occupiedSpaces}</div>
                 <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>OCUPADOS</div>
              </div>
           </div>
        </div>

        {/* Space Inspector */}
        <div className="glass-card" style={{ padding: '32px' }}>
           <h3 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '32px' }}>Inspector de Espacio</h3>
           
           {selectedSpace ? (
             <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{ 
                   background: 'var(--bg-primary)', padding: '32px', borderRadius: '24px', textAlign: 'center',
                   border: '2px dashed var(--border-color)'
                }}>
                   {selectedSpace.tickets?.[0]?.vehicle ? (
                     <>
                        <div style={{ fontSize: '32px', fontWeight: 900, letterSpacing: '4px', marginBottom: '8px' }}>{selectedSpace.tickets[0].vehicle.plate}</div>
                        <span className="badge badge-danger" style={{ padding: '8px 20px', borderRadius: '12px', fontSize: '11px', fontWeight: 800 }}>OCUPADO</span>
                     </>
                   ) : (
                     <>
                        <div style={{ fontSize: '32px', fontWeight: 900, color: 'var(--text-muted)', marginBottom: '8px' }}>{selectedSpace.number}</div>
                        <span className="badge badge-success" style={{ padding: '8px 20px', borderRadius: '12px', fontSize: '11px', fontWeight: 800 }}>DISPONIBLE</span>
                     </>
                   )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', borderRadius: '16px', background: 'white' }}>
                      <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-muted)' }}>ZONA</span>
                      <span style={{ fontSize: '13px', fontWeight: 900 }}>{currentZone?.name}</span>
                   </div>
                   <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', borderRadius: '16px', background: 'white' }}>
                      <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-muted)' }}>NIVEL</span>
                      <span style={{ fontSize: '13px', fontWeight: 900 }}>Piso {selectedSpace.floor}</span>
                   </div>
                </div>

                <button
                  className="btn-primary"
                  style={{ height: '56px', borderRadius: '16px', opacity: (canEntry || canExit) ? 1 : 0.6 }}
                  onClick={handleRegister}
                  disabled={!canEntry && !canExit}
                >
                  {canEntry ? 'Registrar Ingreso' : canExit ? 'Procesar Salida' : 'Operación no disponible'}
                </button>
             </div>
           ) : (
             <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                <MapIcon size={48} style={{ opacity: 0.1, marginBottom: '16px' }} />
                <p style={{ fontWeight: 700, fontSize: '14px' }}>Selecciona un espacio en el mapa para ver los detalles.</p>
             </div>
           )}
        </div>
      </div>

      {/* Entry Modal */}
      {showEntry && selectedSpace && (
        <div className="modal-overlay" onClick={() => !processing && setShowEntry(false)}>
          <div className="modal-content-premium animate-premium" style={{ maxWidth: '520px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ fontSize: '22px', fontWeight: 900 }}>Registrar Ingreso</h3>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Espacio {selectedSpace.number} · {currentZone?.name || '—'}</span>
              </div>
              <button className="white-card" style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none' }} onClick={() => setShowEntry(false)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', marginBottom: '22px' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <div className="input-label" style={{ marginBottom: '8px' }}>Placa</div>
                <input
                  className="white-card"
                  style={{ border: 'none', padding: '16px', width: '100%', fontSize: '20px', fontWeight: 900, textAlign: 'center', letterSpacing: '3px' }}
                  value={entryForm.plate}
                  onChange={(e) => setEntryForm({ ...entryForm, plate: e.target.value.toUpperCase() })}
                  placeholder="ABC123"
                />
              </div>
              <div>
                <div className="input-label" style={{ marginBottom: '8px' }}>Tipo</div>
                <select
                  className="white-card"
                  style={{ border: 'none', padding: '16px', width: '100%', fontSize: '14px', fontWeight: 800 }}
                  value={entryForm.vehicleType}
                  onChange={(e) => setEntryForm({ ...entryForm, vehicleType: e.target.value })}
                >
                  <option value="CAR">Automóvil</option>
                  <option value="MOTORCYCLE">Motocicleta</option>
                  <option value="VAN">Camioneta</option>
                </select>
              </div>
              <div>
                <div className="input-label" style={{ marginBottom: '8px' }}>Estado</div>
                <div className="white-card" style={{ padding: '16px', fontWeight: 900 }}>Disponible</div>
              </div>
            </div>

            <button className="btn-primary" style={{ width: '100%', height: '60px' }} onClick={() => void submitEntry()} disabled={processing || !entryForm.plate.trim()}>
              {processing ? 'Procesando…' : 'Confirmar Ingreso'}
            </button>
          </div>
        </div>
      )}

      {/* Exit Modal */}
      {showExit && selectedTicket && selectedSpace && (
        <div className="modal-overlay" onClick={() => !processing && setShowExit(false)}>
          <div className="modal-content-premium animate-premium" style={{ maxWidth: '520px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ fontSize: '22px', fontWeight: 900 }}>Procesar Salida</h3>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Ticket #{selectedTicket.ticketCode} · Espacio {selectedSpace.number}</span>
              </div>
              <button className="white-card" style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none' }} onClick={() => setShowExit(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="white-card" style={{ padding: '18px', marginBottom: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-muted)' }}>PLACA</span>
                <span style={{ fontSize: '22px', fontWeight: 900, letterSpacing: '3px' }}>{selectedTicket.vehicle.plate}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {getVehicleTypeIcon(selectedTicket.vehicle.type, 26)}
              </div>
            </div>

            <div style={{ marginBottom: '22px' }}>
              <div className="input-label" style={{ marginBottom: '8px' }}>Método de pago</div>
              <select
                className="white-card"
                style={{ border: 'none', padding: '16px', width: '100%', fontSize: '14px', fontWeight: 800 }}
                value={exitPaymentMethod}
                onChange={(e) => setExitPaymentMethod(e.target.value as 'CASH' | 'CARD' | 'DIGITAL_WALLET')}
              >
                <option value="CASH">Efectivo</option>
                <option value="CARD">Tarjeta</option>
                <option value="DIGITAL_WALLET">Billetera digital</option>
              </select>
            </div>

            <button className="btn-primary" style={{ width: '100%', height: '60px', background: 'var(--accent-danger)' }} onClick={() => void submitExit()} disabled={processing}>
              {processing ? 'Procesando…' : 'Confirmar Salida'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
