'use client';

import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { 
  Users, 
  Calendar, 
  Car, 
  PlusCircle, 
  Search, 
   AlertTriangle,
   X,
   RefreshCcw,
   Ban
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

type JwtPayload = { role?: string; userId?: string };

type SubscriptionData = {
   id: string;
   type: 'FIXED' | 'FLOATING';
   status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'PENDING_RENEWAL';
   startDate: string;
   endDate: string;
   price: number;
   autoRenew: boolean;
   user: { firstName: string; lastName: string; email: string };
   vehicle: { plate: string; type: string; brand?: string | null };
};

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

function toDateInputValue(d: Date): string {
   const yyyy = d.getFullYear();
   const mm = String(d.getMonth() + 1).padStart(2, '0');
   const dd = String(d.getDate()).padStart(2, '0');
   return `${yyyy}-${mm}-${dd}`;
}

function addMonths(d: Date, months: number): Date {
   const out = new Date(d);
   out.setMonth(out.getMonth() + months);
   return out;
}

function effectiveStatus(s: SubscriptionData): SubscriptionData['status'] {
   if (s.status === 'ACTIVE' && new Date(s.endDate) < new Date()) return 'EXPIRED';
   return s.status;
}

export default function SubscriptionsPage() {
   const searchParams = useSearchParams();
   const [subscriptions, setSubscriptions] = useState<SubscriptionData[]>([]);
  const [loading, setLoading] = useState(true);
   const [query, setQuery] = useState('');

   const [appliedParams, setAppliedParams] = useState(false);
   const [pendingCancelId, setPendingCancelId] = useState<string | null>(null);
   const cancelTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

   const [role, setRole] = useState<string>('OPERATOR');
   const canManage = role === 'SUPER_ADMIN' || role === 'ADMIN';

   useEffect(() => () => {
      if (cancelTimer.current) clearTimeout(cancelTimer.current);
   }, []);

   const [showCreate, setShowCreate] = useState(false);
   const [saving, setSaving] = useState(false);
   const [editing, setEditing] = useState<SubscriptionData | null>(null);

   const [form, setForm] = useState({
      customerEmail: '',
      customerFirstName: '',
      customerLastName: '',
      customerPhone: '',
      plate: '',
      vehicleType: 'CAR',
      brand: '',
      color: '',
      type: 'FIXED' as SubscriptionData['type'],
      autoRenew: false,
      price: '',
      startDate: toDateInputValue(new Date()),
      endDate: toDateInputValue(addMonths(new Date(), 1)),
   });

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard?resource=subscriptions', {
            headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
      });
         if (res.ok) {
            const data: unknown = await res.json();
            setSubscriptions(Array.isArray(data) ? (data as SubscriptionData[]) : []);
         }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

   useEffect(() => {
      const decoded = safeDecodeJwt(localStorage.getItem('accessToken'));
      setRole(decoded.role || 'OPERATOR');
      fetchData();
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, []);

   useEffect(() => {
      if (appliedParams) return;
      if (loading) return;

      const q = (searchParams.get('q') || '').trim();
      if (q) setQuery(q);

      if (canManage && searchParams.get('new') === '1') {
         openCreate();
         setAppliedParams(true);
         return;
      }

      const editId = (searchParams.get('edit') || '').trim();
      if (canManage && editId) {
         const found = subscriptions.find((s) => s.id === editId);
         if (found) {
            openRenew(found);
            setAppliedParams(true);
            return;
         }
      }

      setAppliedParams(true);
   }, [appliedParams, loading, searchParams, subscriptions, canManage]);

   const filtered = useMemo(() => {
      const q = query.trim().toLowerCase();
      if (!q) return subscriptions;
      return subscriptions.filter((s) => {
         const name = `${s.user.firstName} ${s.user.lastName}`.toLowerCase();
         const email = s.user.email.toLowerCase();
         const plate = s.vehicle.plate.toLowerCase();
         return name.includes(q) || email.includes(q) || plate.includes(q);
      });
   }, [query, subscriptions]);

   const openCreate = () => {
      setEditing(null);
      setForm({
         customerEmail: '',
         customerFirstName: '',
         customerLastName: '',
         customerPhone: '',
         plate: '',
         vehicleType: 'CAR',
         brand: '',
         color: '',
         type: 'FIXED',
         autoRenew: false,
         price: '',
         startDate: toDateInputValue(new Date()),
         endDate: toDateInputValue(addMonths(new Date(), 1)),
      });
      setShowCreate(true);
   };

   const openRenew = (s: SubscriptionData) => {
      setEditing(s);
      setForm({
         customerEmail: s.user.email,
         customerFirstName: s.user.firstName,
         customerLastName: s.user.lastName,
         customerPhone: '',
         plate: s.vehicle.plate,
         vehicleType: s.vehicle.type,
         brand: s.vehicle.brand || '',
         color: '',
         type: s.type,
         autoRenew: s.autoRenew,
         price: String(s.price),
         startDate: toDateInputValue(new Date()),
         endDate: toDateInputValue(addMonths(new Date(), 1)),
      });
      setShowCreate(true);
   };

   const submit = async () => {
      if (!canManage) return;
      setSaving(true);
      try {
         const payload = {
            resource: 'subscriptions',
            ...(editing ? { id: editing.id, data: { endDate: form.endDate, price: Number(form.price), status: 'ACTIVE', autoRenew: form.autoRenew, type: form.type } } : {
               data: {
                  customer: {
                     email: form.customerEmail,
                     firstName: form.customerFirstName,
                     lastName: form.customerLastName,
                     phone: form.customerPhone || undefined,
                  },
                  vehicle: {
                     plate: form.plate,
                     type: form.vehicleType,
                     brand: form.brand || undefined,
                     color: form.color || undefined,
                  },
                  startDate: form.startDate,
                  endDate: form.endDate,
                  price: Number(form.price),
                  type: form.type,
                  autoRenew: form.autoRenew,
               }
            })
         };

         const res = await fetch('/api/dashboard', {
            method: editing ? 'PUT' : 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
         });

         if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            toast.error((data as { error?: string }).error || 'No se pudo guardar la suscripción');
            return;
         }

         setShowCreate(false);
         setEditing(null);
         await fetchData();
      } finally {
         setSaving(false);
      }
   };

   const cancelSubscription = async (s: SubscriptionData) => {
      if (!canManage) return;
      if (pendingCancelId !== s.id) {
         setPendingCancelId(s.id);
         toast('Vuelve a hacer click para confirmar');
         if (cancelTimer.current) clearTimeout(cancelTimer.current);
         cancelTimer.current = setTimeout(() => setPendingCancelId(null), 4000);
         return;
      }
      setPendingCancelId(null);
      if (cancelTimer.current) clearTimeout(cancelTimer.current);
      const res = await fetch('/api/dashboard', {
         method: 'PUT',
         headers: getAuthHeaders(),
         body: JSON.stringify({ resource: 'subscriptions', id: s.id, data: { status: 'CANCELLED', autoRenew: false } }),
      });
      if (!res.ok) {
         const data = await res.json().catch(() => ({}));
         toast.error((data as { error?: string }).error || 'No se pudo cancelar');
         return;
      }
      await fetchData();
   };

  if (loading) return <div style={{ height: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner" /></div>;

  return (
    <div className="animate-premium">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
           <h2 style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>Clientes Mensuales</h2>
           <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Gestión de suscripciones, renovaciones y convenios</span>
        </div>
            {canManage && (
               <button className="btn-primary" style={{ padding: '0 32px', height: '56px' }} onClick={openCreate}>
                  <PlusCircle size={20} /> Nueva Mensualidad
               </button>
            )}
      </div>

      <div style={{ display: 'flex', gap: '24px', marginBottom: '32px' }}>
         <div className="white-card" style={{ flex: 1, padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ padding: '12px', borderRadius: '14px', background: 'rgba(233, 185, 73, 0.1)', color: 'var(--accent-gold)' }}><Users size={24} /></div>
            <div>
                  <div style={{ fontSize: '24px', fontWeight: 900 }}>{subscriptions.filter(s => effectiveStatus(s) === 'ACTIVE').length}</div>
               <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)' }}>CLIENTES ACTIVOS</div>
            </div>
         </div>
         <div className="white-card" style={{ flex: 1, padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ padding: '12px', borderRadius: '14px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--accent-success)' }}><Calendar size={24} /></div>
            <div>
                  <div style={{ fontSize: '24px', fontWeight: 900 }}>{subscriptions.filter(s => effectiveStatus(s) === 'ACTIVE').length}</div>
               <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)' }}>SUSCRIPCIONES AL DÍA</div>
            </div>
         </div>
         <div className="white-card" style={{ flex: 1, padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ padding: '12px', borderRadius: '14px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-danger)' }}><AlertTriangle size={24} /></div>
            <div>
                  <div style={{ fontSize: '24px', fontWeight: 900 }}>{subscriptions.filter(s => {
                     const end = new Date(s.endDate);
                     const now = new Date();
                     const diffDays = (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
                     return effectiveStatus(s) === 'ACTIVE' && diffDays >= 0 && diffDays <= 7;
                  }).length}</div>
               <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)' }}>VENCIMIENTOS PRÓXIMOS</div>
            </div>
         </div>
      </div>

      <div className="glass-card" style={{ padding: '40px' }}>
         <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '32px' }}>
            <div style={{ position: 'relative', width: '360px' }}>
               <input className="white-card" style={{ border: 'none', padding: '14px 16px 14px 48px', width: '100%', fontSize: '14px', fontWeight: 700 }} placeholder="Buscar por nombre, placa o email..." value={query} onChange={(e) => setQuery(e.target.value)} />
               <Search size={18} style={{ position: 'absolute', left: '16px', top: '14px', color: 'var(--text-muted)' }} />
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
               <button className="white-card" style={{ padding: '0 20px', fontSize: '13px', fontWeight: 800, border: 'none', cursor: 'pointer' }} onClick={() => void fetchData()}>
                 <RefreshCcw size={16} /> Actualizar
               </button>
            </div>
         </div>

         <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%' }}>
               <thead>
                  <tr>
                     <th style={{ paddingBottom: '24px' }}>Cliente</th>
                     <th>Vehículo</th>
                     <th>Vigencia</th>
                     <th>Precio</th>
                     <th>Estado</th>
                     <th style={{ textAlign: 'right' }}>Acciones</th>
                  </tr>
               </thead>
               <tbody>
                           {filtered.map(sub => {
                              const status = effectiveStatus(sub);
                              return (
                    <tr key={sub.id}>
                       <td style={{ paddingTop: '24px', paddingBottom: '24px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                             <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: 'var(--accent-gold)' }}>
                                {sub.user.firstName[0]}
                             </div>
                             <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '15px', fontWeight: 900 }}>{sub.user.firstName} {sub.user.lastName}</span>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>{sub.user.email}</span>
                             </div>
                          </div>
                       </td>
                       <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                             <Car size={16} color="var(--text-muted)" />
                             <span style={{ fontSize: '14px', fontWeight: 800 }}>{sub.vehicle.plate}</span>
                          </div>
                       </td>
                       <td>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                             <span style={{ fontSize: '13px', fontWeight: 700 }}>{formatDate(sub.startDate)}</span>
                             <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Hasta: {formatDate(sub.endDate)}</span>
                          </div>
                       </td>
                       <td style={{ fontSize: '15px', fontWeight: 900 }}>{formatCurrency(sub.price)}</td>
                       <td>
                                       <span className={`badge ${status === 'ACTIVE' ? 'badge-success' : status === 'CANCELLED' ? 'badge-danger' : 'badge-info'}`} style={{ padding: '8px 16px', borderRadius: '12px', fontSize: '11px', fontWeight: 800 }}>
                                           {status === 'ACTIVE' ? 'ACTIVA' : status === 'CANCELLED' ? 'CANCELADA' : status === 'PENDING_RENEWAL' ? 'POR RENOVAR' : 'EXPIRADA'}
                          </span>
                       </td>
                       <td style={{ textAlign: 'right' }}>
                                       <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                          {canManage && status !== 'CANCELLED' && (
                                             <button className="white-card" style={{ height: '36px', padding: '0 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', fontWeight: 900, gap: '8px' }} onClick={() => openRenew(sub)}>
                                                <RefreshCcw size={16} /> Renovar
                                             </button>
                                          )}
                                          {canManage && status === 'ACTIVE' && (
                                             <button className="white-card" style={{ height: '36px', padding: '0 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', fontWeight: 900, gap: '8px', color: 'var(--accent-danger)' }} onClick={() => void cancelSubscription(sub)}>
                                                <Ban size={16} /> Cancelar
                                             </button>
                                          )}
                                       </div>
                       </td>
                    </tr>
                           );
                           })}
                           {filtered.length === 0 && (
                    <tr>
                       <td colSpan={6} style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)', fontWeight: 600 }}> No se encontraron suscripciones registradas. </td>
                    </tr>
                  )}
               </tbody>
            </table>
         </div>
      </div>

         {showCreate && canManage && (
            <div className="modal-overlay" onClick={() => !saving && setShowCreate(false)}>
               <div className="modal-content-premium animate-premium" style={{ maxWidth: '720px' }} onClick={(e) => e.stopPropagation()}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px' }}>
                     <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <h3 style={{ fontSize: '22px', fontWeight: 900 }}>{editing ? 'Renovar Suscripción' : 'Nueva Mensualidad'}</h3>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>
                           {editing ? `Placa ${editing.vehicle.plate}` : 'Crea un cliente mensual con vehículo asociado'}
                        </span>
                     </div>
                     <button className="white-card" style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none' }} onClick={() => setShowCreate(false)} disabled={saving}>
                        <X size={18} />
                     </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                     <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                        <label className="input-label">Email del cliente</label>
                        <input className="input-field" value={form.customerEmail} onChange={(e) => setForm(prev => ({ ...prev, customerEmail: e.target.value }))} disabled={!!editing} />
                     </div>
                     <div className="form-group">
                        <label className="input-label">Nombre</label>
                        <input className="input-field" value={form.customerFirstName} onChange={(e) => setForm(prev => ({ ...prev, customerFirstName: e.target.value }))} disabled={!!editing} />
                     </div>
                     <div className="form-group">
                        <label className="input-label">Apellido</label>
                        <input className="input-field" value={form.customerLastName} onChange={(e) => setForm(prev => ({ ...prev, customerLastName: e.target.value }))} disabled={!!editing} />
                     </div>
                     <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                        <label className="input-label">Teléfono (opcional)</label>
                        <input className="input-field" value={form.customerPhone} onChange={(e) => setForm(prev => ({ ...prev, customerPhone: e.target.value }))} disabled={!!editing} />
                     </div>

                     <div className="form-group">
                        <label className="input-label">Placa</label>
                        <input className="input-field" value={form.plate} onChange={(e) => setForm(prev => ({ ...prev, plate: e.target.value.toUpperCase() }))} disabled={!!editing} />
                     </div>
                     <div className="form-group">
                        <label className="input-label">Tipo de vehículo</label>
                        <select className="input-field" value={form.vehicleType} onChange={(e) => setForm(prev => ({ ...prev, vehicleType: e.target.value }))} disabled={!!editing}>
                           <option value="CAR">Automóvil</option>
                           <option value="MOTORCYCLE">Motocicleta</option>
                           <option value="VAN">Camioneta</option>
                        </select>
                     </div>
                     <div className="form-group">
                        <label className="input-label">Marca (opcional)</label>
                        <input className="input-field" value={form.brand} onChange={(e) => setForm(prev => ({ ...prev, brand: e.target.value }))} disabled={!!editing} />
                     </div>
                     <div className="form-group">
                        <label className="input-label">Color (opcional)</label>
                        <input className="input-field" value={form.color} onChange={(e) => setForm(prev => ({ ...prev, color: e.target.value }))} disabled={!!editing} />
                     </div>

                     <div className="form-group">
                        <label className="input-label">Tipo de suscripción</label>
                        <select className="input-field" value={form.type} onChange={(e) => setForm(prev => ({ ...prev, type: e.target.value as SubscriptionData['type'] }))}>
                           <option value="FIXED">Fija</option>
                           <option value="FLOATING">Flotante</option>
                        </select>
                     </div>

                     <div className="form-group">
                        <label className="input-label">Precio</label>
                        <input className="input-field" type="number" value={form.price} onChange={(e) => setForm(prev => ({ ...prev, price: e.target.value }))} />
                     </div>

                     <div className="form-group">
                        <label className="input-label">Inicio</label>
                        <input className="input-field" type="date" value={form.startDate} onChange={(e) => setForm(prev => ({ ...prev, startDate: e.target.value }))} disabled={!!editing} />
                     </div>
                     <div className="form-group">
                        <label className="input-label">Fin</label>
                        <input className="input-field" type="date" value={form.endDate} onChange={(e) => setForm(prev => ({ ...prev, endDate: e.target.value }))} />
                     </div>

                     <div className="form-group" style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input type="checkbox" checked={form.autoRenew} onChange={(e) => setForm(prev => ({ ...prev, autoRenew: e.target.checked }))} />
                        <span style={{ fontWeight: 800, fontSize: '13px' }}>Auto-renovar</span>
                     </div>
                  </div>

                  <button className="btn-primary" style={{ width: '100%', height: '56px', marginTop: '18px' }} onClick={() => void submit()} disabled={saving}>
                     {saving ? 'Guardando…' : (editing ? 'Renovar' : 'Crear suscripción')}
                  </button>
               </div>
            </div>
         )}
    </div>
  );
}
