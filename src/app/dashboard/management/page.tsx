'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
   PlusCircle,
   Settings,
   Trash2,
   Edit,
   Layers,
   ParkingCircle,
   Tag,
   MapPin,
   Clock,
   User,
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

type Role = 'SUPER_ADMIN' | 'ADMIN' | 'OPERATOR' | 'CUSTOMER' | string;

type Zone = {
   id: string;
   name: string;
   type: string;
   _count?: { spaces: number };
   spaces?: Array<{ id: string; number: string; status: string; assignedUser?: { id: string; firstName: string; lastName: string; email?: string | null } | null }>;
};

type Rate = {
   id: string;
   name: string;
   vehicleType: string;
   modality: string;
   price: number;
   isActive: boolean;
   zone?: { id: string; name: string } | null;
};

type ParkingLot = {
   id: string;
   name: string;
   address: string;
   city: string;
   phone?: string | null;
   totalSpaces: number;
   openTime: string;
   closeTime: string;
   is24Hours: boolean;
   isActive: boolean;
   gracePeriod: number;
   lostTicketFee: number;
};

type Subscription = {
   id: string;
   type: string;
   status: string;
   endDate: string;
   user: { firstName: string; lastName: string; email: string };
   vehicle: { plate: string; type: string; brand?: string | null };
};

type UserLite = {
   id: string;
   firstName: string;
   lastName: string;
   email: string;
};

