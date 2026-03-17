'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Building, 
  Clock, 
  Banknote, 
  Car, 
  Bike, 
  Loader2, 
  Save, 
  Globe, 
  PlusCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Rate {
  id: string; name: string; vehicleType: string; price: number; isActive: boolean;
}

interface ParkingLotConfig {
   id: string;
   name: string;
   address: string;
   city: string;
   phone?: string | null;
   openTime: string;
   closeTime: string;
   is24Hours: boolean;
   isActive: boolean;
   gracePeriod: number;
   lostTicketFee: number;
}

type Role = 'SUPER_ADMIN' | 'ADMIN' | 'OPERATOR' | 'CUSTOMER' | string;

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

type Telemetry = { env: string; node: string; prisma: string | null; db: string | null; uptimeSeconds: number };

function formatUptime(seconds: number) {
  const s = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function SettingsPage() {
  const [rates, setRates] = useState<Rate[]>([]);
   const [lotDraft, setLotDraft] = useState<ParkingLotConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
   const [savingLot, setSavingLot] = useState(false);
  const [showCreateRate, setShowCreateRate] = useState(false);
  const [newRate, setNewRate] = useState({ name: '', vehicleType: 'CAR', price: 0 });
   const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  const router = useRouter();

   const role = useMemo(() => safeDecodeJwt(localStorage.getItem('accessToken')).role, []);
   const canManage = role === 'SUPER_ADMIN' || role === 'ADMIN';

   const fetchLot = useCallback(async () => {
      try {
         const res = await fetch('/api/dashboard?resource=parking-lot', {
            headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
         });
         if (res.status === 401) {
            localStorage.removeItem('accessToken');
            router.push('/');
            return;
         }
         if (res.ok) {
            const data = await res.json();
            setLotDraft(data);
         }
      } catch (err) {
         console.error(err);
         toast.error('No se pudo cargar la sede');
      }
   }, [router]);

   const fetchTelemetry = useCallback(async () => {
      try {
         const res = await fetch('/api/dashboard?resource=telemetry', {
            headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
         });
         if (res.status === 401) {
            localStorage.removeItem('accessToken');
            router.push('/');
            return;
         }
         if (res.ok) {
            setTelemetry(await res.json());
         }
      } catch (err) {
         console.error(err);
         toast.error('No se pudo cargar la telemetría');
      }
   }, [router]);

  const fetchRates = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard?resource=rates', { 
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` } 
      });
         if (res.status === 401) {
            localStorage.removeItem('accessToken');
            router.push('/');
            return;
         }
      if (res.ok) setRates(await res.json());
      } catch (err) {
         console.error(err);
         toast.error('No se pudieron cargar las tarifas');
      }
  }, [router]);

  useEffect(() => {
      if (!canManage) {
         router.push('/dashboard');
         return;
      }
      let cancelled = false;
      (async () => {
         setLoading(true);
         try {
            await Promise.all([fetchRates(), fetchLot(), fetchTelemetry()]);
         } finally {
            if (!cancelled) setLoading(false);
         }
      })();
      return () => {
         cancelled = true;
      };
  }, [canManage, fetchRates, fetchLot, fetchTelemetry, router]);

   const handleSaveLot = async () => {
      if (!lotDraft) return;
      setSavingLot(true);
      try {
         const res = await fetch('/api/dashboard', {
            method: 'PUT',
            headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ resource: 'parking-lot', id: lotDraft.id, data: lotDraft }),
         });
         if (res.ok) {
            const updated = await res.json();
            setLotDraft(updated);
            toast.success('Sede guardada');
         } else {
            const data = await res.json().catch(() => ({}));
            toast.error((data as { error?: string }).error || 'No se pudo guardar la sede');
         }
      } catch (err) {
         console.error(err);
         toast.error('Error guardando la sede');
      } finally {
         setSavingLot(false);
      }
   };

  const handleUpdateRate = async (rate: Rate) => {
    setSaving(rate.id);
    try {
      const res = await fetch('/api/dashboard', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ resource: 'rates', id: rate.id, data: rate })
      });
      if (res.ok) fetchRates();
         else {
            const data = await res.json().catch(() => ({}));
            toast.error((data as { error?: string }).error || 'No se pudo actualizar la tarifa');
         }
      } catch (err) {
         console.error(err);
         toast.error('Error actualizando la tarifa');
      }
    finally { setSaving(null); }
  };

  const handleCreateRate = async () => {
    try {
      const res = await fetch('/api/dashboard', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ resource: 'rates', data: newRate })
      });
      if (res.ok) {
        setShowCreateRate(false);
        setNewRate({ name: '', vehicleType: 'CAR', price: 0 });
        fetchRates();
         } else {
            const data = await res.json().catch(() => ({}));
            toast.error((data as { error?: string }).error || 'No se pudo crear la tarifa');
         }
      } catch (err) {
         console.error(err);
         toast.error('Error creando la tarifa');
      }
  };

   if (!canManage) return <div style={{ height: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontWeight: 800 }}>Acceso restringido a administradores.</div>;

   if (loading) return <div style={{ height: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner" /></div>;

  return (
    <div className="animate-premium" style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr', gap: '32px', paddingTop: '10px' }}>
      
      {/* LEFT COLUMN: Main Configs */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        
        {/* Sede Config */}
        <div className="glass-card" style={{ padding: '40px' }}>
           <h3 style={{ fontSize: '20px', fontWeight: 900, marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Building size={24} color="var(--accent-gold)" /> Configuración de Sede
           </h3>
           {!lotDraft ? (
             <div style={{ color: 'var(--text-muted)', fontWeight: 700 }}>No hay sede asignada.</div>
           ) : (
             <>
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
                  <div className="form-group">
                     <label className="input-label" style={{ marginBottom: '10px' }}>Nombre de la Sede</label>
                     <input className="white-card" style={{ border: 'none', padding: '16px', width: '100%', fontSize: '14px', fontWeight: 700 }} value={lotDraft.name} onChange={e => setLotDraft({ ...lotDraft, name: e.target.value })} />
                  </div>
                  <div className="form-group">
                     <label className="input-label" style={{ marginBottom: '10px' }}>Ciudad</label>
                     <input className="white-card" style={{ border: 'none', padding: '16px', width: '100%', fontSize: '14px', fontWeight: 700 }} value={lotDraft.city} onChange={e => setLotDraft({ ...lotDraft, city: e.target.value })} />
                  </div>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                     <label className="input-label" style={{ marginBottom: '10px' }}>Dirección</label>
                     <input className="white-card" style={{ border: 'none', padding: '16px', width: '100%', fontSize: '14px', fontWeight: 700 }} value={lotDraft.address} onChange={e => setLotDraft({ ...lotDraft, address: e.target.value })} />
                  </div>
                  <div className="form-group">
                     <label className="input-label" style={{ marginBottom: '10px' }}>Teléfono</label>
                     <input className="white-card" style={{ border: 'none', padding: '16px', width: '100%', fontSize: '14px', fontWeight: 700 }} value={lotDraft.phone || ''} onChange={e => setLotDraft({ ...lotDraft, phone: e.target.value })} />
                  </div>
                  <div className="form-group">
                     <label className="input-label" style={{ marginBottom: '10px' }}>Estado</label>
                     <select className="white-card" style={{ border: 'none', padding: '16px', width: '100%', fontSize: '14px', fontWeight: 800 }} value={lotDraft.isActive ? 'ACTIVE' : 'INACTIVE'} onChange={e => setLotDraft({ ...lotDraft, isActive: e.target.value === 'ACTIVE' })}>
                       <option value="ACTIVE">Activa</option>
                       <option value="INACTIVE">Inactiva</option>
                     </select>
                  </div>
               </div>
               <button className="btn-primary" style={{ padding: '0 32px', height: '56px' }} onClick={handleSaveLot} disabled={savingLot}>
                 {savingLot ? 'Guardando…' : 'Actualizar Información'}
               </button>
             </>
           )}
        </div>

        {/* Rates Table */}
        <div className="glass-card" style={{ padding: '40px' }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '12px' }}>
                 <Banknote size={24} color="var(--accent-gold)" /> Tarifario Maestro
              </h3>
              <button className="white-card" style={{ padding: '0 20px', height: '40px', display: 'flex', alignItems: 'center', gap: '8px', border: 'none', cursor: 'pointer', fontWeight: 800 }} onClick={() => setShowCreateRate(true)}>
                 <PlusCircle size={16} /> NUEVA
              </button>
           </div>
           
           <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {rates.map(r => (
                <div key={r.id} className="white-card" style={{ padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                         {r.vehicleType === 'CAR' ? <Car size={24} color="var(--accent-gold)" /> : <Bike size={24} color="var(--accent-gold)" />}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                         <span style={{ fontSize: '15px', fontWeight: 900 }}>{r.name}</span>
                         <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>COBRO POR HORA FRACCIÓN</span>
                      </div>
                   </div>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                      <div style={{ textAlign: 'right' }}>
                         <input type="number" className="white-card" style={{ width: '120px', border: 'none', textAlign: 'right', padding: '12px', fontSize: '16px', fontWeight: 900 }} value={r.price} onChange={e => setRates(rates.map(x => x.id === r.id ? { ...x, price: Number(e.target.value) } : x))} />
                      </div>
                      <button onClick={() => handleUpdateRate(r)} className="white-card" style={{ width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', color: 'var(--accent-primary)' }}>
                         {saving === r.id ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                      </button>
                   </div>
                </div>
              ))}
           </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Policies & System */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
         
         {/* Operations Policy */}
         <div className="glass-card" style={{ padding: '40px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 900, marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '12px' }}>
               <Clock size={22} color="var(--accent-gold)" /> Políticas de Operación
            </h3>
            {!lotDraft ? (
              <div style={{ color: 'var(--text-muted)', fontWeight: 700 }}>No hay sede asignada.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                 <div className="form-group">
                    <label className="input-label">Tiempo de Gracia (min)</label>
                    <input
                      type="number"
                      min={0}
                      className="white-card"
                      style={{ border: 'none', padding: '16px', width: '100%', fontSize: '15px', fontWeight: 900 }}
                      value={lotDraft.gracePeriod}
                      onChange={e => setLotDraft({ ...lotDraft, gracePeriod: Number(e.target.value) })}
                    />
                 </div>
                 <div className="form-group">
                    <label className="input-label">Penalidad por pérdida de ticket</label>
                    <input
                      type="number"
                      min={0}
                      className="white-card"
                      style={{ border: 'none', padding: '16px', width: '100%', fontSize: '15px', fontWeight: 900 }}
                      value={lotDraft.lostTicketFee}
                      onChange={e => setLotDraft({ ...lotDraft, lostTicketFee: Number(e.target.value) })}
                    />
                 </div>
                 <button className="btn-dark" style={{ height: '56px', borderRadius: '16px' }} onClick={handleSaveLot} disabled={savingLot}>
                   {savingLot ? 'Guardando…' : 'Guardar Políticas'}
                 </button>
              </div>
            )}
         </div>

         {/* System Telemetry */}
         <div className="glass-card" style={{ padding: '40px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 900, marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '12px' }}>
               <Globe size={22} color="var(--accent-gold)" /> Telemetría del Sistema
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
               {[
                 { k: 'Environment', v: telemetry?.env || '—' },
                 { k: 'Node.js', v: telemetry?.node || '—' },
                 { k: 'Prisma Client', v: telemetry?.prisma || '—' },
                 { k: 'DB Version', v: telemetry?.db ? String(telemetry.db).split('\n')[0] : '—' },
                 { k: 'Uptime', v: telemetry ? formatUptime(telemetry.uptimeSeconds) : '—' },
               ].map(item => (
                 <div key={item.k} style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', background: 'white', borderRadius: '16px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-muted)' }}>{item.k}</span>
                    <span style={{ fontSize: '13px', fontWeight: 900 }}>{item.v}</span>
                 </div>
               ))}
            </div>
         </div>
      </div>

      {/* Modal Nueva Tarifa */}
      {showCreateRate && (
        <div className="modal-overlay" onClick={() => setShowCreateRate(false)}>
           <div className="modal-content-premium animate-premium" style={{ maxWidth: '440px' }} onClick={e => e.stopPropagation()}>
              <h3 style={{ fontSize: '24px', fontWeight: 900, marginBottom: '32px' }}>Nueva Tarifa</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '32px' }}>
                 <div className="form-group">
                    <label className="input-label">Nombre</label>
                    <input
                      autoFocus
                      className="white-card"
                      style={{ border: 'none', padding: '18px', width: '100%', fontSize: '14px', fontWeight: 800 }}
                      placeholder="Ej: Nocturna"
                      value={newRate.name}
                      onChange={e => setNewRate({ ...newRate, name: e.target.value })}
                    />
                 </div>
                 <div className="form-group">
                    <label className="input-label">Tipo de vehículo</label>
                    <select
                      className="white-card"
                      style={{ border: 'none', padding: '18px', width: '100%', fontSize: '14px', fontWeight: 800 }}
                      value={newRate.vehicleType}
                      onChange={e => setNewRate({ ...newRate, vehicleType: e.target.value })}
                    >
                      <option value="CAR">Automóvil</option>
                      <option value="MOTORCYCLE">Motocicleta</option>
                      <option value="VAN">Camioneta / Van</option>
                      <option value="TRUCK">Camión</option>
                      <option value="ELECTRIC">Eléctrico</option>
                      <option value="BICYCLE">Bicicleta</option>
                    </select>
                 </div>
                 <div className="form-group">
                    <label className="input-label">Precio por hora</label>
                    <input
                      className="white-card"
                      type="number"
                      min={0}
                      style={{ border: 'none', padding: '18px', width: '100%', fontSize: '14px', fontWeight: 800 }}
                      placeholder="Precio"
                      value={newRate.price}
                      onChange={e => setNewRate({ ...newRate, price: Number(e.target.value) })}
                    />
                 </div>
              </div>

              <button className="btn-primary" style={{ width: '100%', height: '60px' }} onClick={handleCreateRate} disabled={!newRate.name || newRate.price <= 0}>
                 Activar Tarifa
              </button>
           </div>
        </div>
      )}
    </div>
  );
}
