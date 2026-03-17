'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  MapPin, 
  Car, 
  Zap,
  RotateCcw,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { AIPredictionWidget } from '@/components/dashboard/AIPredictionWidget';
import { AIChatAssistant } from '@/components/dashboard/AIChatAssistant';
import toast from 'react-hot-toast';

interface Space {
  id: string; number: string; status: string;
  tickets?: Array<{ id: string; ticketCode: string; entryTime: string; vehicle: { plate: string; type: string } }>;
}

interface Zone {
  id: string; name: string; spaces: Space[];
}

export default function DashboardPage() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [activeZoneId, setActiveZoneId] = useState<string>('');
  const [selectedSpace, setSelectedSpace] = useState<Space | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [entryForm, setEntryForm] = useState({ plate: '', vehicleType: 'CAR' });
  const [processing, setProcessing] = useState(false);
  const router = useRouter();

  const fetchData = useCallback(async () => {
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem('accessToken')}` };
      const [statsRes, zonesRes] = await Promise.all([
        fetch('/api/dashboard?resource=stats', { headers }),
        fetch('/api/dashboard?resource=zones', { headers })
      ]);
      
      if (statsRes.ok) setStats(await statsRes.json());
      if (zonesRes.ok) {
        const data = await zonesRes.json();
        setZones(data);
        if (data.length > 0 && !activeZoneId) setActiveZoneId(data[0].id);
      }
    } catch (err) {
      console.error(err);
      toast.error('No se pudo cargar el dashboard');
    }
    finally { setLoading(false); }
  }, [activeZoneId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Update selected space data if it changes in the background
  useEffect(() => {
    if (selectedSpace) {
      const updatedZ = zones.find(z => z.spaces.some(s => s.id === selectedSpace.id));
      const updatedS = updatedZ?.spaces.find(s => s.id === selectedSpace.id);
      if (updatedS) setSelectedSpace(updatedS);
    }
  }, [zones, selectedSpace]);

  const handleEntry = async () => {
    if (!selectedSpace) return;
    setProcessing(true);
    try {
      const res = await fetch('/api/dashboard', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ resource: 'entry', ...entryForm, spaceId: selectedSpace.id }),
      });
      if (res.ok) {
        setShowEntryModal(false);
        setEntryForm({ plate: '', vehicleType: 'CAR' });
        fetchData();
      } else {
        const data = await res.json().catch(() => ({} as { error?: string }));
        toast.error((data as { error?: string }).error || 'No se pudo registrar la entrada');
      }
    } catch {
      toast.error('No se pudo registrar la entrada');
    }
    finally { setProcessing(false); }
  };

  const handleExit = async (ticketId: string) => {
    setProcessing(true);
    try {
      const res = await fetch('/api/dashboard', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ resource: 'exit', ticketId, paymentMethod: 'CASH' }),
      });
      if (res.ok) {
        fetchData();
        setSelectedSpace(null);
      } else {
        const d = await res.json().catch(() => ({} as { error?: string }));
        toast.error((d as { error?: string }).error || 'No se pudo procesar la salida');
      }
    } catch {
      toast.error('No se pudo procesar la salida');
    }
    finally { setProcessing(false); }
  };

  const currentZone = zones.find(z => z.id === activeZoneId);
  const activeTicket = selectedSpace?.tickets?.[0];

  const zoneStats = useMemo(() => {
    const metrics = zones.map((z) => {
      const total = z.spaces.length;
      const occupied = z.spaces.filter((s) => s.status === 'OCCUPIED').length;
      const available = z.spaces.filter((s) => s.status === 'AVAILABLE').length;
      const reserved = z.spaces.filter((s) => s.status === 'RESERVED').length;
      const maintenance = z.spaces.filter((s) => s.status === 'MAINTENANCE').length;
      const occupancy = total > 0 ? Math.round((occupied / total) * 100) : 0;
      return { id: z.id, name: z.name, total, occupied, available, reserved, maintenance, occupancy };
    });
    const byOccupancy = [...metrics].sort((a, b) => b.occupancy - a.occupancy);
    const byAvailable = [...metrics].sort((a, b) => b.available - a.available);
    return {
      metrics: byOccupancy,
      top: byOccupancy[0] || null,
      mostAvailable: byAvailable[0] || null,
    };
  }, [zones]);

  if (loading) return <div style={{ height: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner" /></div>;

  return (
    <div className="animate-premium" style={{ display: 'grid', gridTemplateColumns: '2.4fr 1fr', gap: '32px', paddingTop: '10px' }}>
      
      {/* LEFT COLUMN: Main Parking Map */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        <div className="glass-card" style={{ padding: '40px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '40px' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
               <h2 style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
                  {stats?.parkingLot?.name || 'Sede Principal'}
               </h2>
               <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Panel de control interactivo de infraestructura</span>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={fetchData} className="white-card" title="Actualizar" style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}><RotateCcw size={18} /></button>
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

          {/* Grid Map Simulation */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '24px' }}>
             {currentZone?.spaces.map((space) => {
               const isOccupied = space.status === 'OCCUPIED';
               const isSelected = selectedSpace?.id === space.id;
               return (
                 <div key={space.id} 
                    onClick={() => setSelectedSpace(space)}
                    className="white-card" 
                    style={{ 
                    padding: '32px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px',
                    border: isSelected ? '3px solid var(--accent-gold)' : '2px solid transparent',
                    background: isSelected ? 'rgba(233, 185, 73, 0.08)' : 'white',
                    transition: 'all 0.3s ease',
                    position: 'relative',
                    cursor: 'pointer'
                 }}>
                   {isOccupied ? (
                     <div style={{ position: 'relative' }}>
                        <Car size={36} color="var(--text-primary)" strokeWidth={2.5} />
                        <div style={{ position: 'absolute', top: -4, right: -6, width: '10px', height: '10px', background: 'var(--accent-danger)', borderRadius: '50%', border: '2px solid white' }} />
                     </div>
                   ) : (
                     <div style={{ width: '36px', height: '36px', border: '2px dashed #e2e8f0', borderRadius: '8px', background: space.status === 'RESERVED' ? 'rgba(233, 185, 73, 0.1)' : 'transparent' }} />
                   )}
                   <span style={{ fontSize: '13px', fontWeight: 900, color: isOccupied ? 'var(--text-primary)' : 'var(--text-muted)' }}>{space.number}</span>
                 </div>
               );
             })}
          </div>
        </div>

        {/* Bottom Small Cards Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.8fr 1.2fr', gap: '32px' }}>
          
           {/* Operational Snapshot */}
          <div className="glass-card" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 800 }}>Estado Operativo</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="white-card" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Reservados</span>
                  <span style={{ fontSize: '20px', fontWeight: 900 }}>{stats?.reservedSpaces ?? 0}</span>
                </div>
                <div style={{ fontSize: '11px', fontWeight: 900, color: 'var(--text-muted)' }}>ESPACIOS</div>
              </div>
              <div className="white-card" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Mantenimiento</span>
                  <span style={{ fontSize: '20px', fontWeight: 900 }}>{stats?.maintenanceSpaces ?? 0}</span>
                </div>
                <div style={{ fontSize: '11px', fontWeight: 900, color: 'var(--text-muted)' }}>ESPACIOS</div>
              </div>
            </div>
          </div>

          {/* Current Parked Detail / Action Card */}
          <div className="glass-card" style={{ padding: '32px', position: 'relative', overflow: 'hidden' }}>
             {selectedSpace ? (
               <>
                 <div style={{ position: 'absolute', bottom: '-20px', left: '0', right: '0', textAlign: 'center', opacity: 0.05, zIndex: 0 }}>
                    <Car size={180} strokeWidth={1} />
                 </div>
                 <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
                      <h3 style={{ fontSize: '15px', fontWeight: 800 }}>Espacio {selectedSpace.number}</h3>
                      <span className={`badge ${selectedSpace.status === 'OCCUPIED' ? 'badge-danger' : 'badge-success'}`}>
                         {selectedSpace.status === 'OCCUPIED' ? 'OCUPADO' : 'DISPONIBLE'}
                      </span>
                    </div>

                    {activeTicket ? (
                      <>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '28px' }}>
                           <div>
                              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>ID Ticket</div>
                              <div style={{ fontSize: '15px', fontWeight: 900 }}>#{activeTicket.ticketCode.slice(-6)}</div>
                           </div>
                           <div>
                              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>N° Placa</div>
                              <div style={{ fontSize: '15px', fontWeight: 900 }}>{activeTicket.vehicle.plate}</div>
                           </div>
                           <div>
                              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>Entrada</div>
                              <div style={{ fontSize: '15px', fontWeight: 900 }}>{new Date(activeTicket.entryTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                           </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                           <div>
                              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>TIEMPO TRANSCURRIDO</div>
                              <div style={{ fontSize: '36px', fontWeight: 900, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                                 {Math.floor((Date.now() - new Date(activeTicket.entryTime).getTime()) / 3600000)}h {Math.floor(((Date.now() - new Date(activeTicket.entryTime).getTime()) % 3600000) / 60000)}m
                              </div>
                           </div>
                           <button 
                             onClick={() => handleExit(activeTicket.id)}
                             disabled={processing}
                             className="btn-primary" 
                             style={{ padding: '12px 32px', fontSize: '13px', fontWeight: 900, border: 'none', cursor: 'pointer', borderRadius: '14px' }}>
                              {processing ? <Loader2 size={16} className="animate-spin" /> : 'Cobrar Salida'}
                           </button>
                        </div>
                      </>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '20px 0' }}>
                         <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '24px' }}>El espacio está libre para un nuevo vehículo.</p>
                         <button 
                           onClick={() => setShowEntryModal(true)}
                           className="btn-primary" style={{ padding: '14px 40px', fontWeight: 900 }}>
                            Registrar Entrada
                         </button>
                      </div>
                    )}
                 </div>
               </>
             ) : (
               <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', gap: '12px' }}>
                  <Zap size={40} style={{ opacity: 0.1 }} />
                  <p style={{ fontSize: '13px', fontWeight: 700 }}>Selecciona un espacio para operar</p>
               </div>
             )}
          </div>

           {/* Occupancy Snapshot */}
          <div className="glass-card" style={{ padding: '32px' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 800 }}>Ocupación Global</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="white-card" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Ocupación</span>
                  <span style={{ fontSize: '20px', fontWeight: 900 }}>{stats?.occupancyRate ?? 0}%</span>
                </div>
                <Zap size={20} color="var(--accent-gold)" style={{ opacity: 0.6 }} />
              </div>
              <div className="white-card" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Disponibles</span>
                  <span style={{ fontSize: '20px', fontWeight: 900 }}>{stats?.availableSpaces ?? 0}</span>
                </div>
                <div style={{ fontSize: '11px', fontWeight: 900, color: 'var(--text-muted)' }}>DE {stats?.totalSpaces ?? 0}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Stats and AI */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        
        {/* AI Prediction Widget */}
        <AIPredictionWidget />

        {/* Parking Overview Chart */}
        <div className="glass-card" style={{ padding: '40px' }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '40px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 800 }}>Resumen de Ocupación</h3>
           </div>
           
           <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '100px', marginBottom: '40px' }}>
              {(zoneStats.metrics.length ? zoneStats.metrics.slice(0, 12) : []).map((z) => (
                <div key={z.id} title={`${z.name}: ${z.occupancy}%`} style={{ 
                  flex: 1, height: `${Math.max(6, z.occupancy)}%`, 
                  background: z.occupancy >= 85 ? 'var(--accent-danger)' : z.occupancy >= 60 ? 'var(--accent-gold)' : 'var(--text-primary)',
                  borderRadius: '4px',
                  transition: 'height 0.6s ease-out',
                  opacity: 0.9
                }} />
              ))}
              {zoneStats.metrics.length === 0 && (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontWeight: 700 }}>
                  Sin datos de zonas
                </div>
              )}
           </div>

           <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {zoneStats.top && (
                <div className="white-card" style={{ padding: '20px', display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(233, 185, 73, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <MapPin size={20} color="var(--accent-gold)" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '15px', fontWeight: 900 }}>{zoneStats.top.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>
                      Mayor ocupación ({zoneStats.top.occupancy}%) · {zoneStats.top.occupied}/{zoneStats.top.total}
                    </div>
                  </div>
                </div>
              )}
              {zoneStats.mostAvailable && (
                <div className="white-card" style={{ padding: '20px', display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Car size={20} color="var(--text-primary)" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '15px', fontWeight: 900 }}>{zoneStats.mostAvailable.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>
                      Más disponibles ({zoneStats.mostAvailable.available}) · {zoneStats.mostAvailable.occupancy}% ocupación
                    </div>
                  </div>
                </div>
              )}
           </div>
        </div>

        {/* Real-time Counter */}
        <div className="glass-card" style={{ padding: '32px', background: 'var(--text-primary)', color: 'white' }}>
            <div style={{ fontSize: '12px', fontWeight: 800, opacity: 0.6, marginBottom: '8px', letterSpacing: '1px' }}>RECAUDO HOY</div>
            <div style={{ fontSize: '32px', fontWeight: 900, color: 'var(--accent-gold)' }}>{formatCurrency(stats?.todayRevenue || 0)}</div>
            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                     <span style={{ fontSize: '18px', fontWeight: 900 }}>{stats?.todayVehicles || 0}</span>
                     <span style={{ fontSize: '10px', opacity: 0.6, fontWeight: 700 }}>VEHÍCULOS</span>
                  </div>
               </div>
               <div style={{ padding: '8px 16px', borderRadius: '12px', background: 'rgba(255,255,255,0.1)', fontSize: '11px', fontWeight: 800 }}>
                  ESTADO: ONLINE
               </div>
            </div>
        </div>
      </div>

      {/* Entry Modal */}
      {showEntryModal && (
        <div className="modal-overlay" onClick={() => setShowEntryModal(false)}>
           <div className="modal-content-premium animate-premium" style={{ maxWidth: '440px' }} onClick={e => e.stopPropagation()}>
              <h3 style={{ fontSize: '24px', fontWeight: 900, marginBottom: '32px' }}>Nueva Entrada</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '32px' }}>
                 <div className="form-group">
                    <label className="input-label">N° Placa vehicular</label>
                    <input 
                      autoFocus
                      className="white-card" 
                      style={{ border: 'none', padding: '20px', width: '100%', fontSize: '24px', fontWeight: 900, textAlign: 'center', letterSpacing: '4px' }} 
                      placeholder="ABC-123" 
                      value={entryForm.plate} 
                      onChange={e => setEntryForm({ ...entryForm, plate: e.target.value.toUpperCase() })} 
                    />
                 </div>
                 <div className="form-group">
                    <label className="input-label">Tipo de Vehículo</label>
                    <select 
                      className="white-card" 
                      style={{ border: 'none', padding: '18px', width: '100%', fontSize: '15px', fontWeight: 800 }}
                      value={entryForm.vehicleType}
                      onChange={e => setEntryForm({ ...entryForm, vehicleType: e.target.value })}
                    >
                       <option value="CAR">Automóvil</option>
                       <option value="MOTORCYCLE">Motocicleta</option>
                       <option value="VAN">Camioneta / SUV</option>
                    </select>
                 </div>
              </div>
              <button 
                onClick={handleEntry}
                disabled={processing || !entryForm.plate}
                className="btn-primary" 
                style={{ width: '100%', height: '64px', fontSize: '16px' }}>
                 {processing ? <Loader2 size={20} className="animate-spin" /> : 'Confirmar Ingreso'}
              </button>
           </div>
        </div>
      )}

      {/* Floating AI Assistant */}
      <AIChatAssistant />
    </div>
  );
}
