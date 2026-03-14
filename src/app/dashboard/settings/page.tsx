'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Building, 
  Clock, 
  Banknote, 
  Settings, 
  Car, 
  Bike, 
  Truck, 
  Loader2, 
  Save, 
  Trash2, 
  Globe, 
  PlusCircle,
  Shield,
  CreditCard,
  History,
  Info,
  ChevronRight
} from 'lucide-react';

interface Rate {
  id: string; name: string; vehicleType: string; price: number; isActive: boolean;
}

export default function SettingsPage() {
  const [rates, setRates] = useState<Rate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [showCreateRate, setShowCreateRate] = useState(false);
  const [newRate, setNewRate] = useState({ name: '', vehicleType: 'CAR', price: 0 });
  const router = useRouter();

  useEffect(() => {
    fetchRates();
  }, []);

  const fetchRates = async () => {
    try {
      const res = await fetch('/api/dashboard?resource=rates', { 
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` } 
      });
      if (res.ok) setRates(await res.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
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
    } catch (err) { console.error(err); }
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
      }
    } catch (err) { console.error(err); }
  };

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
           <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
              {[
                { label: 'Nombre Legal', val: 'Parkzone Downtown Plaza' },
                { label: 'NIT / Tax ID', val: '900.234.567-1' },
                { label: 'Ciudad', val: 'Bogotá D.C.' },
                { label: 'Dirección', val: 'Calle 100 #15-30' },
              ].map(item => (
                <div key={item.label} className="form-group">
                   <label className="input-label" style={{ marginBottom: '10px' }}>{item.label}</label>
                   <input className="white-card" style={{ border: 'none', padding: '16px', width: '100%', fontSize: '14px', fontWeight: 700 }} defaultValue={item.val} />
                </div>
              ))}
           </div>
           <button className="btn-primary" style={{ padding: '0 32px', height: '56px' }}>Actualizar Información</button>
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
               <Clock size={22} color="var(--accent-gold)" /> Políticas de Tiempo
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
               <div className="form-group">
                  <label className="input-label">Tiempo de Gracia (Min)</label>
                  <input className="white-card" style={{ border: 'none', padding: '16px', width: '100%', fontSize: '15px', fontWeight: 900 }} defaultValue="15" />
               </div>
               <div className="form-group">
                  <label className="input-label">Penalidad por Pérdida de Ticket</label>
                  <input className="white-card" style={{ border: 'none', padding: '16px', width: '100%', fontSize: '15px', fontWeight: 900 }} defaultValue="25000" />
               </div>
               <button className="btn-dark" style={{ height: '56px', borderRadius: '16px' }}>Guardar Políticas</button>
            </div>
         </div>

         {/* System Telemetry */}
         <div className="glass-card" style={{ padding: '40px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 900, marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '12px' }}>
               <Globe size={22} color="var(--accent-gold)" /> Telemetría del Sistema
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
               {[
                 { k: 'Cloud Node', v: 'Bogotá (BOG-1)' },
                 { k: 'DB Engine', v: 'PGSQL 17.2' },
                 { k: 'AI Engine', v: 'ParkBrain v2' },
                 { k: 'Uptime', v: '99.98%' },
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
                 <input className="white-card" style={{ border: 'none', padding: '18px', width: '100%', fontSize: '14px', fontWeight: 800 }} placeholder="Nombre (Ej: Nocturna)" value={newRate.name} onChange={e => setNewRate({ ...newRate, name: e.target.value })} />
                 <select className="white-card" style={{ border: 'none', padding: '18px', width: '100%', fontSize: '14px', fontWeight: 800 }} value={newRate.vehicleType} onChange={e => setNewRate({ ...newRate, vehicleType: e.target.value })}>
                    <option value="CAR">Automóvil</option>
                    <option value="MOTORCYCLE">Motocicleta</option>
                 </select>
                 <input className="white-card" type="number" style={{ border: 'none', padding: '18px', width: '100%', fontSize: '14px', fontWeight: 800 }} placeholder="Precio por hora" value={newRate.price} onChange={e => setNewRate({ ...newRate, price: Number(e.target.value) })} />
              </div>
              <button className="btn-primary" style={{ width: '100%', height: '60px' }} onClick={handleCreateRate}>Activar Tarifa</button>
           </div>
        </div>
      )}
    </div>
  );
}
