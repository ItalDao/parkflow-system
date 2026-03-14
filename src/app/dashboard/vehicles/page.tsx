'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getVehicleTypeIcon, getVehicleTypeLabel } from '@/lib/utils';
import { Search, Ban, Ticket, CalendarDays, Loader2, Settings, Trash2 } from 'lucide-react';

interface Vehicle {
  id: string; plate: string; type: string; brand?: string; model?: string; color?: string;
  isBlacklisted: boolean; blacklistReason?: string; createdAt: string; _count: { tickets: number };
}

function getAuthHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem('accessToken')}`, 'Content-Type': 'application/json' };
}

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) setUser(JSON.parse(userData));
    fetchData();
  }, [router]);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/dashboard?resource=vehicles', { headers: getAuthHeaders() });
      if (res.status === 401) {
        localStorage.removeItem('accessToken');
        router.push('/');
        return;
      }
      if (res.ok) setVehicles(await res.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

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
        const data = await res.json();
        alert(data.error);
      }
    } catch (err) { alert('Error de red'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este vehículo? Se borrará permanentemente.')) return;
    try {
      const res = await fetch(`/api/dashboard?resource=vehicles&id=${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) fetchData();
      else alert('No autorizado o error al eliminar');
    } catch (err) { alert('Error de red'); }
  };

  const filtered = vehicles.filter(v =>
    v.plate.toLowerCase().includes(search.toLowerCase()) ||
    (v.brand || '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}><Loader2 className="animate-spin" size={40} color="var(--accent-primary)" /></div>;

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', gap: '16px', marginBottom: '32px', position: 'relative', alignItems: 'center' }}>
        <div style={{ position: 'relative', maxWidth: '460px', flex: 1 }}>
          <div style={{ position: 'absolute', left: '16px', top: '14px', color: 'var(--text-secondary)' }}><Search size={20} /></div>
          <input className="input-field" placeholder="Buscar por placa o marca..." value={search}
            onChange={e => setSearch(e.target.value)} style={{ paddingLeft: '48px', height: '48px', fontSize: '15px' }} />
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-secondary)' }}>{filtered.length} vehículos registrados</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
        {filtered.map(v => (
          <div key={v.id} className="glass-card animate-premium" style={{ 
            padding: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
            position: 'relative', overflow: 'hidden'
          }}>
            <div style={{ 
              position: 'absolute', top: '16px', right: '16px', display: 'flex', gap: '8px' 
            }}>
              {(user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') && (
                <button 
                  onClick={() => setEditingVehicle(v)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '8px' }}
                  title="Editar"
                >
                  <Settings size={18} />
                </button>
              )}
            </div>

            <div style={{ 
              width: '80px', height: '80px', borderRadius: '30px', background: 'var(--bg-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px',
              color: 'var(--accent-primary)'
            }}>{getVehicleTypeIcon(v.type, 36)}</div>

            <div style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '2px', marginBottom: '8px' }}>{v.plate}</div>
            <div style={{ fontSize: '15px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '24px' }}>
              {v.brand || 'Genérico'} · {v.color || 'Estandar'}
            </div>
            
            <div style={{ display: 'flex', gap: '12px', marginTop: 'auto', width: '100%', justifyContent: 'center' }}>
               <div style={{ 
                 padding: '10px 18px', borderRadius: '16px', background: 'var(--bg-primary)', 
                 fontSize: '13px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' 
               }}>
                 <Ticket size={16} /> {v._count.tickets} <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Usos</span>
               </div>
               {v.isBlacklisted && (
                 <div style={{ 
                   padding: '10px 18px', borderRadius: '16px', background: 'rgba(239, 68, 68, 0.1)', 
                   color: '#ef4444', fontSize: '13px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' 
                 }}>
                   <Ban size={16} /> Blacklist
                 </div>
               )}
            </div>
          </div>
        ))}
      </div>

      {/* Edit Modal */}
      {editingVehicle && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', 
          backdropFilter: 'blur(10px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div className="glass-card animate-premium" style={{ width: '100%', maxWidth: '500px', background: 'white', padding: '40px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 900, marginBottom: '32px' }}>Gestionar Vehículo</h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>MARCA</label>
                  <input className="input-field" value={editingVehicle.brand || ''} 
                    onChange={e => setEditingVehicle({...editingVehicle, brand: e.target.value})} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>COLOR</label>
                  <input className="input-field" value={editingVehicle.color || ''} 
                    onChange={e => setEditingVehicle({...editingVehicle, color: e.target.value})} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>ESTADO DE LISTA NEGRA</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg-primary)', padding: '12px 20px', borderRadius: '16px' }}>
                   <input type="checkbox" checked={editingVehicle.isBlacklisted} 
                    onChange={e => setEditingVehicle({...editingVehicle, isBlacklisted: e.target.checked})} 
                    style={{ width: '20px', height: '20px' }} />
                   <span style={{ fontSize: '14px', fontWeight: 600 }}>Bloquear entrada a este vehículo</span>
                </div>
              </div>

              {editingVehicle.isBlacklisted && (
                <div className="animate-premium">
                  <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>RAZÓN DEL BLOQUEO</label>
                  <textarea className="input-field" style={{ height: '80px', paddingTop: '12px' }} value={editingVehicle.blacklistReason || ''}
                    onChange={e => setEditingVehicle({...editingVehicle, blacklistReason: e.target.value})} />
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <button className="btn-primary" style={{ flex: 1, height: '54px', borderRadius: '18px' }}
                  onClick={() => handleUpdate(editingVehicle)}>Guardar Cambios</button>
                <button className="btn-secondary" style={{ flex: 1, height: '54px', borderRadius: '18px' }}
                  onClick={() => setEditingVehicle(null)}>Cancelar</button>
              </div>

              {user?.role === 'SUPER_ADMIN' && (
                <button style={{ color: '#ef4444', fontSize: '13px', fontWeight: 700, border: 'none', background: 'none', cursor: 'pointer', marginTop: '10px' }}
                  onClick={() => handleDelete(editingVehicle.id)}>Eliminar definitivamente del sistema</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
