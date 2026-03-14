'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getVehicleTypeIcon, formatCurrency } from '@/lib/utils';
import { 
  Search, 
  Ban, 
  Ticket, 
  Loader2, 
  Settings, 
  Trash2, 
  Car, 
  History, 
  AlertTriangle,
  ChevronRight
} from 'lucide-react';

interface Vehicle {
  id: string; plate: string; type: string; brand?: string; model?: string; color?: string;
  isBlacklisted: boolean; blacklistReason?: string; createdAt: string; 
  _count: { tickets: number };
}

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard?resource=vehicles', { 
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` } 
      });
      if (res.ok) setVehicles(await res.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) setUser(JSON.parse(userData));
    fetchData();
  }, [fetchData]);

  const handleUpdate = async (v: Vehicle) => {
    try {
      const res = await fetch('/api/dashboard', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ resource: 'vehicles', id: v.id, data: v })
      });
      if (res.ok) {
        setEditingVehicle(null);
        fetchData();
      }
    } catch (err) { console.error(err); }
  };

  const filtered = vehicles.filter(v =>
    v.plate.toLowerCase().includes(search.toLowerCase()) ||
    (v.brand || '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div style={{ height: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner" /></div>;

  return (
    <div className="animate-premium" style={{ paddingTop: '10px' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
         <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-primary)' }}>Registro Vehicular</h2>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Historial, control de acceso y gestión de flota interna</span>
         </div>
         <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ position: 'relative', width: '320px' }}>
               <input className="white-card" style={{ border: 'none', padding: '12px 16px 12px 48px', width: '100%', fontSize: '13px', fontWeight: 700 }} placeholder="Buscar por placa o marca..." value={search} onChange={e => setSearch(e.target.value)} />
               <Search size={18} style={{ position: 'absolute', left: '16px', top: '12px', color: 'var(--text-muted)' }} />
            </div>
         </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '24px' }}>
         {filtered.map(v => (
           <div key={v.id} className="glass-card hover-premium" style={{ padding: '32px', position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                 <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-gold)' }}>
                    {getVehicleTypeIcon(v.type, 28)}
                 </div>
                 <div style={{ display: 'flex', gap: '8px' }}>
                    {v.isBlacklisted && <div style={{ padding: '6px 12px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '10px', fontSize: '10px', fontWeight: 900 }}>BLACKLIST</div>}
                    <button onClick={() => setEditingVehicle(v)} className="white-card" style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}><Settings size={16} /></button>
                 </div>
              </div>

              <div style={{ marginBottom: '24px' }}>
                 <div style={{ fontSize: '32px', fontWeight: 900, letterSpacing: '2px', color: 'var(--text-primary)' }}>{v.plate}</div>
                 <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)' }}>{v.brand || 'Marca no registrada'} · {v.color || 'Color no definido'}</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '24px' }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <History size={18} color="var(--text-muted)" />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                       <span style={{ fontSize: '15px', fontWeight: 900 }}>{v._count.tickets}</span>
                       <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)' }}>VISITAS</span>
                    </div>
                 </div>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Ticket size={18} color="var(--text-muted)" />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                       <span style={{ fontSize: '15px', fontWeight: 900 }}>Activo</span>
                       <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)' }}>ESTADO</span>
                    </div>
                 </div>
              </div>
           </div>
         ))}
      </div>

      {/* Edit Vehicle Modal */}
      {editingVehicle && (
        <div className="modal-overlay" onClick={() => setEditingVehicle(null)}>
           <div className="modal-content-premium animate-premium" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
              <h3 style={{ fontSize: '24px', fontWeight: 900, marginBottom: '32px' }}>Gestionar Vehículo</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '32px' }}>
                 <div className="form-group">
                    <label className="input-label">Marca</label>
                    <input className="white-card" style={{ border: 'none', padding: '16px', width: '100%', fontSize: '14px', fontWeight: 700 }} value={editingVehicle.brand || ''} onChange={e => setEditingVehicle({...editingVehicle, brand: e.target.value})} />
                 </div>
                 <div className="form-group">
                    <label className="input-label">Color</label>
                    <input className="white-card" style={{ border: 'none', padding: '16px', width: '100%', fontSize: '14px', fontWeight: 700 }} value={editingVehicle.color || ''} onChange={e => setEditingVehicle({...editingVehicle, color: e.target.value})} />
                 </div>
              </div>

              <div className="white-card" style={{ padding: '24px', marginBottom: '32px', border: editingVehicle.isBlacklisted ? '2px solid #ef4444' : '2px solid transparent' }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: editingVehicle.isBlacklisted ? '16px' : '0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                       <Ban size={20} color={editingVehicle.isBlacklisted ? '#ef4444' : 'var(--text-muted)'} />
                       <span style={{ fontSize: '14px', fontWeight: 800 }}>Lista Negra (Blacklist)</span>
                    </div>
                    <input type="checkbox" checked={editingVehicle.isBlacklisted} onChange={e => setEditingVehicle({...editingVehicle, isBlacklisted: e.target.checked})} style={{ width: '20px', height: '20px' }} />
                 </div>
                 {editingVehicle.isBlacklisted && (
                   <textarea 
                     className="white-card" 
                     style={{ border: 'none', background: 'var(--bg-primary)', padding: '16px', width: '100%', fontSize: '13px', fontWeight: 700, height: '80px', marginTop: '16px' }} 
                     placeholder="Razón del bloqueo..." 
                     value={editingVehicle.blacklistReason || ''}
                     onChange={e => setEditingVehicle({...editingVehicle, blacklistReason: e.target.value})}
                   />
                 )}
              </div>

              <button 
                onClick={() => handleUpdate(editingVehicle)}
                className="btn-primary" 
                style={{ width: '100%', height: '60px' }}>
                 Guardar Cambios
              </button>
           </div>
        </div>
      )}
    </div>
  );
}
