'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Search, 
  Send, 
  Bell, 
   PlusCircle,
   X,
   MapPin
} from 'lucide-react';
import toast from 'react-hot-toast';

type JwtPayload = { role?: string; userId?: string };

type ParkingLotOption = { id: string; name: string };

type Person = { id: string; firstName: string; lastName: string; role: string; email: string };

type ConversationParticipant = {
   userId: string;
   lastReadAt: string | null;
   user: { id: string; firstName: string; lastName: string; role: string };
};

type ConversationListItem = {
   id: string;
   title: string | null;
   parkingLotId: string;
   updatedAt: string;
   participants: ConversationParticipant[];
   lastMessage: null | {
      id: string;
      body: string;
      createdAt: string;
      sender: { id: string; firstName: string; lastName: string };
   };
   unread: number;
};

type MessageData = {
   id: string;
   conversationId: string;
   senderId: string;
   body: string;
   createdAt: string;
   sender: { id: string; firstName: string; lastName: string; role: string };
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

function parseLots(data: unknown): ParkingLotOption[] {
   if (!Array.isArray(data)) return [];
   const out: ParkingLotOption[] = [];
   for (const item of data) {
      if (!item || typeof item !== 'object') continue;
      const rec = item as Record<string, unknown>;
      const id = rec.id;
      const name = rec.name;
      if (typeof id !== 'string' || typeof name !== 'string') continue;
      out.push({ id, name });
   }
   return out;
}

function formatTime(iso: string): string {
   const dt = new Date(iso);
   if (Number.isNaN(dt.getTime())) return '';
   return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function displayConversationTitle(c: ConversationListItem, currentUserId: string): string {
   const raw = (c.title || '').trim();
   if (raw) return raw;
   const others = c.participants
      .filter(p => p.userId !== currentUserId)
      .map(p => `${p.user.firstName} ${p.user.lastName}`.trim())
      .filter(Boolean);
   return others.length ? others.join(', ') : 'Conversación';
}

export default function MessagesPage() {
   const router = useRouter();
   const [search, setSearch] = useState('');
   const [role, setRole] = useState<string>('OPERATOR');
   const [currentUserId, setCurrentUserId] = useState<string>('');

   const [lots, setLots] = useState<ParkingLotOption[]>([]);
   const [selectedLotId, setSelectedLotId] = useState<string>('');

   const [conversations, setConversations] = useState<ConversationListItem[]>([]);
   const [activeConversationId, setActiveConversationId] = useState<string>('');
   const [messages, setMessages] = useState<MessageData[]>([]);

   const [people, setPeople] = useState<Person[]>([]);
   const [showCreate, setShowCreate] = useState(false);
   const [createTitle, setCreateTitle] = useState('');
   const [createParticipantIds, setCreateParticipantIds] = useState<string[]>([]);

   const [composer, setComposer] = useState('');
   const [loadingSidebar, setLoadingSidebar] = useState(true);
   const [loadingMessages, setLoadingMessages] = useState(false);

   const canManageAll = role === 'SUPER_ADMIN';

   const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('accessToken')}` });

   const loadLots = async (): Promise<ParkingLotOption[]> => {
      const res = await fetch('/api/dashboard?resource=lots', { headers: authHeaders() });
      if (!res.ok) return [];
      const data: unknown = await res.json();
      return parseLots(data);
   };

   const loadPeople = async (lotId?: string) => {
      const qs = lotId ? `&parkingLotId=${encodeURIComponent(lotId)}` : '';
      const res = await fetch(`/api/dashboard?resource=people${qs}`, { headers: authHeaders() });
      if (!res.ok) return;
      const data: unknown = await res.json();
      if (!Array.isArray(data)) return;
      const parsed: Person[] = [];
      for (const item of data) {
         if (!item || typeof item !== 'object') continue;
         const rec = item as Record<string, unknown>;
         if (typeof rec.id !== 'string') continue;
         if (typeof rec.firstName !== 'string' || typeof rec.lastName !== 'string') continue;
         if (typeof rec.role !== 'string' || typeof rec.email !== 'string') continue;
         parsed.push({ id: rec.id, firstName: rec.firstName, lastName: rec.lastName, role: rec.role, email: rec.email });
      }
      setPeople(parsed);
   };

   const loadConversations = async (lotId?: string) => {
      setLoadingSidebar(true);
      try {
         const qs = lotId ? `&parkingLotId=${encodeURIComponent(lotId)}` : '';
         const res = await fetch(`/api/dashboard?resource=conversations${qs}`, { headers: authHeaders() });
         if (!res.ok) {
            setConversations([]);
            return;
         }
         const data: ConversationListItem[] = await res.json();
         setConversations(Array.isArray(data) ? data : []);
         if (!activeConversationId && Array.isArray(data) && data[0]?.id) {
            setActiveConversationId(data[0].id);
         }
      } finally {
         setLoadingSidebar(false);
      }
   };

   const markConversationRead = async (conversationId: string, lotId?: string) => {
      if (!conversationId) return;
      const payload: Record<string, unknown> = { resource: 'conversation-read', conversationId };
      if (lotId) payload.parkingLotId = lotId;
      await fetch('/api/dashboard', {
         method: 'PUT',
         headers: { ...authHeaders(), 'Content-Type': 'application/json' },
         body: JSON.stringify(payload),
      }).catch(() => undefined);
   };

   const loadMessages = async (conversationId: string, lotId?: string) => {
      if (!conversationId) return;
      setLoadingMessages(true);
      try {
         const qsLot = lotId ? `&parkingLotId=${encodeURIComponent(lotId)}` : '';
         const res = await fetch(`/api/dashboard?resource=messages&conversationId=${encodeURIComponent(conversationId)}${qsLot}`, { headers: authHeaders() });
         if (!res.ok) {
            setMessages([]);
            return;
         }
         const data: unknown = await res.json();
         const msgList = (data && typeof data === 'object' ? (data as Record<string, unknown>).messages : null) as unknown;
         setMessages(Array.isArray(msgList) ? (msgList as MessageData[]) : []);
         void markConversationRead(conversationId, lotId);
         setConversations(prev => prev.map(c => c.id === conversationId ? { ...c, unread: 0 } : c));
      } finally {
         setLoadingMessages(false);
      }
   };

   useEffect(() => {
      const decoded = safeDecodeJwt(localStorage.getItem('accessToken'));
      setRole(decoded.role || 'OPERATOR');
      setCurrentUserId(decoded.userId || '');

      const boot = async () => {
         const lotsData = await loadLots();
         setLots(lotsData);

         const stored = localStorage.getItem('messagesSelectedLotId');
         const fallback = lotsData[0]?.id || '';
         const next = stored && lotsData.some(l => l.id === stored) ? stored : fallback;
         const effective = (decoded.role || 'OPERATOR') === 'SUPER_ADMIN' ? next : fallback;
         setSelectedLotId(effective);
         if (effective) localStorage.setItem('messagesSelectedLotId', effective);

         await Promise.all([
            loadConversations((decoded.role || 'OPERATOR') === 'SUPER_ADMIN' ? effective : undefined),
            loadPeople((decoded.role || 'OPERATOR') === 'SUPER_ADMIN' ? effective : undefined),
         ]);
      };

      void boot();
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, []);

   useEffect(() => {
      if (!activeConversationId) return;
      void loadMessages(activeConversationId, canManageAll ? selectedLotId : undefined);
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [activeConversationId]);

   const filteredConversations = useMemo(() => {
      const term = search.trim().toLowerCase();
      if (!term) return conversations;
      return conversations.filter(c => {
         const title = displayConversationTitle(c, currentUserId).toLowerCase();
         const last = (c.lastMessage?.body || '').toLowerCase();
         return title.includes(term) || last.includes(term);
      });
   }, [conversations, currentUserId, search]);

   const activeConversation = useMemo(
      () => conversations.find(c => c.id === activeConversationId) || null,
      [activeConversationId, conversations]
   );

   const handleCreateConversation = async () => {
      const participantIds = createParticipantIds.filter(id => id !== currentUserId);
      const res = await fetch('/api/dashboard', {
         method: 'POST',
         headers: { ...authHeaders(), 'Content-Type': 'application/json' },
         body: JSON.stringify({
            resource: 'conversations',
            parkingLotId: canManageAll ? selectedLotId : undefined,
            data: { title: createTitle, participantIds },
         }),
      });
      if (!res.ok) {
         const data = await res.json().catch(() => ({}));
         toast.error((data as { error?: string }).error || 'No se pudo crear la conversación');
         return;
      }
      const convo = (await res.json()) as { id?: string };
      setShowCreate(false);
      setCreateTitle('');
      setCreateParticipantIds([]);
      await loadConversations(canManageAll ? selectedLotId : undefined);
      if (convo.id) setActiveConversationId(convo.id);
   };

   const handleSend = async () => {
      const text = composer.trim();
      if (!text || !activeConversationId) return;
      setComposer('');

      const res = await fetch('/api/dashboard', {
         method: 'POST',
         headers: { ...authHeaders(), 'Content-Type': 'application/json' },
         body: JSON.stringify({
            resource: 'messages',
            parkingLotId: canManageAll ? selectedLotId : undefined,
            data: { conversationId: activeConversationId, body: text },
         }),
      });

      if (!res.ok) {
         const data = await res.json().catch(() => ({}));
         toast.error((data as { error?: string }).error || 'No se pudo enviar el mensaje');
         setComposer(text);
         return;
      }

      const created = (await res.json()) as MessageData;
      setMessages(prev => [...prev, created]);
      await loadConversations(canManageAll ? selectedLotId : undefined);
   };

  return (
    <div className="animate-premium" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '32px', height: 'calc(100vh - 160px)', paddingTop: '10px' }}>
      
      {/* Sidebar: Chat List */}
      <div className="glass-card" style={{ padding: '0', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '32px', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                   <h2 style={{ fontSize: '24px', fontWeight: 900 }}>Centro de Mensajes</h2>
                   <button className="btn-primary" style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '10px' }} onClick={() => setShowCreate(true)}>
                      <PlusCircle size={16} />
                      Nuevo
                   </button>
                </div>

                {canManageAll && lots.length > 0 && (
                   <div className="white-card" style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                      <MapPin size={16} color="var(--accent-gold)" />
                      <select
                         value={selectedLotId}
                         onChange={async (e) => {
                            const next = e.target.value;
                            setSelectedLotId(next);
                            localStorage.setItem('messagesSelectedLotId', next);
                            setActiveConversationId('');
                            setMessages([]);
                            await Promise.all([loadPeople(next), loadConversations(next)]);
                         }}
                         style={{ border: 'none', background: 'transparent', fontWeight: 800, fontSize: '13px', outline: 'none', width: '100%' }}
                      >
                         {lots.map(l => (
                            <option key={l.id} value={l.id}>{l.name}</option>
                         ))}
                      </select>
                   </div>
                )}
           <div style={{ position: 'relative' }}>
              <input className="white-card" style={{ border: 'none', padding: '12px 16px 12px 48px', width: '100%', fontSize: '13px', fontWeight: 700 }} placeholder="Buscar chat..." value={search} onChange={e => setSearch(e.target.value)} />
              <Search size={18} style={{ position: 'absolute', left: '16px', top: '12px', color: 'var(--text-muted)' }} />
           </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
               {loadingSidebar && <div style={{ padding: '24px', display: 'flex', justifyContent: 'center' }}><div className="spinner" /></div>}

               {!loadingSidebar && filteredConversations.length === 0 && (
                  <div style={{ padding: '24px', color: 'var(--text-muted)', fontWeight: 700, fontSize: '13px' }}>
                     No hay conversaciones todavía.
                  </div>
               )}

               {!loadingSidebar && filteredConversations.map(c => {
                  const title = displayConversationTitle(c, currentUserId);
                  const isActive = c.id === activeConversationId;
                  const lastMsg = c.lastMessage?.body || 'Sin mensajes';
                  const lastTime = c.lastMessage?.createdAt ? formatTime(c.lastMessage.createdAt) : '';
                  return (
                     <div
                        key={c.id}
                        className="hover-premium"
                        style={{
                           padding: '20px', borderRadius: '24px', display: 'flex', gap: '16px', cursor: 'pointer',
                           background: isActive ? 'var(--bg-primary)' : 'transparent',
                           border: isActive ? '1px solid var(--border-color)' : '1px solid transparent',
                           marginBottom: '8px'
                        }}
                        onClick={() => {
                           setActiveConversationId(c.id);
                           setConversations(prev => prev.map(x => x.id === c.id ? { ...x, unread: 0 } : x));
                        }}
                     >
                        <div style={{ position: 'relative' }}>
                           <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                              {title[0] || 'C'}
                           </div>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                           <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                              <span style={{ fontSize: '14px', fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
                              <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)' }}>{lastTime}</span>
                           </div>
                           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lastMsg}</span>
                              {c.unread > 0 && <div style={{ padding: '2px 6px', background: 'var(--accent-gold)', borderRadius: '6px', fontSize: '10px', fontWeight: 900 }}>{c.unread}</div>}
                           </div>
                        </div>
                     </div>
                  );
               })}
        </div>
      </div>

      {/* Main: Chat View */}
      <div className="glass-card" style={{ padding: '0', display: 'flex', flexDirection: 'column' }}>
         <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ width: '44px', height: '44px', borderRadius: '14px', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>
                         {(activeConversation ? displayConversationTitle(activeConversation, currentUserId)[0] : '—')}
                      </div>
               <div style={{ display: 'flex', flexDirection: 'column' }}>
                           <span style={{ fontSize: '15px', fontWeight: 900 }}>
                              {activeConversation ? displayConversationTitle(activeConversation, currentUserId) : 'Selecciona una conversación'}
                           </span>
                           <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)' }}>
                              {activeConversation ? `${activeConversation.participants.length} participantes` : '—'}
                           </span>
               </div>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
                      <button
                         className="white-card"
                         style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}
                         onClick={() => router.push('/dashboard/notifications')}
                         title="Notificaciones"
                      >
                         <Bell size={18} />
                      </button>
            </div>
         </div>

             <div style={{ flex: 1, overflowY: 'auto', padding: '40px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {loadingMessages && <div style={{ padding: '16px', display: 'flex', justifyContent: 'center' }}><div className="spinner" /></div>}

                {!loadingMessages && !activeConversationId && (
                   <div className="white-card" style={{ padding: '22px 24px', fontWeight: 700, color: 'var(--text-muted)' }}>
                      Elige una conversación o crea una nueva.
                   </div>
                )}

                {!loadingMessages && activeConversationId && messages.length === 0 && (
                   <div className="white-card" style={{ padding: '22px 24px', fontWeight: 700, color: 'var(--text-muted)' }}>
                      Aún no hay mensajes.
                   </div>
                )}

                {!loadingMessages && messages.map(m => {
                   const mine = m.senderId === currentUserId;
                   return (
                      <div key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '70%' }}>
                         <div
                            className={mine ? undefined : 'white-card'}
                            style={mine
                               ? { padding: '20px 24px', borderRadius: '24px 24px 4px 24px', background: 'var(--text-primary)', color: 'white', fontSize: '14px', fontWeight: 600, lineHeight: 1.6 }
                               : { padding: '20px 24px', borderRadius: '24px 24px 24px 4px', fontSize: '14px', fontWeight: 600, lineHeight: 1.6 }
                            }
                         >
                            {!mine && (
                               <div style={{ fontSize: '11px', fontWeight: 900, marginBottom: '6px', color: 'var(--text-muted)' }}>
                                  {m.sender.firstName} {m.sender.lastName}
                               </div>
                            )}
                            {m.body}
                         </div>
                         <span
                            style={mine
                               ? { fontSize: '10px', color: 'var(--text-muted)', fontWeight: 800, marginTop: '8px', marginRight: '4px', textAlign: 'right', display: 'block' }
                               : { fontSize: '10px', color: 'var(--text-muted)', fontWeight: 800, marginTop: '8px', marginLeft: '4px', display: 'block' }
                            }
                         >
                            {formatTime(m.createdAt)}
                         </span>
                      </div>
                   );
                })}
             </div>

         <div style={{ padding: '32px', borderTop: '1px solid var(--border-color)' }}>
            <div style={{ position: 'relative' }}>
                      <input
                         className="white-card"
                         style={{ border: 'none', padding: '20px 80px 20px 24px', width: '100%', fontSize: '14px', fontWeight: 700 }}
                         placeholder={activeConversationId ? 'Escribe un mensaje aquí...' : 'Selecciona una conversación'}
                         value={composer}
                         onChange={(e) => setComposer(e.target.value)}
                         onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                               e.preventDefault();
                               void handleSend();
                            }
                         }}
                         disabled={!activeConversationId}
                      />
                      <button
                         className="btn-primary"
                         style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', width: '48px', height: '48px', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                         onClick={() => void handleSend()}
                         disabled={!activeConversationId || !composer.trim()}
                      >
                  <Send size={18} />
               </button>
            </div>
         </div>
      </div>

         {/* Create Conversation Modal */}
         {showCreate && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '18px' }}>
               <div className="glass-card" style={{ width: 'min(720px, 100%)', padding: '28px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                     <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '18px', fontWeight: 900 }}>Nueva conversación</span>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Selecciona participantes de la sede</span>
                     </div>
                     <button className="white-card" style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none' }} onClick={() => setShowCreate(false)}>
                        <X size={18} />
                     </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                     <div>
                        <div style={{ fontSize: '12px', fontWeight: 900, marginBottom: '8px' }}>Título (opcional)</div>
                        <input className="white-card" style={{ border: 'none', padding: '12px 14px', width: '100%', fontSize: '13px', fontWeight: 700 }} value={createTitle} onChange={(e) => setCreateTitle(e.target.value)} placeholder="Ej: Turno noche - novedades" />
                     </div>
                     <div>
                        <div style={{ fontSize: '12px', fontWeight: 900, marginBottom: '8px' }}>Participantes</div>
                        <div className="white-card" style={{ padding: '12px 14px', maxHeight: '260px', overflowY: 'auto' }}>
                           {people.length === 0 && (
                              <div style={{ color: 'var(--text-muted)', fontWeight: 700, fontSize: '13px' }}>
                                 No hay usuarios disponibles en esta sede.
                              </div>
                           )}
                           {people.map(p => {
                              const label = `${p.firstName} ${p.lastName}`.trim();
                              const checked = createParticipantIds.includes(p.id);
                              return (
                                 <label key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '8px 4px', cursor: 'pointer' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                                       <span style={{ fontSize: '13px', fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
                                       <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>{p.role} • {p.email}</span>
                                    </div>
                                    <input
                                       type="checkbox"
                                       checked={checked}
                                       onChange={() => {
                                          setCreateParticipantIds(prev => checked ? prev.filter(id => id !== p.id) : [...prev, p.id]);
                                       }}
                                    />
                                 </label>
                              );
                           })}
                        </div>
                     </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '18px' }}>
                     <button className="white-card" style={{ border: 'none', padding: '12px 14px', fontWeight: 900 }} onClick={() => setShowCreate(false)}>Cancelar</button>
                     <button className="btn-primary" style={{ padding: '12px 14px', fontWeight: 900 }} onClick={() => void handleCreateConversation()}>
                        Crear
                     </button>
                  </div>
               </div>
            </div>
         )}
    </div>
  );
}
