'use client';

import React, { useState, useEffect } from 'react';
import { Zap, TrendingUp, Info } from 'lucide-react';
import toast from 'react-hot-toast';

export function AIPredictionWidget() {
  const [occupancy, setOccupancy] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/dashboard?resource=stats', {
          headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
        });
        if (!res.ok) {
          toast.error('No se pudo cargar el pronóstico');
          return;
        }
        const data = await res.json();
        setOccupancy(data.occupancyRate);
      } catch (err) {
        console.error(err);
        toast.error('Error de conexión');
      }
      finally { setLoading(false); }
    };
    fetchStats();
  }, []);

  const getPrediction = () => {
    if (occupancy > 80) return { title: 'Saturación Inminente', msg: 'Se recomienda habilitar tarifas dinámicas (+15%) para gestionar la alta demanda.', peak: '15 min' };
    if (occupancy > 50) return { title: 'Flujo Moderado', msg: 'La tendencia indica estabilidad para las próximas 3 horas. No se requieren ajustes.', peak: '2h 30m' };
    return { title: 'Demanda Baja', msg: 'Oportunidad para lanzar promociones relámpago y aumentar la rotación.', peak: 'Sin pico' };
  };

  const predict = getPrediction();

  return (
    <div className="glass-card" style={{ 
      padding: '32px', 
      background: 'linear-gradient(135deg, var(--text-primary) 0%, #2a2a2a 100%)',
      color: 'white',
      position: 'relative',
      overflow: 'hidden',
      transition: 'all 0.5s ease'
    }}>
      <div style={{ position: 'absolute', top: '-10px', right: '-10px', opacity: 0.1 }}>
         <Zap size={100} color="var(--accent-gold)" />
      </div>
      
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
          <div style={{ padding: '6px', borderRadius: '8px', background: 'rgba(233, 185, 73, 0.2)', color: 'var(--accent-gold)' }}>
             <Zap size={16} />
          </div>
          <span style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '1px' }}>ANALIZANDO DATOS EN VIVO...</span>
        </div>

        {loading ? (
          <div style={{ height: '80px', display: 'flex', alignItems: 'center' }}>
            <div className="spinner" style={{ borderTopColor: 'var(--accent-gold)' }} />
          </div>
        ) : (
          <>
            <h3 style={{ fontSize: '20px', fontWeight: 900, marginBottom: '8px' }}>{predict.title}</h3>
            <p style={{ fontSize: '13px', opacity: 0.7, marginBottom: '24px', lineHeight: 1.5 }}>
              {predict.msg}
            </p>

            <div className="white-card" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <TrendingUp size={20} color="var(--accent-gold)" />
                  <div style={{ fontSize: '14px', fontWeight: 700 }}>Próximo Pico: {predict.peak}</div>
               </div>
               <Info size={16} style={{ opacity: 0.4 }} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

