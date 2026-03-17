'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { getVehicleTypeIcon } from '@/lib/utils';
import { 
  Search, 
  Ban, 
  Ticket, 
  Settings, 
  Trash2, 
  Car, 
  History, 
  AlertTriangle,
   PlusCircle,
   X
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Vehicle {
  id: string; plate: string; type: string; brand?: string; model?: string; color?: string;
  isBlacklisted: boolean; blacklistReason?: string; createdAt: string; 
  _count: { tickets: number };
}

type JwtPayload = { role?: string; userId?: string };

function safeDecodeJwt(token: string | null): JwtPayload {
   try {
      if (!token) return {};
      const part = token.split('.')[1];
      if (!part) return {};
      let normalized = part.replace(/-/g, '+').replace(/_/g, '/');
      const pad = normalized.length % 4;
      if (pad) normalized += '='.repeat(4 - pad);
      const decoded = atob(normalized);
      return JSON.parse(decoded);
   } catch {
      return {};
   }
}

function getAuthHeaders() {
   return { Authorization: `Bearer ${localStorage.getItem('accessToken')}`, 'Content-Type': 'application/json' };
}

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
   const [role, setRole] = useState<string>('OPERATOR');

   const [showCreate, setShowCreate] = useState(false);
   const [creating, setCreating] = useState(false);
   const [newVehicle, setNewVehicle] = useState({ plate: '', type: 'CAR', brand: '', model: '', color: '', isBlacklisted: false, blacklistReason: '' });
   const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
   const deleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard?resource=vehicles', { 
            headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` } 
      });
         if (res.ok) {
            setVehicles(await res.json());
         } else {
            const data = await res.json().catch(() => ({}));
            toast.error((data as { error?: string }).error || 'No se pudieron cargar los vehículos');
            setVehicles([]);
         }
      } catch (err) {
         console.error(err);
         toast.error('Error de conexión');
      }
    finally { setLoading(false); }
  }, []);

   useEffect(() => () => {
      if (deleteTimer.current) clearTimeout(deleteTimer.current);
   }, []);

  useEffect(() => {
      const decoded = safeDecodeJwt(localStorage.getItem('accessToken'));
      setRole(decoded.role || 'OPERATOR');
      void fetchData();
  }, [fetchData]);

  const handleUpdate = async (v: Vehicle) => {
    try {
      const res = await fetch('/api/dashboard', {
        method: 'PUT',
            headers: getAuthHeaders(),
        body: JSON.stringify({ resource: 'vehicles', id: v.id, data: v })
      });
      if (res.ok) {
        setEditingVehicle(null);
        fetchData();
         } else {
            const data = await res.json().catch(() => ({}));
            toast.error((data as { error?: string }).error || 'No se pudo actualizar el vehículo');
      }
      } catch (err) {
         console.error(err);
         toast.error('Error de conexión');
      }
  };

   const handleCreate = async () => {
      const plate = newVehicle.plate.trim().toUpperCase();
      if (!plate) return;
      setCreating(true);
      try {
         const res = await fetch('/api/dashboard', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
               resource: 'vehicles',
               data: {
                  plate,
                  type: newVehicle.type,
                  brand: newVehicle.brand || undefined,
                  model: newVehicle.model || undefined,
                  color: newVehicle.color || undefined,
                  isBlacklisted: newVehicle.isBlacklisted,
                  blacklistReason: newVehicle.isBlacklisted ? newVehicle.blacklistReason : undefined,
               },
            }),
         });

         if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            toast.error((data as { error?: string }).error || 'No se pudo crear el vehículo');
            return;
         }

         setShowCreate(false);
         setNewVehicle({ plate: '', type: 'CAR', brand: '', model: '', color: '', isBlacklisted: false, blacklistReason: '' });
         await fetchData();
      } catch (err) {
         console.error(err);
         toast.error('Error de conexión');
      } finally {
         setCreating(false);
      }
   };

   const handleDelete = async (id: string) => {
      if (pendingDeleteId !== id) {
         setPendingDeleteId(id);
         toast('Vuelve a hacer click para confirmar');
         if (deleteTimer.current) clearTimeout(deleteTimer.current);
         deleteTimer.current = setTimeout(() => setPendingDeleteId(null), 4000);
         return;
      }
      setPendingDeleteId(null);
      if (deleteTimer.current) clearTimeout(deleteTimer.current);
      try {
         const res = await fetch(`/api/dashboard?resource=vehicles&id=${encodeURIComponent(id)}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
         });
         if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            toast.error((data as { error?: string }).error || 'No se pudo eliminar');
            return;
         }
         await fetchData();
      } catch (err) {
         console.error(err);
         toast.error('No se pudo eliminar');
      }
   };

   const filtered = useMemo(() => {
      const q = search.trim().toLowerCase();
      if (!q) return vehicles;
      return vehicles.filter(v =>
         v.plate.toLowerCase().includes(q) ||
         (v.brand || '').toLowerCase().includes(q)
      );
   }, [vehicles, search]);

   const canManage = role === 'SUPER_ADMIN' || role === 'ADMIN';
   const canDelete = role === 'SUPER_ADMIN';

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
            {canManage && (
              <button className="btn-primary" style={{ padding: '0 18px', height: '44px', display: 'flex', alignItems: 'center', gap: '10px' }} onClick={() => setShowCreate(true)}>
                <PlusCircle size={18} /> Nuevo
              </button>
            )}
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
                              {canManage && (
                                 <button onClick={() => setEditingVehicle(v)} className="white-card" style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}><Settings size={16} /></button>
                              )}
                              {canDelete && (
                                 <button onClick={() => void handleDelete(v.id)} className="white-card" style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', color: '#ef4444' }}>
                                    <Trash2 size={16} />
                                 </button>
                              )}
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

         {/* Create Vehicle Modal */}
         {showCreate && (
            <div className="modal-overlay" onClick={() => !creating && setShowCreate(false)}>
               <div className="modal-content-premium animate-premium" style={{ maxWidth: '560px' }} onClick={e => e.stopPropagation()}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                     <h3 style={{ fontSize: '24px', fontWeight: 900 }}>Nuevo Vehículo</h3>
                     <button className="white-card" style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none' }} onClick={() => setShowCreate(false)}>
                        <X size={18} />
                     </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                     <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                        <label className="input-label">Placa</label>
                        <input
                           className="white-card"
                           style={{ border: 'none', padding: '16px', width: '100%', fontSize: '18px', fontWeight: 900, textAlign: 'center', letterSpacing: '3px' }}
                           value={newVehicle.plate}
                           onChange={(e) => setNewVehicle({ ...newVehicle, plate: e.target.value.toUpperCase() })}
                           placeholder="ABC123"
                        />
                     </div>
                     <div className="form-group">
                        <label className="input-label">Tipo</label>
                        <select className="white-card" style={{ border: 'none', padding: '16px', width: '100%', fontSize: '14px', fontWeight: 800 }} value={newVehicle.type} onChange={(e) => setNewVehicle({ ...newVehicle, type: e.target.value })}>
                           <option value="CAR">Automóvil</option>
                           <option value="MOTORCYCLE">Motocicleta</option>
                           <option value="VAN">Camioneta</option>
                        </select>
                     </div>
                     <div className="form-group">
                        <label className="input-label">Marca</label>
                        <input className="white-card" style={{ border: 'none', padding: '16px', width: '100%', fontSize: '14px', fontWeight: 700 }} value={newVehicle.brand} onChange={(e) => setNewVehicle({ ...newVehicle, brand: e.target.value })} />
                     </div>
                     <div className="form-group">
                        <label className="input-label">Modelo</label>
                        <input className="white-card" style={{ border: 'none', padding: '16px', width: '100%', fontSize: '14px', fontWeight: 700 }} value={newVehicle.model} onChange={(e) => setNewVehicle({ ...newVehicle, model: e.target.value })} />
                     </div>
                     <div className="form-group">
                        <label className="input-label">Color</label>
                        <input className="white-card" style={{ border: 'none', padding: '16px', width: '100%', fontSize: '14px', fontWeight: 700 }} value={newVehicle.color} onChange={(e) => setNewVehicle({ ...newVehicle, color: e.target.value })} />
                     </div>
                  </div>

                  <div className="white-card" style={{ padding: '20px', marginBottom: '24px', border: newVehicle.isBlacklisted ? '2px solid #ef4444' : '2px solid transparent' }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                           <Ban size={20} color={newVehicle.isBlacklisted ? '#ef4444' : 'var(--text-muted)'} />
                           <span style={{ fontSize: '14px', fontWeight: 800 }}>Blacklist</span>
                        </div>
                        <input type="checkbox" checked={newVehicle.isBlacklisted} onChange={e => setNewVehicle({ ...newVehicle, isBlacklisted: e.target.checked })} style={{ width: '20px', height: '20px' }} />
                     </div>
                     {newVehicle.isBlacklisted && (
                        <textarea
                           className="white-card"
                           style={{ border: 'none', background: 'var(--bg-primary)', padding: '16px', width: '100%', fontSize: '13px', fontWeight: 700, height: '80px', marginTop: '16px' }}
                           placeholder="Razón del bloqueo..."
                           value={newVehicle.blacklistReason}
                           onChange={e => setNewVehicle({ ...newVehicle, blacklistReason: e.target.value })}
                        />
                     )}
                  </div>

                  <button className="btn-primary" style={{ width: '100%', height: '60px' }} onClick={() => void handleCreate()} disabled={creating || !newVehicle.plate.trim()}>
                     {creating ? 'Creando…' : 'Crear Vehículo'}
                  </button>
               </div>
            </div>
         )}
    </div>
  );
}

