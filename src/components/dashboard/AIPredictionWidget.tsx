'use client';

import React from 'react';
import { Zap, TrendingUp, Info } from 'lucide-react';

export function AIPredictionWidget() {
  return (
    <div className="glass-card" style={{ 
      padding: '32px', 
      background: 'linear-gradient(135deg, var(--text-primary) 0%, #2a2a2a 100%)',
      color: 'white',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div style={{ position: 'absolute', top: '-10px', right: '-10px', opacity: 0.1 }}>
         <Zap size={100} color="var(--accent-gold)" />
      </div>
      
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
          <div style={{ padding: '6px', borderRadius: '8px', background: 'rgba(233, 185, 73, 0.2)', color: 'var(--accent-gold)' }}>
             <Zap size={16} />
          </div>
          <span style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '1px' }}>PREDICCIÓN AI</span>
        </div>

        <h3 style={{ fontSize: '20px', fontWeight: 900, marginBottom: '8px' }}>Ocupación Crítica</h3>
        <p style={{ fontSize: '13px', opacity: 0.7, marginBottom: '24px', lineHeight: 1.5 }}>
          Se espera un incremento del 40% en la demanda para las próximas 2 horas debido a eventos locales.
        </p>

        <div className="white-card" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <TrendingUp size={20} color="var(--accent-gold)" />
              <div style={{ fontSize: '14px', fontWeight: 700 }}>Hora Pico: 4:30 PM</div>
           </div>
           <Info size={16} style={{ opacity: 0.4 }} />
        </div>
      </div>
    </div>
  );
}
