'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  PlusCircle, 
  Settings, 
  Trash2, 
  Edit, 
  Layers, 
  ParkingCircle, 
  Tag, 
  MoreHorizontal,
  FolderOpen,
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export default function ManagementPage() {
  const [activeTab, setActiveTab] = useState<'zones' | 'rates' | 'lots'>('zones');
  const [zones, setZones] = useState<any[]>([]);
  const [rates, setRates] = useState<any[]>([]);
  const [lots, setLots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem('accessToken')}` };
      const [zRes, rRes, lRes] = await Promise.all([
        fetch('/api/dashboard?resource=zones', { headers }),
        fetch('/api/dashboard?resource=rates', { headers }),
        fetch('/api/dashboard?resource=lots', { headers })
      ]);
      
      if (zRes.ok) setZones(await zRes.json());
      if (rRes.ok) setRates(await rRes.json());
      if (lRes.ok) setLots(await lRes.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <div style={{ height: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner" /></div>;

  return (
    <div className="animate-premium">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
           <h2 style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>Gestión de Infraestructura</h2>
           <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Configuración de sedes, zonas y esquemas tarifarios</span>
        </div>
        <button className="btn-primary" style={{ padding: '0 32px', height: '48px' }}>
           <PlusCircle size={18} /> Nuevo Regsitro
        </button>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '32px' }}>
         {[
           { id: 'lots', label: 'Sedes', icon: <MapPin size={18} /> },
           { id: 'zones', label: 'Zonas', icon: <Layers size={18} /> },
           { id: 'rates', label: 'Tarifas', icon: <Tag size={18} /> }
         ].map(tab => (
           <button 
             key={tab.id}
             onClick={() => setActiveTab(tab.id as any)}
             style={{ 
               padding: '12px 24px', borderRadius: 'var(--radius-pill)', border: 'none',
               fontSize: '14px', fontWeight: 800, cursor: 'pointer', transition: 'all 0.3s ease',
               display: 'flex', alignItems: 'center', gap: '10px',
               background: activeTab === tab.id ? 'var(--accent-gold)' : 'white',
               color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-muted)',
               boxShadow: activeTab === tab.id ? '0 8px 24px rgba(233, 185, 73, 0.3)' : 'none'
             }}
           >
             {tab.icon} {tab.label}
           </button>
         ))}
      </div>

      <div className="glass-card" style={{ padding: '40px' }}>
         {activeTab === 'zones' && (
           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
             {zones.map(zone => (
               <div key={zone.id} className="white-card" style={{ padding: '32px', position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                     <div style={{ padding: '12px', borderRadius: '16px', background: 'var(--bg-primary)' }}>
                        <ParkingCircle size={24} color="var(--accent-gold)" />
                     </div>
                     <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><MoreHorizontal size={20} /></button>
                  </div>
                  <h4 style={{ fontSize: '18px', fontWeight: 900, marginBottom: '8px' }}>{zone.name}</h4>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '24px' }}>{zone.type} · Piso {zone._count?.spaces > 0 ? 'Múltiple' : '1'}</p>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                     <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '20px', fontWeight: 900 }}>{zone._count?.spaces || 0}</span>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Espacios</span>
                     </div>
                     <div style={{ width: '1px', height: '32px', background: 'var(--border-color)' }} />
                     <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '20px', fontWeight: 900 }}>{zone.type === 'VIP' ? 'Si' : 'No'}</span>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Acceso VIP</span>
                     </div>
                  </div>
               </div>
             ))}
           </div>
         )}

         {activeTab === 'rates' && (
           <div style={{ overflowX: 'auto' }}>
             <table className="data-table" style={{ width: '100%' }}>
               <thead>
                 <tr>
                    <th style={{ paddingBottom: '24px' }}>Nombre Tarifa</th>
                    <th>Tipo Vehículo</th>
                    <th>Modalidad</th>
                    <th>Precio</th>
                    <th>Estado</th>
                    <th style={{ textAlign: 'right' }}>Acciones</th>
                 </tr>
               </thead>
               <tbody>
                 {rates.map(rate => (
                   <tr key={rate.id}>
                     <td style={{ paddingTop: '24px', paddingBottom: '24px' }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <Tag size={18} color="var(--accent-gold)" />
                          <span style={{ fontWeight: 900 }}>{rate.name}</span>
                       </div>
                     </td>
                     <td style={{ fontWeight: 700 }}>{rate.vehicleType}</td>
                     <td style={{ fontWeight: 700 }}>{rate.modality}</td>
                     <td style={{ fontSize: '16px', fontWeight: 900 }}>{formatCurrency(rate.price)}</td>
                     <td>
                        <span className={`badge ${rate.isActive ? 'badge-success' : 'badge-danger'}`} style={{ padding: '8px 16px', borderRadius: '12px', fontSize: '11px', fontWeight: 800 }}>
                           {rate.isActive ? 'Activa' : 'Inactiva'}
                        </span>
                     </td>
                     <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                           <button className="white-card" style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}><Edit size={16} /></button>
                           <button className="white-card" style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', color: 'var(--accent-danger)' }}><Trash2 size={16} /></button>
                        </div>
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
         )}

         {activeTab === 'lots' && (
           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '32px' }}>
             {lots.map(lot => (
               <div key={lot.id} className="white-card glow" style={{ padding: '40px', background: 'white' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '32px' }}>
                     <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <h3 style={{ fontSize: '24px', fontWeight: 900 }}>{lot.name}</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
                           <MapPin size={16} />
                           <span style={{ fontSize: '13px', fontWeight: 700 }}>{lot.address}, {lot.city}</span>
                        </div>
                     </div>
                     <div className={`status-dot ${lot.isActive ? 'online' : 'offline'}`} />
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '32px' }}>
                     <div style={{ padding: '20px', borderRadius: '20px', background: 'var(--bg-primary)', display: 'flex', gap: '16px', alignItems: 'center' }}>
                        <ParkingCircle size={24} color="var(--accent-gold)" />
                        <div>
                           <div style={{ fontSize: '20px', fontWeight: 900 }}>{lot.totalSpaces}</div>
                           <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)' }}>CAPACIDAD TOTAL</div>
                        </div>
                     </div>
                     <div style={{ padding: '20px', borderRadius: '20px', background: 'var(--bg-primary)', display: 'flex', gap: '16px', alignItems: 'center' }}>
                        <Clock size={24} color="var(--accent-gold)" />
                        <div>
                           <div style={{ fontSize: '20px', fontWeight: 900 }}>{lot.is24Hours ? '24h' : lot.openTime}</div>
                           <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)' }}>HORARIO APERTURA</div>
                        </div>
                     </div>
                  </div>

                  <button className="btn-primary" style={{ width: '100%', height: '56px', borderRadius: '16px', background: 'var(--text-primary)', color: 'white' }}>
                    Configurar Sede
                  </button>
               </div>
             ))}
           </div>
         )}
      </div>
    </div>
  );
}
