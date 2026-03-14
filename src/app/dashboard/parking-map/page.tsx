'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  CheckCircle2, 
  Car as CarIcon, 
  Map as MapIcon, 
  Shield, 
  Zap, 
  Home, 
  Sun, 
  Star, 
  Bike, 
  Info, 
  Wrench, 
  Lock,
  MoreHorizontal,
  RotateCcw,
  Search
} from 'lucide-react';
import { getVehicleTypeIcon } from '@/lib/utils';

interface Space {
  id: string; number: string; status: string; floor: number;
  tickets: Array<{ vehicle: { plate: string; type: string; brand?: string; color?: string } }>;
}

interface Zone {
  id: string; name: string; type: string; spaces: Space[];
}

export default function ParkingMapPage() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [activeZoneId, setActiveZoneId] = useState<string>('');
  const [selectedSpace, setSelectedSpace] = useState<Space | null>(null);
  const [loading, setLoading] = useState(true);

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
               <button className="white-card" style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}><MoreHorizontal size={18} /></button>
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

                <button className="btn-primary" style={{ height: '56px', borderRadius: '16px' }}>
                   Registrar Operación
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
    </div>
  );
}
