'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatDate } from '@/lib/utils';
import { 
  Search, 
  Edit3, 
  Trash2, 
  Shield, 
  PlusCircle,
   MapPin
} from 'lucide-react';
import toast from 'react-hot-toast';

interface UserData {
  id: string; email: string; firstName: string; lastName: string;
  role: string; isActive: boolean; lastLoginAt?: string; createdAt: string;
   assignedLotId?: string | null;
   assignedLot?: { id: string; name: string } | null;
   parkingLot?: { id: string; name: string } | null;
}

type ParkingLotOption = { id: string; name: string };

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

function parseLots(data: unknown): ParkingLotOption[] {
   if (!Array.isArray(data)) return [];
   const out: ParkingLotOption[] = [];
   for (const item of data) {
      if (!item || typeof item !== 'object') continue;
      const rec = item as Record<string, unknown>;
      const id = rec.id;
      const name = rec.name;
      if (typeof id !== 'string' || typeof name !== 'string') continue;
      out.push({ id, name });
   }
   return out;
}

const roleBadge: Record<string, { label: string; cls: string; desc: string }> = {
  SUPER_ADMIN: { label: 'Super Admin', cls: 'badge-purple', desc: 'Control total' },
  ADMIN: { label: 'Admin', cls: 'badge-info', desc: 'Gestión de sede' },
  OPERATOR: { label: 'Operador', cls: 'badge-success', desc: 'Solo cabina' },
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
   const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [showCreate, setShowCreate] = useState(false);
   const [newUser, setNewUser] = useState({ email: '', password: '', firstName: '', lastName: '', role: 'OPERATOR', assignedLotId: '' });
   const [role, setRole] = useState<string>('OPERATOR');
   const [lots, setLots] = useState<ParkingLotOption[]>([]);
   const [selectedLotId, setSelectedLotId] = useState<string>('');

   const canManageAll = role === 'SUPER_ADMIN';
   const canManage = role === 'SUPER_ADMIN' || role === 'ADMIN';

  useEffect(() => {
      const decoded = safeDecodeJwt(localStorage.getItem('accessToken'));
      setRole(decoded.role || 'OPERATOR');
      void loadContext(decoded.role || 'OPERATOR');
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

   const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('accessToken')}` });

   const loadLots = async (): Promise<ParkingLotOption[]> => {
      const res = await fetch('/api/dashboard?resource=lots', { headers: authHeaders() });
      if (!res.ok) return [];
      const data: unknown = await res.json();
      return parseLots(data);
   };

   const fetchUsers = async (lotId?: string) => {
    try {
         const qs = lotId ? `&parkingLotId=${encodeURIComponent(lotId)}` : '';
         const res = await fetch(`/api/dashboard?resource=users${qs}`, { headers: authHeaders() });
      if (res.ok) setUsers(await res.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

   const loadContext = async (currentRole: string) => {
      setLoading(true);
      try {
         const lotsData = await loadLots();
         setLots(lotsData);

         const stored = localStorage.getItem('usersSelectedLotId');
         const fallback = lotsData[0]?.id || '';
         const next = stored && lotsData.some(l => l.id === stored) ? stored : fallback;
         const effective = currentRole === 'SUPER_ADMIN' ? next : fallback;
         setSelectedLotId(effective);
         if (effective) localStorage.setItem('usersSelectedLotId', effective);

         await fetchUsers(currentRole === 'SUPER_ADMIN' ? effective : undefined);
      } catch (err) {
         console.error(err);
         setLoading(false);
      }
   };

   const handleUpdate = async (u: UserData) => {
    try {
      const res = await fetch('/api/dashboard', {
        method: 'PUT',
            headers: { ...authHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ resource: 'users', id: u.id, data: u })
      });
      if (res.ok) {
        setEditingUser(null);
            await fetchUsers(canManageAll ? selectedLotId : undefined);
      }
    } catch (err) { console.error(err); }
  };

  const handleCreate = async () => {
    try {
      const res = await fetch('/api/dashboard', {
        method: 'POST',
            headers: { ...authHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ resource: 'users', ...newUser, assignedLotId: newUser.assignedLotId || selectedLotId || null })
      });
      if (res.ok) {
        setShowCreate(false);
            setNewUser({ email: '', password: '', firstName: '', lastName: '', role: 'OPERATOR', assignedLotId: '' });
            await fetchUsers(canManageAll ? selectedLotId : undefined);
         } else {
            const data = await res.json().catch(() => ({}));
                  toast.error((data as { error?: string }).error || 'No se pudo crear el usuario');
      }
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este usuario permanentemente?')) return;
    try {
      const res = await fetch(`/api/dashboard?resource=users&id=${id}`, {
        method: 'DELETE',
            headers: authHeaders()
      });
         if (res.ok) await fetchUsers(canManageAll ? selectedLotId : undefined);
    } catch (err) { console.error(err); }
  };

   const filtered = useMemo(() => users.filter(u => 
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    `${u.firstName} ${u.lastName}`.toLowerCase().includes(search.toLowerCase())
   ), [users, search]);

   const currentLotLabel = useMemo(() => {
      const lot = lots.find(l => l.id === selectedLotId);
      return lot?.name || '—';
   }, [lots, selectedLotId]);

  if (loading) return <div style={{ height: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner" /></div>;

  return (
    <div className="animate-premium" style={{ paddingTop: '10px' }}>
      
      {/* Role Hub */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginBottom: '32px' }}>
        {Object.entries(roleBadge).map(([role, { label, desc }]) => (
          <div key={role} className="glass-card" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--accent-gold)', textTransform: 'uppercase' }}>{label}</span>
                <Shield size={20} color="var(--text-muted)" />
             </div>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <span style={{ fontSize: '36px', fontWeight: 900 }}>{users.filter(u => u.role === role).length}</span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>{desc}</span>
             </div>
          </div>
        ))}
      </div>

      {/* Header Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
         <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>Gestión de Personal</h2>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Control de acceso y roles operativos</span>
         </div>
         <div style={{ display: 'flex', gap: '12px' }}>
                  {canManageAll && lots.length > 0 && (
                     <div className="white-card" style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <MapPin size={16} color="var(--accent-gold)" />
                        <select
                           value={selectedLotId}
                           onChange={async (e) => {
                              const next = e.target.value;
                              setSelectedLotId(next);
                              localStorage.setItem('usersSelectedLotId', next);
                              await fetchUsers(next);
                           }}
                           style={{ border: 'none', background: 'transparent', fontWeight: 800, fontSize: '13px', outline: 'none' }}
                        >
                           {lots.map(l => (
                              <option key={l.id} value={l.id}>{l.name}</option>
                           ))}
                        </select>
                     </div>
                  )}
            <div style={{ position: 'relative', width: '300px' }}>
               <input className="white-card" style={{ border: 'none', padding: '12px 16px 12px 48px', width: '100%', fontSize: '13px', fontWeight: 700 }} placeholder="Buscar por nombre o email..." value={search} onChange={e => setSearch(e.target.value)} />
               <Search size={18} style={{ position: 'absolute', left: '16px', top: '12px', color: 'var(--text-muted)' }} />
            </div>
                  <button
                     className="btn-primary"
                     style={{ padding: '0 32px', height: '48px', opacity: canManage ? 1 : 0.6, cursor: canManage ? 'pointer' : 'not-allowed' }}
                     onClick={() => canManage && setShowCreate(true)}
                     disabled={!canManage}
                  >
               <PlusCircle size={18} /> Agregar Usuario
            </button>
         </div>
      </div>

      {/* Users Table */}
      <div className="glass-card" style={{ padding: '40px' }}>
         {(canManageAll || role === 'ADMIN') && (
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
             <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-muted)' }}>
               Contexto sede: <span style={{ color: 'var(--text-primary)', fontWeight: 900 }}>{currentLotLabel}</span>
             </div>
           </div>
         )}
         <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%' }}>
               <thead>
                  <tr>
                     <th style={{ paddingBottom: '24px' }}>Usuario</th>
                     <th>Email Corportativo</th>
                     <th>Rol / Permisos</th>
                     <th>Sede</th>
                     <th>Última Actividad</th>
                     <th>Estado</th>
                     <th style={{ textAlign: 'right' }}>Acciones</th>
                  </tr>
               </thead>
               <tbody>
                  {filtered.map(u => (
                    <tr key={u.id}>
                       <td style={{ paddingTop: '24px', paddingBottom: '24px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                             <div className="white-card" style={{ width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 900 }}>
                                {u.firstName[0]}
                             </div>
                             <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '15px', fontWeight: 900 }}>{u.firstName} {u.lastName}</span>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>ID: {u.id.substring(0,8).toUpperCase()}</span>
                             </div>
                          </div>
                       </td>
                       <td style={{ fontSize: '14px', fontWeight: 700 }}>{u.email}</td>
                       <td>
                          <span className="badge badge-info" style={{ padding: '8px 16px', borderRadius: '12px', fontSize: '11px', fontWeight: 800 }}>
                             {roleBadge[u.role]?.label || u.role}
                          </span>
                       </td>
                       <td style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-muted)' }}>
                         {u.parkingLot?.name || u.assignedLot?.name || '—'}
                       </td>
                       <td style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
                          {u.lastLoginAt ? formatDate(u.lastLoginAt) : 'Sin accesos'}
                       </td>
                       <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                             <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: u.isActive ? 'var(--accent-success)' : 'var(--accent-danger)' }} />
                             <span style={{ fontSize: '13px', fontWeight: 800 }}>{u.isActive ? 'Activo' : 'Baja'}</span>
                          </div>
                       </td>
                       <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                           <button
                                              onClick={() => canManage && setEditingUser(u)}
                                              className="white-card"
                                              style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: canManage ? 'pointer' : 'not-allowed', opacity: canManage ? 1 : 0.6 }}
                                              disabled={!canManage}
                                           >
                                              <Edit3 size={16} />
                                           </button>
                                           {canManageAll && (
                                              <button
                                                 onClick={() => handleDelete(u.id)}
                                                 className="white-card"
                                                 style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', color: 'var(--accent-danger)' }}
                                              >
                                                 <Trash2 size={16} />
                                              </button>
                                           )}
                          </div>
                       </td>
                    </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
           <div className="modal-content-premium animate-premium" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
              <h3 style={{ fontSize: '24px', fontWeight: 900, marginBottom: '32px' }}>Crear Nuevo Usuario</h3>
              <div className="form-grid" style={{ marginBottom: '32px' }}>
                 <div className="form-group">
                    <label className="input-label">Nombre</label>
                    <input className="white-card" style={{ border: 'none', padding: '16px', width: '100%', fontSize: '14px', fontWeight: 700 }} value={newUser.firstName} onChange={e => setNewUser({ ...newUser, firstName: e.target.value })} />
                 </div>
                 <div className="form-group">
                    <label className="input-label">Apellido</label>
                    <input className="white-card" style={{ border: 'none', padding: '16px', width: '100%', fontSize: '14px', fontWeight: 700 }} value={newUser.lastName} onChange={e => setNewUser({ ...newUser, lastName: e.target.value })} />
                 </div>
                 <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="input-label">Email Corporativo</label>
                    <input className="white-card" style={{ border: 'none', padding: '16px', width: '100%', fontSize: '14px', fontWeight: 700 }} value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} />
                 </div>
                 <div className="form-group">
                    <label className="input-label">Contraseña</label>
                    <input className="white-card" type="password" style={{ border: 'none', padding: '16px', width: '100%', fontSize: '14px', fontWeight: 700 }} value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} />
                 </div>
                 <div className="form-group">
                    <label className="input-label">Rol</label>
                    <select className="white-card" style={{ border: 'none', padding: '16px', width: '100%', fontSize: '14px', fontWeight: 800 }} value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}>
                       <option value="OPERATOR">Operador</option>
                                  {canManageAll && <option value="ADMIN">Administrador</option>}
                    </select>
                 </div>
                         {canManageAll && (
                            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                               <label className="input-label">Sede</label>
                               <select className="white-card" style={{ border: 'none', padding: '16px', width: '100%', fontSize: '14px', fontWeight: 800 }} value={newUser.assignedLotId} onChange={e => setNewUser({ ...newUser, assignedLotId: e.target.value })}>
                                  <option value="">(Usar sede del contexto)</option>
                                  {lots.map(l => (
                                     <option key={l.id} value={l.id}>{l.name}</option>
                                  ))}
                               </select>
                            </div>
                         )}
              </div>
              <button className="btn-primary" style={{ width: '100%', height: '60px' }} onClick={handleCreate}>Generar Acceso</button>
           </div>
        </div>
      )}

         {/* Edit Modal */}
         {editingUser && (
            <div className="modal-overlay" onClick={() => setEditingUser(null)}>
               <div className="modal-content-premium animate-premium" style={{ maxWidth: '560px' }} onClick={e => e.stopPropagation()}>
                  <h3 style={{ fontSize: '24px', fontWeight: 900, marginBottom: '8px' }}>Editar Usuario</h3>
                  <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '20px' }}>{editingUser.email}</p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                     <div>
                        <label className="input-label">Nombre</label>
                        <input className="input-field" value={editingUser.firstName} onChange={e => setEditingUser({ ...editingUser, firstName: e.target.value })} />
                     </div>
                     <div>
                        <label className="input-label">Apellido</label>
                        <input className="input-field" value={editingUser.lastName} onChange={e => setEditingUser({ ...editingUser, lastName: e.target.value })} />
                     </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                     <div>
                        <label className="input-label">Rol</label>
                        <select
                           className="input-field"
                           value={editingUser.role}
                           onChange={e => setEditingUser({ ...editingUser, role: e.target.value })}
                           disabled={!canManageAll}
                           style={{ opacity: canManageAll ? 1 : 0.6 }}
                        >
                           <option value="OPERATOR">Operador</option>
                           <option value="ADMIN">Administrador</option>
                        </select>
                     </div>
                     <div className="white-card" style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '13px', fontWeight: 800 }}>Activo</span>
                        <input type="checkbox" checked={Boolean(editingUser.isActive)} onChange={e => setEditingUser({ ...editingUser, isActive: e.target.checked })} />
                     </div>
                  </div>

                  {canManageAll && (
                     <div style={{ marginBottom: '18px' }}>
                        <label className="input-label">Sede</label>
                        <select
                           className="input-field"
                           value={editingUser.role === 'OPERATOR' ? (editingUser.assignedLotId || '') : (editingUser.parkingLot?.id || '')}
                           onChange={e => {
                              const value = e.target.value;
                              if (editingUser.role === 'OPERATOR') {
                                 setEditingUser({ ...editingUser, assignedLotId: value || null });
                              } else {
                                 // For ADMIN we reuse assignedLotId as input to backend (it will set adminId)
                                 setEditingUser({ ...editingUser, assignedLotId: value || null });
                              }
                           }}
                        >
                           <option value="">—</option>
                           {lots.map(l => (
                              <option key={l.id} value={l.id}>{l.name}</option>
                           ))}
                        </select>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginTop: '8px' }}>
                           {editingUser.role === 'ADMIN'
                              ? 'Al guardar, el usuario quedará como Admin de la sede seleccionada.'
                              : 'Operadores trabajan en la sede asignada.'}
                        </div>
                     </div>
                  )}

                  <button
                     className="btn-primary"
                     style={{ width: '100%', height: '60px' }}
                     onClick={() => handleUpdate(editingUser)}
                  >
                     Guardar Cambios
                  </button>
               </div>
            </div>
         )}
    </div>
  );
}
