'use client';

import React, { useState } from 'react';
import { Sparkles, X, Send, Bot, User } from 'lucide-react';

export function AIChatAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', text: '¡Hola! Soy Parky, tu asistente de ParkingOS. ¿En qué puedo ayudarte hoy?' }
  ]);
  const [input, setInput] = useState('');

  const send = () => {
    if (!input) return;
    setMessages([...messages, { role: 'user', text: input }]);
    setInput('');
    // Simulated AI response
    setTimeout(() => {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        text: 'Analizando infraestructura... He detectado que la Zona B está al 90% de su capacidad. ¿Deseas redirigir nuevos ingresos a la Zona D?' 
      }]);
    }, 1000);
  };

  return (
    <>
      {/* Floating Button */}
      <button 
        onClick={() => setIsOpen(true)}
        style={{ 
          position: 'fixed', bottom: '40px', right: '40px',
          width: '64px', height: '64px', borderRadius: '24px',
          background: 'var(--text-primary)', color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)', cursor: 'pointer',
          border: '4px solid white', zIndex: 1000,
          transition: 'all 0.3s ease'
        }}
        className="hover-premium"
      >
        <Sparkles size={28} color="var(--accent-gold)" />
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="animate-premium" style={{ 
          position: 'fixed', bottom: '120px', right: '40px',
          width: '380px', height: '520px', borderRadius: '32px',
          background: 'white', boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          display: 'flex', flexDirection: 'column', zIndex: 1001,
          overflow: 'hidden', border: '1px solid var(--border-color)'
        }}>
          {/* Header */}
          <div style={{ 
            padding: '24px', background: 'var(--text-primary)', color: 'white',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
               <div style={{ padding: '8px', borderRadius: '12px', background: 'rgba(233, 185, 73, 0.2)' }}>
                  <Bot size={20} color="var(--accent-gold)" />
               </div>
               <div>
                  <div style={{ fontSize: '15px', fontWeight: 900 }}>Parky AI</div>
                  <div style={{ fontSize: '10px', opacity: 0.6, fontWeight: 800 }}>ASISTENTE INTELIGENTE</div>
               </div>
            </div>
            <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
               <X size={20} />
            </button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {messages.map((m, i) => (
              <div key={i} style={{ 
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '80%',
                display: 'flex', gap: '10px',
                flexDirection: m.role === 'user' ? 'row-reverse' : 'row'
              }}>
                <div style={{ 
                  width: '28px', height: '28px', borderRadius: '50%', 
                  background: m.role === 'user' ? 'var(--accent-gold)' : 'var(--bg-primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '10px', fontWeight: 900
                }}>
                  {m.role === 'user' ? <User size={14} color="white" /> : <Bot size={14} />}
                </div>
                <div style={{ 
                  padding: '12px 16px', borderRadius: '16px',
                  background: m.role === 'user' ? 'var(--text-primary)' : 'var(--bg-primary)',
                  color: m.role === 'user' ? 'white' : 'var(--text-primary)',
                  fontSize: '13px', fontWeight: 600, lineHeight: 1.4
                }}>
                  {m.text}
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          <div style={{ padding: '24px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '12px' }}>
             <input 
               className="white-card" 
               style={{ flex: 1, border: 'none', padding: '12px 16px', fontSize: '14px', fontWeight: 700 }}
               placeholder="Escribe un comando..."
               value={input}
               onChange={e => setInput(e.target.value)}
               onKeyDown={e => e.key === 'Enter' && send()}
             />
             <button 
               onClick={send}
               style={{ 
                 width: '44px', height: '44px', borderRadius: '14px', 
                 background: 'var(--accent-gold)', border: 'none', color: 'white',
                 display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
               }}
             >
                <Send size={18} />
             </button>
          </div>
        </div>
      )}
    </>
  );
}