function safeDecodeJwt(token: string | null): { role?: Role; userId?: string } {
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

export default function ManagementPage() {
   const router = useRouter();
  const [activeTab, setActiveTab] = useState<'zones' | 'rates' | 'lots' | 'customers' | 'config'>('zones');
   const [zones, setZones] = useState<Zone[]>([]);
   const [rates, setRates] = useState<Rate[]>([]);
   const [lots, setLots] = useState<ParkingLot[]>([]);
   const [customers, setCustomers] = useState<Subscription[]>([]);
   const [users, setUsers] = useState<UserLite[]>([]);
   const [assignDraft, setAssignDraft] = useState<{ spaceId: string; userId: string }>({ spaceId: '', userId: '' });
   const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
   const [lotDetails, setLotDetails] = useState<ParkingLot | null>(null);
   const [configDraft, setConfigDraft] = useState<{ gracePeriod: string; lostTicketFee: string }>({
      gracePeriod: '15',
      lostTicketFee: '50000',
   });
   const [role, setRole] = useState<Role>('OPERATOR');
  const [loading, setLoading] = useState(true);

   const [showCreateZone, setShowCreateZone] = useState(false);
   const [showCreateRate, setShowCreateRate] = useState(false);
   const [showEditRate, setShowEditRate] = useState(false);
   const [showCreateLot, setShowCreateLot] = useState(false);

   const [zoneDraft, setZoneDraft] = useState({ name: '', type: 'COVERED', spacesCount: '0', floor: '1', spacePrefix: 'S' });
   const [rateDraft, setRateDraft] = useState({ name: '', vehicleType: 'CAR', modality: 'HOURLY', price: '', zoneId: '' });
   const [rateEdit, setRateEdit] = useState<{ id: string; name: string; price: string; isActive: boolean } | null>(null);
   const [pendingRateToggleId, setPendingRateToggleId] = useState<string | null>(null);
   const rateToggleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
   const [lotDraft, setLotDraft] = useState({
      name: '',
      address: '',
      city: '',
      phone: '',
      totalSpaces: '0',
      openTime: '06:00',
      closeTime: '22:00',
      is24Hours: false,
      isActive: true,
      gracePeriod: '15',
      lostTicketFee: '50000',
   });

   const canManage = role === 'SUPER_ADMIN' || role === 'ADMIN';
   const canCreateLots = role === 'SUPER_ADMIN';

   const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('accessToken')}` });

   const zoneTypeOptions = useMemo(
      () => [
         { value: 'COVERED', label: 'Cubierta' },
         { value: 'UNCOVERED', label: 'Descubierta' },
         { value: 'VIP', label: 'VIP' },
         { value: 'MOTORCYCLE', label: 'Motos' },
         { value: 'DISABLED', label: 'Discapacidad' },
         { value: 'ELECTRIC', label: 'Eléctrico' },
      ],
      []
   );

   const vehicleTypeOptions = useMemo(
      () => [
         { value: 'CAR', label: 'Carro' },
         { value: 'MOTORCYCLE', label: 'Moto' },
         { value: 'TRUCK', label: 'Camión' },
         { value: 'BUS', label: 'Bus' },
      ],
      []
   );

   useEffect(() => () => {
      if (rateToggleTimer.current) clearTimeout(rateToggleTimer.current);
   }, []);

   const modalityOptions = useMemo(
      () => [
         { value: 'HOURLY', label: 'Por Hora' },
         { value: 'FRACTIONAL', label: 'Fraccionado' },
         { value: 'DAILY', label: 'Diario' },
         { value: 'MONTHLY', label: 'Mensual' },
         { value: 'NIGHTLY', label: 'Nocturno' },
      ],
      []
   );

   const spaceOptions = useMemo(
      () => zones.flatMap(z => (z.spaces || []).map(s => ({
         value: s.id,
         label: `${z.name} · ${s.number} (${s.status})${s.assignedUser ? ` · ${s.assignedUser.firstName} ${s.assignedUser.lastName}` : ''}`
      }))),
      [zones]
   );

   const loadLotsAndContext = async () => {
      setLoading(true);
      try {
         const token = localStorage.getItem('accessToken');
         const decoded = safeDecodeJwt(token);
         setRole(decoded.role || 'OPERATOR');

         const headers = authHeaders();
         const lRes = await fetch('/api/dashboard?resource=lots', { headers });
         const lotsData: ParkingLot[] = lRes.ok ? await lRes.json() : [];
         setLots(lotsData);

         const stored = localStorage.getItem('mgmtSelectedLotId');
         const nextLotId = stored && lotsData.some(l => l.id === stored) ? stored : lotsData[0]?.id ?? null;

         if (!nextLotId) {
            setSelectedLotId(null);
            setZones([]);
            setRates([]);
            setLotDetails(null);
            return;
         }
         setSelectedLotId(nextLotId);
         localStorage.setItem('mgmtSelectedLotId', nextLotId);

         const query = `&parkingLotId=${encodeURIComponent(nextLotId)}`;
         const [zRes, rRes, pRes, cRes, uRes] = await Promise.all([
            fetch(`/api/dashboard?resource=zones${query}`, { headers }),
            fetch(`/api/dashboard?resource=rates${query}`, { headers }),
            fetch(`/api/dashboard?resource=parking-lot${query}`, { headers }),
            fetch('/api/dashboard?resource=subscriptions', { headers }),
            canManage ? fetch(`/api/dashboard?resource=users${query}`, { headers }) : Promise.resolve({ ok: false } as Response),
         ]);

         if (zRes.ok) setZones(await zRes.json());
         if (rRes.ok) setRates(await rRes.json());
         if (pRes.ok) {
            const lot = await pRes.json();
            setLotDetails(lot);
            setConfigDraft({ gracePeriod: String(lot?.gracePeriod ?? 15), lostTicketFee: String(lot?.lostTicketFee ?? 50000) });
         }
         if (cRes.ok) setCustomers(await cRes.json());
         if (uRes.ok) setUsers(await uRes.json());
      } catch (err) {
         console.error(err);
      } finally {
         setLoading(false);
      }
   };

   const reloadContext = async (lotId: string) => {
      try {
         const headers = authHeaders();
         const query = `&parkingLotId=${encodeURIComponent(lotId)}`;
         const [zRes, rRes, pRes, uRes] = await Promise.all([
            fetch(`/api/dashboard?resource=zones${query}`, { headers }),
            fetch(`/api/dashboard?resource=rates${query}`, { headers }),
            fetch(`/api/dashboard?resource=parking-lot${query}`, { headers }),
            canManage ? fetch(`/api/dashboard?resource=users${query}`, { headers }) : Promise.resolve({ ok: false } as Response),
         ]);
         if (zRes.ok) setZones(await zRes.json());
         if (rRes.ok) setRates(await rRes.json());
         if (pRes.ok) {
            const lot = await pRes.json();
            setLotDetails(lot);
            setConfigDraft({ gracePeriod: String(lot?.gracePeriod ?? 15), lostTicketFee: String(lot?.lostTicketFee ?? 50000) });
         }
         if (uRes.ok) setUsers(await uRes.json());
      } catch (err) {
         console.error(err);
      }
   };

   useEffect(() => {
      loadLotsAndContext();
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, []);

   const handleNewRecord = () => {
      if (activeTab === 'lots') {
         if (!canCreateLots) {
            toast.error('Solo SuperAdmin puede crear sedes');
            return;
         }
         setShowCreateLot(true);
         return;
      }
      if (!canManage) {
         toast.error('Operación restringida a administradores');
         return;
      }
      if (activeTab === 'zones') {
         setZoneDraft({ name: '', type: 'COVERED', spacesCount: '0', floor: '1', spacePrefix: 'S' });
         setShowCreateZone(true);
         return;
      }
      if (activeTab === 'rates') {
         setRateDraft({ name: '', vehicleType: 'CAR', modality: 'HOURLY', price: '', zoneId: '' });
         setShowCreateRate(true);
         return;
      }
      if (activeTab === 'customers') {
         router.push('/dashboard/subscriptions?new=1');
         return;
      }
   };

   const handleLotChange = async (nextLotId: string) => {
      setSelectedLotId(nextLotId);
      localStorage.setItem('mgmtSelectedLotId', nextLotId);
      await reloadContext(nextLotId);
   };

   const submitCreateZone = async () => {
      if (!selectedLotId) return;
      const name = zoneDraft.name.trim();
      if (!name) {
         toast.error('Nombre requerido');
         return;
      }

      const spacesCount = Number(zoneDraft.spacesCount || 0);
      const floor = Number(zoneDraft.floor || 1);

      try {
         const res = await fetch('/api/dashboard', {
            method: 'POST',
            headers: { ...authHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({
               resource: 'zones',
               parkingLotId: selectedLotId,
               data: {
                  name,
                  type: zoneDraft.type,
                  spacesCount: Number.isFinite(spacesCount) ? spacesCount : 0,
                  floor: Number.isFinite(floor) ? floor : 1,
                  spacePrefix: zoneDraft.spacePrefix,
               },
            }),
         });

         if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            toast.error(data.error || 'No se pudo crear la zona');
            return;
         }

         setShowCreateZone(false);
         await reloadContext(selectedLotId);
      } catch (err) {
         console.error(err);
         toast.error('Error de conexión');
      }
   };

   const submitCreateRate = async () => {
      if (!selectedLotId) return;
      const name = rateDraft.name.trim();
      const price = Number(rateDraft.price);
      if (!name) {
         toast.error('Nombre requerido');
         return;
      }
      if (!Number.isFinite(price) || price <= 0) {
         toast.error('Precio inválido');
         return;
      }

      try {
         const res = await fetch('/api/dashboard', {
            method: 'POST',
            headers: { ...authHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({
               resource: 'rates',
               parkingLotId: selectedLotId,
               data: {
                  name,
                  vehicleType: rateDraft.vehicleType,
                  modality: rateDraft.modality,
                  price,
                  zoneId: rateDraft.zoneId || null,
                  isActive: true,
               },
            }),
         });

         if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            toast.error(data.error || 'No se pudo crear la tarifa');
            return;
         }

         setShowCreateRate(false);
         await reloadContext(selectedLotId);
      } catch (err) {
         console.error(err);
         toast.error('Error de conexión');
      }
   };

   const handleAssignSpace = async () => {
      if (!canManage) return toast.error('Operación restringida a administradores');
      if (!selectedLotId) return toast.error('Selecciona una sede');
      if (!assignDraft.spaceId || !assignDraft.userId) {
         toast.error('Selecciona espacio y usuario');
         return;
      }
      try {
         const res = await fetch('/api/dashboard', {
            method: 'POST',
            headers: { ...authHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ resource: 'assign-space', spaceId: assignDraft.spaceId, userId: assignDraft.userId, parkingLotId: selectedLotId }),
         });
         if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            toast.error(data.error || 'No se pudo asignar el espacio');
            return;
         }
         toast.success('Espacio asignado');
         await reloadContext(selectedLotId);
      } catch (err) {
         console.error(err);
         toast.error('Error de conexión');
      }
   };

   const handleUnassignSpace = async () => {
      if (!canManage) return toast.error('Operación restringida a administradores');
      if (!selectedLotId) return toast.error('Selecciona una sede');
      if (!assignDraft.spaceId) {
         toast.error('Selecciona un espacio');
         return;
      }
      try {
         const res = await fetch('/api/dashboard', {
            method: 'POST',
            headers: { ...authHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ resource: 'unassign-space', spaceId: assignDraft.spaceId, parkingLotId: selectedLotId }),
         });
         if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            toast.error(data.error || 'No se pudo liberar el espacio');
            return;
         }
         toast.success('Espacio liberado');
         setAssignDraft(d => ({ ...d, userId: '' }));
         await reloadContext(selectedLotId);
      } catch (err) {
         console.error(err);
         toast.error('Error de conexión');
      }
   };

   const openEditRate = (rate: Rate) => {
      if (!canManage) return;
      setRateEdit({ id: rate.id, name: rate.name, price: String(rate.price ?? 0), isActive: Boolean(rate.isActive) });
      setShowEditRate(true);
   };

   const submitEditRate = async () => {
      if (!rateEdit) return;
      const price = Number(rateEdit.price);
      if (!Number.isFinite(price) || price <= 0) {
         toast.error('Precio inválido');
         return;
      }

      try {
         const res = await fetch('/api/dashboard', {
            method: 'PUT',
            headers: { ...authHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({
               resource: 'rates',
               id: rateEdit.id,
               data: {
                  name: rateEdit.name,
                  price,
                  isActive: rateEdit.isActive,
               },
            }),
         });
         if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            toast.error(data.error || 'No se pudo actualizar la tarifa');
            return;
         }
         setShowEditRate(false);
         setRateEdit(null);
         if (selectedLotId) await reloadContext(selectedLotId);
      } catch (err) {
         console.error(err);
         toast.error('Error de conexión');
      }
   };

   const deactivateRate = async (rate: Rate) => {
      if (!canManage) return;
      if (pendingRateToggleId !== rate.id) {
         setPendingRateToggleId(rate.id);
         toast('Vuelve a hacer click para confirmar');
         if (rateToggleTimer.current) clearTimeout(rateToggleTimer.current);
         rateToggleTimer.current = setTimeout(() => setPendingRateToggleId(null), 4000);
         return;
      }
      setPendingRateToggleId(null);
      if (rateToggleTimer.current) clearTimeout(rateToggleTimer.current);
      try {
         const res = await fetch('/api/dashboard', {
            method: 'PUT',
            headers: { ...authHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({
               resource: 'rates',
               id: rate.id,
               data: {
                  name: rate.name,
                  price: rate.price,
                  isActive: !rate.isActive,
               },
            }),
         });
         if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            toast.error(data.error || 'No se pudo actualizar la tarifa');
            return;
         }
         if (selectedLotId) await reloadContext(selectedLotId);
      } catch (err) {
         console.error(err);
         toast.error('Error de conexión');
      }
   };

   const saveConfig = async () => {
      if (!selectedLotId) return;
      if (!canManage) {
         toast.error('Operación restringida a administradores');
         return;
      }
      const gracePeriod = Number(configDraft.gracePeriod);
      const lostTicketFee = Number(configDraft.lostTicketFee);
      if (!Number.isFinite(gracePeriod) || gracePeriod < 0) {
         toast.error('Tiempo de gracia inválido');
         return;
      }
      if (!Number.isFinite(lostTicketFee) || lostTicketFee < 0) {
         toast.error('Penalidad inválida');
         return;
      }

      try {
         const res = await fetch('/api/dashboard', {
            method: 'PUT',
            headers: { ...authHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({
               resource: 'parking-lot',
               parkingLotId: selectedLotId,
               data: {
                  gracePeriod,
                  lostTicketFee,
               },
            }),
         });
         if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            toast.error(data.error || 'No se pudo guardar la configuración');
            return;
         }
         await reloadContext(selectedLotId);
         toast.success('Configuración guardada');
      } catch (err) {
         console.error(err);
         toast.error('Error de conexión');
      }
   };

   const submitCreateLot = async () => {
      if (!canCreateLots) return;
      const name = lotDraft.name.trim();
      const address = lotDraft.address.trim();
      const city = lotDraft.city.trim();
      const totalSpaces = Number(lotDraft.totalSpaces);
      const gracePeriod = Number(lotDraft.gracePeriod);
      const lostTicketFee = Number(lotDraft.lostTicketFee);

      if (!name || !address || !city) {
         toast.error('Nombre, dirección y ciudad son requeridos');
         return;
      }
      if (!Number.isFinite(totalSpaces) || totalSpaces < 0) {
         toast.error('Capacidad inválida');
         return;
      }

      try {
         const res = await fetch('/api/dashboard', {
            method: 'POST',
            headers: { ...authHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({
               resource: 'lots',
               data: {
                  name,
                  address,
                  city,
                  phone: lotDraft.phone || null,
                  totalSpaces,
                  openTime: lotDraft.openTime,
                  closeTime: lotDraft.closeTime,
                  is24Hours: lotDraft.is24Hours,
                  isActive: lotDraft.isActive,
                  gracePeriod: Number.isFinite(gracePeriod) ? gracePeriod : 15,
                  lostTicketFee: Number.isFinite(lostTicketFee) ? lostTicketFee : 50000,
               },
            }),
         });
         if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            toast.error(data.error || 'No se pudo crear la sede');
            return;
         }

         const created = await res.json();
         setShowCreateLot(false);
         await loadLotsAndContext();

         if (created?.id) {
            setActiveTab('zones');
            await handleLotChange(created.id);
         }
      } catch (err) {
         console.error(err);
         toast.error('Error de conexión');
      }
   };

  if (loading) return <div style={{ height: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner" /></div>;

  return (
    <div className="animate-premium">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
           <h2 style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>Gestión de Infraestructura</h2>
           <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Configuración de sedes, zonas y esquemas tarifarios</span>
        </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
               {lots.length > 1 && activeTab !== 'lots' && (
                  <div className="white-card" style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                     <MapPin size={16} color="var(--accent-gold)" />
                     <select
                        value={selectedLotId || ''}
                        onChange={(e) => handleLotChange(e.target.value)}
                        style={{ border: 'none', background: 'transparent', fontWeight: 800, fontSize: '13px', outline: 'none' }}
                     >
                        {lots.map(l => (
                           <option key={l.id} value={l.id}>{l.name}</option>
                        ))}
                     </select>
                  </div>
               )}
               {activeTab !== 'config' && (
                  <button className="btn-primary" style={{ padding: '0 32px', height: '48px' }} onClick={handleNewRecord}>
                     <PlusCircle size={18} /> Nuevo Registro
                  </button>
               )}
            </div>
      </div>

         <div style={{ display: 'flex', gap: '8px', marginBottom: '32px', overflowX: 'auto', paddingBottom: '8px' }}>
             {(
                [
                   { id: 'lots', label: 'Sedes', icon: <MapPin size={18} /> },
                   { id: 'zones', label: 'Zonas', icon: <Layers size={18} /> },
                   { id: 'rates', label: 'Tarifas', icon: <Tag size={18} /> },
                   ...(canManage ? [{ id: 'customers', label: 'Clientes / Abonados', icon: <User size={18} /> } as const] : []),
                   { id: 'config', label: 'Configuración', icon: <Settings size={18} /> },
                ] as const
             ).map(tab => (
           <button 
             key={tab.id}
                   onClick={() => setActiveTab(tab.id)}
             style={{ 
               padding: '12px 24px', borderRadius: 'var(--radius-pill)', border: 'none',
               fontSize: '14px', fontWeight: 800, cursor: 'pointer', transition: 'all 0.3s ease',
               display: 'flex', alignItems: 'center', gap: '10px', whiteSpace: 'nowrap',
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
                   {canManage && (
                      <div className="white-card" style={{ padding: '24px', gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '2fr 2fr auto auto', gap: '12px', alignItems: 'end' }}>
                         <div>
                            <div className="input-label" style={{ marginBottom: '6px' }}>Espacio</div>
                            <select className="input-field" value={assignDraft.spaceId} onChange={e => setAssignDraft({ ...assignDraft, spaceId: e.target.value })}>
                               <option value="">Selecciona un espacio</option>
                               {spaceOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                         </div>
                         <div>
                            <div className="input-label" style={{ marginBottom: '6px' }}>Usuario / Inquilino</div>
                            <select className="input-field" value={assignDraft.userId} onChange={e => setAssignDraft({ ...assignDraft, userId: e.target.value })}>
                               <option value="">Selecciona usuario</option>
                               {users.map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName} · {u.email}</option>)}
                            </select>
                         </div>
                         <button className="btn-primary" style={{ padding: '0 16px', height: '44px' }} onClick={handleAssignSpace}>Asignar</button>
                         <button className="white-card" style={{ padding: '0 16px', height: '44px', border: 'none', color: 'var(--accent-danger)', fontWeight: 800 }} onClick={handleUnassignSpace}>Liberar</button>
                      </div>
                   )}
             {zones.length === 0 && (
               <div className="white-card" style={{ padding: '32px' }}>
                 <h4 style={{ fontSize: '16px', fontWeight: 900, marginBottom: '6px' }}>Sin zonas</h4>
                 <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Crea la primera zona para comenzar a generar espacios y tarifas.</p>
               </div>
             )}
             {zones.map(zone => (
               <div key={zone.id} className="white-card" style={{ padding: '32px', position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                     <div style={{ padding: '12px', borderRadius: '16px', background: 'var(--bg-primary)' }}>
                        <ParkingCircle size={24} color="var(--accent-gold)" />
                     </div>
                  </div>
                  <h4 style={{ fontSize: '18px', fontWeight: 900, marginBottom: '8px' }}>{zone.name}</h4>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '24px' }}>{zone.type}</p>
                  
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
                              <th>Ámbito</th>
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
                               <td style={{ fontWeight: 700, color: 'var(--text-muted)' }}>{rate.zone?.name ? `Zona: ${rate.zone.name}` : 'Sede completa'}</td>
                     <td style={{ fontSize: '16px', fontWeight: 900 }}>{formatCurrency(rate.price)}</td>
                     <td>
                        <span className={`badge ${rate.isActive ? 'badge-success' : 'badge-danger'}`} style={{ padding: '8px 16px', borderRadius: '12px', fontSize: '11px', fontWeight: 800 }}>
                           {rate.isActive ? 'Activa' : 'Inactiva'}
                        </span>
                     </td>
                     <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                        <button
                                           className="white-card"
                                           style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: canManage ? 'pointer' : 'not-allowed', opacity: canManage ? 1 : 0.6 }}
                                           onClick={() => openEditRate(rate)}
                                           disabled={!canManage}
                                        >
                                           <Edit size={16} />
                                        </button>
                                        <button
                                           className="white-card"
                                           style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: canManage ? 'pointer' : 'not-allowed', color: 'var(--accent-danger)', opacity: canManage ? 1 : 0.6 }}
                                           onClick={() => deactivateRate(rate)}
                                           disabled={!canManage}
                                           title={rate.isActive ? 'Desactivar' : 'Activar'}
                                        >
                                           <Trash2 size={16} />
                                        </button>
                        </div>
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
         )}

         {activeTab === 'customers' && (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                     <th style={{ paddingBottom: '24px' }}>Cliente</th>
                     <th>Suscripción</th>
                     <th>Vehículo</th>
                     <th>Vencimiento</th>
                     <th>Estado</th>
                     <th style={{ textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map(sub => (
                    <tr key={sub.id}>
                      <td style={{ paddingTop: '24px', paddingBottom: '24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                           <div className="white-card" style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 900 }}>{sub.user.firstName[0]}</div>
                           <span style={{ fontWeight: 800 }}>{sub.user.firstName} {sub.user.lastName}</span>
                        </div>
                      </td>
                      <td style={{ fontWeight: 700 }}>{sub.type}</td>
                      <td style={{ fontWeight: 700 }}>{sub.vehicle.plate}</td>
                      <td style={{ fontSize: '12px', fontWeight: 700 }}>{formatDate(sub.endDate)}</td>
                      <td>
                         <span className={`badge ${sub.status === 'ACTIVE' ? 'badge-success' : 'badge-danger'}`} style={{ padding: '8px 16px', borderRadius: '12px', fontSize: '11px', fontWeight: 800 }}>
                            {sub.status === 'ACTIVE' ? 'Activo' : 'Vencido'}
                         </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                                     <button
                                        className="white-card"
                                        style={{
                                           padding: '8px 16px',
                                           fontSize: '12px',
                                           fontWeight: 800,
                                           border: 'none',
                                           cursor: canManage ? 'pointer' : 'not-allowed',
                                           opacity: canManage ? 1 : 0.6,
                                        }}
                                        disabled={!canManage}
                                        onClick={() => router.push(`/dashboard/subscriptions?edit=${encodeURIComponent(sub.id)}&q=${encodeURIComponent(sub.vehicle.plate)}`)}
                                     >
                                        Gestionar
                                     </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'config' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '32px' }}>
               <div className="white-card" style={{ padding: '32px' }}>
                  <h4 style={{ fontSize: '16px', fontWeight: 900, marginBottom: '24px' }}>Parámetros Globales</h4>
                           {lotDetails && (
                              <div className="white-card" style={{ padding: '12px 14px', marginBottom: '16px', background: 'var(--bg-primary)' }}>
                                 <div style={{ fontSize: '11px', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Sede</div>
                                 <div style={{ fontSize: '14px', fontWeight: 900 }}>{lotDetails.name}</div>
                                 <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>{lotDetails.address}, {lotDetails.city}</div>
                              </div>
                           )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                     <div>
                        <label className="input-label">Tiempo de Gracia (min)</label>
                        <input className="white-card" type="number" style={{ border: 'none', padding: '16px', width: '100%', fontSize: '14px', fontWeight: 800 }} value={configDraft.gracePeriod} onChange={e => setConfigDraft({ ...configDraft, gracePeriod: e.target.value })} />
                     </div>
                     <div>
                        <label className="input-label">Penalidad Ticket Perdido</label>
                        <input className="white-card" type="number" style={{ border: 'none', padding: '16px', width: '100%', fontSize: '14px', fontWeight: 800 }} value={configDraft.lostTicketFee} onChange={e => setConfigDraft({ ...configDraft, lostTicketFee: e.target.value })} />
                     </div>
                     <button className="btn-primary" style={{ height: '48px' }} onClick={saveConfig} disabled={!canManage}>
                       {canManage ? 'Guardar Configuración' : 'Solo Admin/SuperAdmin'}
                     </button>
                  </div>
               </div>
               <div className="white-card" style={{ padding: '32px' }}>
                  <h4 style={{ fontSize: '16px', fontWeight: 900, marginBottom: '24px' }}>Seguridad y Acceso</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                         <span style={{ fontSize: '14px', fontWeight: 700 }}>Multi-sede habilitado</span>
                         <input type="checkbox" checked={lots.length > 1} readOnly />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                         <span style={{ fontSize: '14px', fontWeight: 700 }}>2FA</span>
                         <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-muted)' }}>Se gestiona desde Usuarios</span>
                      </div>
                  </div>
               </div>
               <div className="white-card" style={{ padding: '32px', background: 'var(--text-primary)', color: 'white' }}>
                  <h4 style={{ fontSize: '16px', fontWeight: 900, marginBottom: '24px', color: 'var(--accent-gold)' }}>Mantenimiento</h4>
                  <p style={{ fontSize: '12px', opacity: 0.7, marginBottom: '24px' }}>Realice copias de seguridad de la base de datos o restaure el sistema a un punto anterior.</p>
                  <div style={{ fontSize: '12px', fontWeight: 800, opacity: 0.85 }}>Backups automatizados: no configurado en esta versión.</div>
               </div>
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

                           <button
                              className="btn-primary"
                              style={{ width: '100%', height: '56px', borderRadius: '16px', background: 'var(--text-primary)', color: 'white' }}
                              onClick={async () => {
                                 setActiveTab('config');
                                 await handleLotChange(lot.id);
                              }}
                           >
                              Configurar Sede
                           </button>
               </div>
             ))}
           </div>
         )}
      </div>

         {/* Create Zone Modal */}
         {showCreateZone && (
            <div className="modal-overlay" onClick={() => setShowCreateZone(false)}>
               <div className="modal-content-premium animate-premium" style={{ maxWidth: '620px' }} onClick={e => e.stopPropagation()}>
                  <h3 style={{ fontSize: '22px', fontWeight: 900, marginBottom: '8px' }}>Nueva Zona</h3>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '20px' }}>
                     Crea una zona y (opcional) genera espacios automáticamente.
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                     <div>
                        <label className="input-label">Nombre</label>
                        <input className="input-field" value={zoneDraft.name} onChange={e => setZoneDraft({ ...zoneDraft, name: e.target.value })} placeholder="Ej: Zona A" />
                     </div>
                     <div>
                        <label className="input-label">Tipo</label>
                        <select className="input-field" value={zoneDraft.type} onChange={e => setZoneDraft({ ...zoneDraft, type: e.target.value })}>
                           {zoneTypeOptions.map(o => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                           ))}
                        </select>
                     </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                     <div>
                        <label className="input-label">Espacios (opcional)</label>
                        <input className="input-field" type="number" value={zoneDraft.spacesCount} onChange={e => setZoneDraft({ ...zoneDraft, spacesCount: e.target.value })} placeholder="0" />
                     </div>
                     <div>
                        <label className="input-label">Piso</label>
                        <input className="input-field" type="number" value={zoneDraft.floor} onChange={e => setZoneDraft({ ...zoneDraft, floor: e.target.value })} />
                     </div>
                     <div>
                        <label className="input-label">Prefijo</label>
                        <input className="input-field" value={zoneDraft.spacePrefix} onChange={e => setZoneDraft({ ...zoneDraft, spacePrefix: e.target.value })} placeholder="S" />
                     </div>
                  </div>

                  <button className="btn-primary" style={{ width: '100%', height: '56px' }} onClick={submitCreateZone}>
                     Crear Zona
                  </button>
               </div>
            </div>
         )}

         {/* Create Rate Modal */}
         {showCreateRate && (
            <div className="modal-overlay" onClick={() => setShowCreateRate(false)}>
               <div className="modal-content-premium animate-premium" style={{ maxWidth: '720px' }} onClick={e => e.stopPropagation()}>
                  <h3 style={{ fontSize: '22px', fontWeight: 900, marginBottom: '8px' }}>Nueva Tarifa</h3>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '20px' }}>
                     Define tarifas por tipo de vehículo y modalidad. Puedes aplicarla a toda la sede o a una zona.
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginBottom: '16px' }}>
                     <div>
                        <label className="input-label">Nombre</label>
                        <input className="input-field" value={rateDraft.name} onChange={e => setRateDraft({ ...rateDraft, name: e.target.value })} placeholder="Ej: Hora Carro" />
                     </div>
                     <div>
                        <label className="input-label">Precio</label>
                        <input className="input-field" type="number" value={rateDraft.price} onChange={e => setRateDraft({ ...rateDraft, price: e.target.value })} placeholder="3000" />
                     </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                     <div>
                        <label className="input-label">Tipo de vehículo</label>
                        <select className="input-field" value={rateDraft.vehicleType} onChange={e => setRateDraft({ ...rateDraft, vehicleType: e.target.value })}>
                           {vehicleTypeOptions.map(o => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                           ))}
                        </select>
                     </div>
                     <div>
                        <label className="input-label">Modalidad</label>
                        <select className="input-field" value={rateDraft.modality} onChange={e => setRateDraft({ ...rateDraft, modality: e.target.value })}>
                           {modalityOptions.map(o => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                           ))}
                        </select>
                     </div>
                     <div>
                        <label className="input-label">Ámbito</label>
                        <select className="input-field" value={rateDraft.zoneId} onChange={e => setRateDraft({ ...rateDraft, zoneId: e.target.value })}>
                           <option value="">Sede completa</option>
                           {zones.map(z => (
                              <option key={z.id} value={z.id}>{z.name}</option>
                           ))}
                        </select>
                     </div>
                  </div>

                  <button className="btn-primary" style={{ width: '100%', height: '56px' }} onClick={submitCreateRate}>
                     Crear Tarifa
                  </button>
               </div>
            </div>
         )}

         {/* Edit Rate Modal */}
         {showEditRate && rateEdit && (
            <div className="modal-overlay" onClick={() => setShowEditRate(false)}>
               <div className="modal-content-premium animate-premium" style={{ maxWidth: '560px' }} onClick={e => e.stopPropagation()}>
                  <h3 style={{ fontSize: '22px', fontWeight: 900, marginBottom: '8px' }}>Editar Tarifa</h3>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '20px' }}>
                     Ajusta nombre, precio y estado.
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginBottom: '16px' }}>
                     <div>
                        <label className="input-label">Nombre</label>
                        <input className="input-field" value={rateEdit.name} onChange={e => setRateEdit({ ...rateEdit, name: e.target.value })} />
                     </div>
                     <div>
                        <label className="input-label">Precio</label>
                        <input className="input-field" type="number" value={rateEdit.price} onChange={e => setRateEdit({ ...rateEdit, price: e.target.value })} />
                     </div>
                  </div>

                  <div className="white-card" style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                     <span style={{ fontSize: '13px', fontWeight: 800 }}>Tarifa activa</span>
                     <input type="checkbox" checked={rateEdit.isActive} onChange={e => setRateEdit({ ...rateEdit, isActive: e.target.checked })} />
                  </div>

                  <button className="btn-primary" style={{ width: '100%', height: '56px' }} onClick={submitEditRate}>
                     Guardar Cambios
                  </button>
               </div>
            </div>
         )}

         {/* Create Lot Modal */}
         {showCreateLot && (
            <div className="modal-overlay" onClick={() => setShowCreateLot(false)}>
               <div className="modal-content-premium animate-premium" style={{ maxWidth: '760px' }} onClick={e => e.stopPropagation()}>
                  <h3 style={{ fontSize: '22px', fontWeight: 900, marginBottom: '8px' }}>Nueva Sede</h3>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '20px' }}>
                     Disponible solo para SuperAdmin.
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                     <div>
                        <label className="input-label">Nombre</label>
                        <input className="input-field" value={lotDraft.name} onChange={e => setLotDraft({ ...lotDraft, name: e.target.value })} placeholder="Ej: Sede Centro" />
                     </div>
                     <div>
                        <label className="input-label">Teléfono</label>
                        <input className="input-field" value={lotDraft.phone} onChange={e => setLotDraft({ ...lotDraft, phone: e.target.value })} placeholder="Opcional" />
                     </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginBottom: '16px' }}>
                     <div>
                        <label className="input-label">Dirección</label>
                        <input className="input-field" value={lotDraft.address} onChange={e => setLotDraft({ ...lotDraft, address: e.target.value })} placeholder="Calle 123 #45-67" />
                     </div>
                     <div>
                        <label className="input-label">Ciudad</label>
                        <input className="input-field" value={lotDraft.city} onChange={e => setLotDraft({ ...lotDraft, city: e.target.value })} placeholder="Bogotá" />
                     </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                     <div>
                        <label className="input-label">Capacidad inicial</label>
                        <input className="input-field" type="number" value={lotDraft.totalSpaces} onChange={e => setLotDraft({ ...lotDraft, totalSpaces: e.target.value })} />
                     </div>
                     <div>
                        <label className="input-label">Apertura</label>
                        <input className="input-field" value={lotDraft.openTime} onChange={e => setLotDraft({ ...lotDraft, openTime: e.target.value })} placeholder="06:00" />
                     </div>
                     <div>
                        <label className="input-label">Cierre</label>
                        <input className="input-field" value={lotDraft.closeTime} onChange={e => setLotDraft({ ...lotDraft, closeTime: e.target.value })} placeholder="22:00" />
                     </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                     <div className="white-card" style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '13px', fontWeight: 800 }}>24 Horas</span>
                        <input type="checkbox" checked={lotDraft.is24Hours} onChange={e => setLotDraft({ ...lotDraft, is24Hours: e.target.checked })} />
                     </div>
                     <div className="white-card" style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '13px', fontWeight: 800 }}>Activa</span>
                        <input type="checkbox" checked={lotDraft.isActive} onChange={e => setLotDraft({ ...lotDraft, isActive: e.target.checked })} />
                     </div>
                     <div>
                        <label className="input-label">Gracia (min)</label>
                        <input className="input-field" type="number" value={lotDraft.gracePeriod} onChange={e => setLotDraft({ ...lotDraft, gracePeriod: e.target.value })} />
                     </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                     <div>
                        <label className="input-label">Ticket Perdido</label>
                        <input className="input-field" type="number" value={lotDraft.lostTicketFee} onChange={e => setLotDraft({ ...lotDraft, lostTicketFee: e.target.value })} />
                     </div>
                     <div className="white-card" style={{ padding: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <Clock size={18} color="var(--accent-gold)" />
                        <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-muted)' }}>Luego podrás crear zonas/espacios y tarifas.</span>
                     </div>
                  </div>

                  <button className="btn-primary" style={{ width: '100%', height: '56px' }} onClick={submitCreateLot}>
                     Crear Sede
                  </button>
               </div>
            </div>
         )}
    </div>
  );
}

