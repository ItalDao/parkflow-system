'use client';

import { useState } from 'react';
import { 
  MessageSquare, 
  Search, 
  Send, 
  User, 
  Bell, 
  MoreHorizontal,
  Mail,
  UserCheck
} from 'lucide-react';

export default function MessagesPage() {
  const [search, setSearch] = useState('');

  const chats = [
    { id: 1, name: 'Soporte Técnico', lastMsg: 'Su ticket #829 ha sido procesado.', time: '10:45 AM', unread: 2, online: true },
    { id: 2, name: 'Administración Sede Norte', lastMsg: 'Verificar cuadre de caja turno mañana.', time: '09:12 AM', unread: 0, online: true },
    { id: 3, name: 'Parky AI (Asistente)', lastMsg: '¿Necesitas ayuda con los reportes?', time: 'Ayer', unread: 0, online: true },
    { id: 4, name: 'Recursos Humanos', lastMsg: 'Documentación para nuevo ingreso.', time: 'Lunes', unread: 0, online: false },
  ];

  return (
    <div className="animate-premium" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '32px', height: 'calc(100vh - 160px)', paddingTop: '10px' }}>
      
      {/* Sidebar: Chat List */}
      <div className="glass-card" style={{ padding: '0', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '32px', borderBottom: '1px solid var(--border-color)' }}>
           <h2 style={{ fontSize: '24px', fontWeight: 900, marginBottom: '24px' }}>Centro de Mensajes</h2>
           <div style={{ position: 'relative' }}>
              <input className="white-card" style={{ border: 'none', padding: '12px 16px 12px 48px', width: '100%', fontSize: '13px', fontWeight: 700 }} placeholder="Buscar chat..." value={search} onChange={e => setSearch(e.target.value)} />
              <Search size={18} style={{ position: 'absolute', left: '16px', top: '12px', color: 'var(--text-muted)' }} />
           </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
           {chats.map(chat => (
             <div key={chat.id} className="hover-premium" style={{ 
               padding: '20px', borderRadius: '24px', display: 'flex', gap: '16px', cursor: 'pointer',
               background: chat.id === 1 ? 'var(--bg-primary)' : 'transparent',
               border: chat.id === 1 ? '1px solid var(--border-color)' : '1px solid transparent',
               marginBottom: '8px'
             }}>
                <div style={{ position: 'relative' }}>
                   <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                      {chat.name[0]}
                   </div>
                   {chat.online && <div style={{ position: 'absolute', bottom: -2, right: -2, width: '12px', height: '12px', background: 'var(--accent-success)', borderRadius: '50%', border: '2px solid white' }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 900 }}>{chat.name}</span>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)' }}>{chat.time}</span>
                   </div>
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{chat.lastMsg}</span>
                      {chat.unread > 0 && <div style={{ padding: '2px 6px', background: 'var(--accent-gold)', borderRadius: '6px', fontSize: '10px', fontWeight: 900 }}>{chat.unread}</div>}
                   </div>
                </div>
             </div>
           ))}
        </div>
      </div>

      {/* Main: Chat View */}
      <div className="glass-card" style={{ padding: '0', display: 'flex', flexDirection: 'column' }}>
         <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
               <div style={{ width: '44px', height: '44px', borderRadius: '14px', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>S</div>
               <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '15px', fontWeight: 900 }}>Soporte Técnico</span>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--accent-success)' }}>OPERATIVO ONLINE</span>
               </div>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
               <button className="white-card" style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none' }}><Bell size={18} /></button>
               <button className="white-card" style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none' }}><MoreHorizontal size={18} /></button>
            </div>
         </div>

         <div style={{ flex: 1, overflowY: 'auto', padding: '40px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ alignSelf: 'flex-start', maxWidth: '70%' }}>
               <div className="white-card" style={{ padding: '20px 24px', borderRadius: '24px 24px 24px 4px', fontSize: '14px', fontWeight: 600, lineHeight: 1.6 }}>
                  Hola, hemos detectado una inconsistencia en el sensor de la Zona A, Espacio 12. ¿Puedes verificarlo físicamente?
               </div>
               <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 800, marginTop: '8px', marginLeft: '4px', display: 'block' }}>10:40 AM</span>
            </div>

            <div style={{ alignSelf: 'flex-end', maxWidth: '70%' }}>
               <div style={{ padding: '20px 24px', borderRadius: '24px 24px 4px 24px', background: 'var(--text-primary)', color: 'white', fontSize: '14px', fontWeight: 600, lineHeight: 1.6 }}>
                  Entendido. Voy hacia allá ahora mismo. Lo reportaré en el módulo de mantenimiento si es necesario.
               </div>
               <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 800, marginTop: '8px', marginRight: '4px', textAlign: 'right', display: 'block' }}>10:42 AM</span>
            </div>

            <div style={{ alignSelf: 'flex-start', maxWidth: '70%' }}>
               <div className="white-card" style={{ padding: '20px 24px', borderRadius: '24px 24px 24px 4px', fontSize: '14px', fontWeight: 600, lineHeight: 1.6 }}>
                  Perfecto. Quedo atento a la actualización. Su ticket #829 ha sido procesado.
               </div>
               <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 800, marginTop: '8px', marginLeft: '4px', display: 'block' }}>10:45 AM</span>
            </div>
         </div>

         <div style={{ padding: '32px', borderTop: '1px solid var(--border-color)' }}>
            <div style={{ position: 'relative' }}>
               <input className="white-card" style={{ border: 'none', padding: '20px 80px 20px 24px', width: '100%', fontSize: '14px', fontWeight: 700 }} placeholder="Escribe un mensaje aquí..." />
               <button className="btn-primary" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', width: '48px', height: '48px', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Send size={18} />
               </button>
            </div>
         </div>
      </div>
    </div>
  );
}
