'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  MapPin, 
  Car, 
  MoreHorizontal, 
  Calendar, 
  Clock, 
  Thermometer, 
  Droplets,
  Zap
} from 'lucide-react';
import { AIPredictionWidget } from '@/components/dashboard/AIPredictionWidget';
import { AIChatAssistant } from '@/components/dashboard/AIChatAssistant';

export default function DashboardPage() {
  const [activeZone, setActiveZone] = useState('Zone A');
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard?resource=stats', { 
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` } 
      });
      if (res.ok) setStats(await res.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <div style={{ height: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner" /></div>;

  return (
    <div className="animate-premium" style={{ display: 'grid', gridTemplateColumns: '2.4fr 1fr', gap: '32px', paddingTop: '10px' }}>
      
      {/* LEFT COLUMN: Main Parking Map */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        <div className="glass-card" style={{ padding: '40px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '40px' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
               <h2 style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>Sede Principal · Centro</h2>
               <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Panel de control interactivo de infraestructura</span>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
               <button className="white-card" style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}><MoreHorizontal size={18} /></button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px', marginBottom: '40px' }}>
            {['Zone A', 'Zone B', 'Zone C', 'Zone D'].map(zone => (
              <button 
                key={zone}
                onClick={() => setActiveZone(zone)}
                className={activeZone === zone ? 'btn-primary' : ''}
                style={{ 
                   flex: 1, padding: '16px', borderRadius: 'var(--radius-pill)', border: 'none',
                   fontSize: '14px', fontWeight: 800, cursor: 'pointer', transition: 'all 0.3s ease',
                   background: activeZone === zone ? 'var(--accent-gold)' : 'white',
                   color: activeZone === zone ? 'var(--text-primary)' : 'var(--text-muted)',
                   boxShadow: activeZone === zone ? '0 8px 24px rgba(233, 185, 73, 0.4)' : 'none'
                }}
              >
                {zone}
              </button>
            ))}
          </div>

          {/* Grid Map Simulation */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '24px' }}>
             {[...Array(15)].map((_, i) => {
               const isOccupied = i % 3 !== 0;
               const isSelected = i === 12;
               return (
                 <div key={i} className="white-card" style={{ 
                    padding: '32px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px',
                    border: isSelected ? '3px solid var(--accent-gold)' : '2px solid transparent',
                    background: isSelected ? 'rgba(233, 185, 73, 0.08)' : 'white',
                    transition: 'all 0.3s ease',
                    position: 'relative',
                    cursor: 'pointer'
                 }}>
                   {isOccupied ? (
                     <div style={{ position: 'relative' }}>
                        <Car size={36} color="var(--text-primary)" strokeWidth={2.5} />
                        <div style={{ position: 'absolute', top: -4, right: -6, width: '10px', height: '10px', background: 'var(--accent-danger)', borderRadius: '50%', border: '2px solid white' }} />
                     </div>
                   ) : (
                     <div style={{ width: '36px', height: '36px', border: '2px dashed #e2e8f0', borderRadius: '8px' }} />
                   )}
                   <span style={{ fontSize: '13px', fontWeight: 900, color: isOccupied ? 'var(--text-primary)' : 'var(--text-muted)' }}>A{i + 1}</span>
                 </div>
               );
             })}
          </div>
        </div>

        {/* Bottom Small Cards Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.8fr 1.2fr', gap: '32px' }}>
          
          {/* Environmental Info */}
          <div className="glass-card" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
               <h3 style={{ fontSize: '15px', fontWeight: 800 }}>Información Ambiental</h3>
               <MoreHorizontal size={16} color="var(--text-muted)" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
               <div className="white-card" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                     <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Temperatura</span>
                     <span style={{ fontSize: '20px', fontWeight: 900 }}>25°C</span>
                  </div>
                  <Thermometer size={20} color="var(--accent-gold)" />
               </div>
               <div className="white-card" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                     <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Humedad</span>
                     <span style={{ fontSize: '20px', fontWeight: 900 }}>60%</span>
                  </div>
                  <Droplets size={20} color="var(--accent-gold)" />
               </div>
            </div>
          </div>

          {/* Current Parked Detail */}
          <div className="glass-card" style={{ padding: '32px', position: 'relative', overflow: 'hidden' }}>
             <div style={{ position: 'absolute', bottom: '-20px', left: '0', right: '0', textAlign: 'center', opacity: 0.05, zIndex: 0 }}>
                <Car size={180} strokeWidth={1} />
             </div>
             <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 800 }}>Vehículo Seleccionado</h3>
                  <MoreHorizontal size={16} color="var(--text-muted)" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '28px' }}>
                   <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>Tarifa Actual</div>
                      <div style={{ fontSize: '15px', fontWeight: 900 }}>$5.000 / h</div>
                   </div>
                   <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>N° Placa</div>
                      <div style={{ fontSize: '15px', fontWeight: 900 }}>XY68ZTR</div>
                   </div>
                   <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>Espacio</div>
                      <div style={{ fontSize: '15px', fontWeight: 900 }}>Slot A13</div>
                   </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                   <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>TIEMPO TRANSCURRIDO</div>
                      <div style={{ fontSize: '36px', fontWeight: 900, fontFamily: 'monospace', color: 'var(--text-primary)' }}>03:02:39</div>
                   </div>
                   <button className="btn-primary" style={{ padding: '12px 32px', fontSize: '13px', fontWeight: 900, border: 'none', cursor: 'pointer', borderRadius: '14px' }}>Cobrar Salida</button>
                </div>
             </div>
          </div>

          {/* Noise Level */}
          <div className="glass-card" style={{ padding: '32px' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
               <h3 style={{ fontSize: '15px', fontWeight: 800 }}>Nivel de Ruido</h3>
               <MoreHorizontal size={16} color="var(--text-muted)" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', justifyContent: 'center', height: '110px' }}>
               <Zap size={48} color="var(--accent-gold)" style={{ opacity: 0.1 }} />
               <div style={{ fontSize: '24px', fontWeight: 900 }}>45 dB</div>
               <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--accent-success)' }}>NIVEL ÓPTIMO</span>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Stats and AI */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        
        {/* AI Prediction Widget */}
        <AIPredictionWidget />

        {/* Parking Overview Chart */}
        <div className="glass-card" style={{ padding: '40px' }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '40px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 800 }}>Resumen de Ocupación</h3>
              <MoreHorizontal size={20} color="var(--text-muted)" />
           </div>
           
           <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '100px', marginBottom: '40px' }}>
              {[...Array(18)].map((_, i) => (
                <div key={i} style={{ 
                  flex: 1, height: `${Math.random() * 80 + 20}%`, 
                  background: i < 14 ? 'var(--accent-gold)' : '#e2e8f0',
                  borderRadius: '4px',
                  transition: 'height 1s ease-out'
                }} />
              ))}
           </div>

           <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="white-card" style={{ padding: '20px', display: 'flex', gap: '16px', alignItems: 'center' }}>
                 <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(233, 185, 73, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <MapPin size={20} color="var(--accent-gold)" />
                 </div>
                 <div>
                    <div style={{ fontSize: '15px', fontWeight: 900 }}>Zona A</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>Zona más utilizada</div>
                 </div>
              </div>
              <div className="white-card" style={{ padding: '20px', display: 'flex', gap: '16px', alignItems: 'center' }}>
                 <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Clock size={20} color="var(--text-primary)" />
                 </div>
                 <div>
                    <div style={{ fontSize: '15px', fontWeight: 900 }}>2h 15m</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>Estancia Promedio</div>
                 </div>
              </div>
           </div>
        </div>

        {/* Early Reservation Form */}
        <div className="glass-card" style={{ padding: '40px' }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '40px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 800 }}>Reserva Anticipada</h3>
              <MoreHorizontal size={20} color="var(--text-muted)" />
           </div>

           <div className="form-group" style={{ marginBottom: '28px' }}>
              <label className="input-label" style={{ marginBottom: '14px' }}>Fecha de Reserva</label>
              <div style={{ position: 'relative' }}>
                 <input className="white-card" style={{ border: 'none', padding: '18px', width: '100%', fontSize: '15px', fontWeight: 800, cursor: 'pointer' }} defaultValue="23 de Septiembre, 2025" />
                 <Calendar size={20} style={{ position: 'absolute', right: '18px', top: '16px', color: 'var(--text-muted)' }} />
              </div>
           </div>

           <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '40px' }}>
              <div className="form-group">
                 <label className="input-label" style={{ marginBottom: '14px' }}>Entrada</label>
                 <input className="white-card" style={{ border: 'none', padding: '18px', width: '100%', fontSize: '15px', fontWeight: 800 }} defaultValue="12:00 PM" />
              </div>
              <div className="form-group">
                 <label className="input-label" style={{ marginBottom: '14px' }}>Salida</label>
                 <input className="white-card" style={{ border: 'none', padding: '18px', width: '100%', fontSize: '15px', fontWeight: 800 }} defaultValue="03:00 PM" />
              </div>
           </div>

           <button className="btn-primary" style={{ width: '100%', height: '64px', fontSize: '16px', fontWeight: 900, borderRadius: 'var(--radius-md)' }}>
              Confirmar Reserva
           </button>
        </div>
      </div>

      <AIChatAssistant />
    </div>
  );
}
