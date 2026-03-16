'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, X, Send, Bot, User, HelpCircle } from 'lucide-react';
import toast from 'react-hot-toast';

type DashboardStats = {
  occupancyRate?: number;
  totalSpaces?: number;
  occupiedSpaces?: number;
  availableSpaces?: number;
  reservedSpaces?: number;
  maintenanceSpaces?: number;
  todayVehicles?: number;
  parkingLot?: { name?: string };
};

type Zone = {
  id: string;
  name: string;
  spaces: Array<{ status: string }>;
};

export function AIChatAssistant() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hola. Puedo mostrar métricas en vivo y abrir módulos. Escribe "ayuda" para ver comandos.' }
  ]);
  const [input, setInput] = useState('');

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loadingContext, setLoadingContext] = useState(false);

  const headers = useMemo(() => ({ Authorization: `Bearer ${localStorage.getItem('accessToken')}` }), []);

  const loadContext = useCallback(async () => {
    setLoadingContext(true);
    try {
      const [statsRes, zonesRes] = await Promise.all([
        fetch('/api/dashboard?resource=stats', { headers }),
        fetch('/api/dashboard?resource=zones', { headers }),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (zonesRes.ok) setZones(await zonesRes.json());
    } catch (err) {
      console.error(err);
      toast.error('No se pudo cargar el contexto del asistente');
    } finally {
      setLoadingContext(false);
    }
  }, [headers]);

  useEffect(() => {
    if (!isOpen) return;
    void loadContext();
  }, [isOpen, loadContext]);

  const pushAssistant = (text: string) => setMessages((prev) => [...prev, { role: 'assistant', text }]);

  const zoneSummary = useCallback(() => {
    if (!zones.length) return 'No hay zonas cargadas.';
    const metrics = zones.map((z) => {
      const total = z.spaces.length;
      const occupied = z.spaces.filter((s) => s.status === 'OCCUPIED').length;
      const occupancy = total ? Math.round((occupied / total) * 100) : 0;
      return { name: z.name, total, occupied, occupancy };
    }).sort((a, b) => b.occupancy - a.occupancy);
    const top = metrics.slice(0, 3).map((m) => `- ${m.name}: ${m.occupancy}% (${m.occupied}/${m.total})`).join('\n');
    return `Top zonas por ocupación:\n${top}`;
  }, [zones]);

  const helpText = useMemo(() => {
    return [
      'Comandos disponibles:',
      '- ayuda',
      '- ocupacion',
      '- zonas',
      '- actualizar',
      '- ir tickets | ir turnos | ir reportes | ir pagos | ir suscripciones | ir usuarios | ir vehiculos | ir auditoria | ir mapa | ir notificaciones',
    ].join('\n');
  }, []);

  const handleCommand = useCallback(async (raw: string) => {
    const text = raw.trim();
    const cmd = text.toLowerCase();

    if (!cmd) return;

    if (cmd === 'ayuda' || cmd === 'help' || cmd === '?' || cmd === 'comandos') {
      pushAssistant(helpText);
      return;
    }

    if (cmd === 'actualizar' || cmd === 'refresh' || cmd === 'recargar') {
      await loadContext();
      pushAssistant('Listo. Datos actualizados.');
      return;
    }

    if (cmd.includes('ocupacion')) {
      const lotName = stats?.parkingLot?.name ? ` (${stats.parkingLot.name})` : '';
      pushAssistant(
        `Ocupación${lotName}: ${stats?.occupancyRate ?? 0}%\n` +
        `- Ocupados: ${stats?.occupiedSpaces ?? 0}/${stats?.totalSpaces ?? 0}\n` +
        `- Disponibles: ${stats?.availableSpaces ?? 0}\n` +
        `- Reservados: ${stats?.reservedSpaces ?? 0}\n` +
        `- Mantenimiento: ${stats?.maintenanceSpaces ?? 0}\n` +
        `- Vehículos hoy: ${stats?.todayVehicles ?? 0}`
      );
      return;
    }

    if (cmd === 'zonas' || cmd.startsWith('zona')) {
      pushAssistant(zoneSummary());
      return;
    }

    if (cmd.startsWith('ir ')) {
      const target = cmd.replace(/^ir\s+/, '').replace(/^a\s+/, '').trim();
      const routes: Record<string, string> = {
        'tickets': '/dashboard/tickets',
        'turnos': '/dashboard/shifts',
        'reportes': '/dashboard/reports',
        'pagos': '/dashboard/payments',
        'suscripciones': '/dashboard/subscriptions',
        'usuarios': '/dashboard/users',
        'vehiculos': '/dashboard/vehicles',
        'vehículos': '/dashboard/vehicles',
        'auditoria': '/dashboard/audit',
        'auditoría': '/dashboard/audit',
        'mapa': '/dashboard/parking-map',
        'notificaciones': '/dashboard/notifications',
        'mensajes': '/dashboard/messages',
        'gestion': '/dashboard/management',
        'gestión': '/dashboard/management',
        'configuracion': '/dashboard/settings',
        'configuración': '/dashboard/settings',
        'dashboard': '/dashboard',
      };
      const route = routes[target];
      if (!route) {
        pushAssistant(`No reconozco el destino "${target}".\n\n${helpText}`);
        return;
      }
      pushAssistant(`Abriendo ${route}...`);
      router.push(route);
      return;
    }

    pushAssistant(`No entendí "${text}".\n\n${helpText}`);
  }, [helpText, loadContext, pushAssistant, router, stats, zoneSummary]);

  const send = () => {
    if (!input) return;
    const text = input;
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setInput('');
    void handleCommand(text);
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
                <div style={{ fontSize: '15px', fontWeight: 900 }}>Asistente</div>
                <div style={{ fontSize: '10px', opacity: 0.6, fontWeight: 800 }}>
                  {loadingContext ? 'ACTUALIZANDO DATOS…' : 'COMANDOS RÁPIDOS'}
                </div>
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
               placeholder="Escribe un comando (ej: ocupacion, zonas, ir tickets)…"
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
                {input.trim().toLowerCase() === 'ayuda' ? <HelpCircle size={18} /> : <Send size={18} />}
             </button>
          </div>
        </div>
      )}
    </>
  );
}
