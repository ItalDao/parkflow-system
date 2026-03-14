'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { formatDate } from '@/lib/utils';
import { 
  UserPlus, 
  Search, 
  Edit3, 
  Trash2, 
  ShieldCheck, 
  Loader2, 
  Mail, 
  Clock, 
  Shield, 
  Filter,
  MoreHorizontal,
  PlusCircle,
  RotateCcw
} from 'lucide-react';

interface UserData {
  id: string; email: string; firstName: string; lastName: string;
  role: string; isActive: boolean; lastLoginAt?: string; createdAt: string;
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
  const [newUser, setNewUser] = useState({ email: '', password: '', firstName: '', lastName: '', role: 'OPERATOR' });
  const [currentUser, setCurrentUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const ud = localStorage.getItem('user');
    if (ud) setCurrentUser(JSON.parse(ud));
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/dashboard?resource=users', { 
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` } 
      });
      if (res.ok) setUsers(await res.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleUpdate = async (u: UserData) => {
    try {
      const res = await fetch('/api/dashboard', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ resource: 'users', id: u.id, data: u })
      });
      if (res.ok) {
        setEditingUser(null);
        fetchUsers();
      }
    } catch (err) { console.error(err); }
  };

  const handleCreate = async () => {
    try {
      const res = await fetch('/api/dashboard', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ resource: 'users', ...newUser })
      });
      if (res.ok) {
        setShowCreate(false);
        setNewUser({ email: '', password: '', firstName: '', lastName: '', role: 'OPERATOR' });
        fetchUsers();
      }
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este usuario permanentemente?')) return;
    try {
      const res = await fetch(`/api/dashboard?resource=users&id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
      });
      if (res.ok) fetchUsers();
    } catch (err) { console.error(err); }
  };

  const filtered = users.filter(u => 
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    `${u.firstName} ${u.lastName}`.toLowerCase().includes(search.toLowerCase())
  );

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
            <div style={{ position: 'relative', width: '300px' }}>
               <input className="white-card" style={{ border: 'none', padding: '12px 16px 12px 48px', width: '100%', fontSize: '13px', fontWeight: 700 }} placeholder="Buscar por nombre o email..." value={search} onChange={e => setSearch(e.target.value)} />
               <Search size={18} style={{ position: 'absolute', left: '16px', top: '12px', color: 'var(--text-muted)' }} />
            </div>
            <button className="btn-primary" style={{ padding: '0 32px', height: '48px' }} onClick={() => setShowCreate(true)}>
               <PlusCircle size={18} /> Agregar Usuario
            </button>
         </div>
      </div>

      {/* Users Table */}
      <div className="glass-card" style={{ padding: '40px' }}>
         <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%' }}>
               <thead>
                  <tr>
                     <th style={{ paddingBottom: '24px' }}>Usuario</th>
                     <th>Email Corportativo</th>
                     <th>Rol / Permisos</th>
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
                             <button onClick={() => setEditingUser(u)} className="white-card" style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}><Edit3 size={16} /></button>
                             {currentUser?.id !== u.id && (
                               <button onClick={() => handleDelete(u.id)} className="white-card" style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', color: 'var(--accent-danger)' }}><Trash2 size={16} /></button>
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
                       <option value="ADMIN">Administrador</option>
                    </select>
                 </div>
              </div>
              <button className="btn-primary" style={{ width: '100%', height: '60px' }} onClick={handleCreate}>Generar Acceso</button>
           </div>
        </div>
      )}
    </div>
  );
}
