'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { formatDate } from '@/lib/utils';
import { 
  Info, 
  AlertTriangle, 
  CheckCircle2, 
  Trash2, 
  Clock,
  Loader2,
  Inbox
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

function getAuthHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem('accessToken')}`, 'Content-Type': 'application/json' };
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'UNREAD' | 'CRITICAL' | 'OPERATIONAL'>('ALL');
  const [pendingClear, setPendingClear] = useState(false);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchNotifications();
  }, [router]);

  useEffect(() => () => {
    if (clearTimer.current) clearTimeout(clearTimer.current);
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/dashboard?resource=notifications', { headers: getAuthHeaders() });
      if (res.status === 401) {
        localStorage.removeItem('accessToken');
        router.push('/');
        return;
      }
      if (res.ok) {
        setNotifications(await res.json());
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error((data as { error?: string }).error || 'No se pudieron cargar notificaciones');
        setNotifications([]);
      }
    } catch (err) {
      console.error(err);
      toast.error('Error de conexion');
    }
    finally { setLoading(false); }
  };

  const markAsRead = async (id: string) => {
    try {
      const res = await fetch('/api/dashboard', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ resource: 'notifications', id, data: { isRead: true } })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error((data as { error?: string }).error || 'No se pudo actualizar');
        return;
      }
      fetchNotifications();
    } catch (err) {
      console.error(err);
      toast.error('Error de conexion');
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      const res = await fetch(`/api/dashboard?resource=notifications&id=${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error((data as { error?: string }).error || 'No se pudo eliminar');
        return;
      }
      fetchNotifications();
    } catch (err) {
      console.error(err);
      toast.error('Error de conexion');
    }
  };

  const markAllRead = async () => {
    try {
      const res = await fetch('/api/dashboard', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ resource: 'notifications', data: { action: 'markAllRead' } })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error((data as { error?: string }).error || 'No se pudo actualizar');
        return;
      }
      fetchNotifications();
    } catch (err) {
      console.error(err);
      toast.error('Error de conexion');
    }
  };

  const clearAll = async () => {
    if (!pendingClear) {
      setPendingClear(true);
      toast('Vuelve a hacer click para confirmar');
      if (clearTimer.current) clearTimeout(clearTimer.current);
      clearTimer.current = setTimeout(() => setPendingClear(false), 4000);
      return;
    }
    setPendingClear(false);
    if (clearTimer.current) clearTimeout(clearTimer.current);
    try {
      await fetch('/api/dashboard?resource=notifications', {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      fetchNotifications();
    } catch (err) {
      console.error(err);
      toast.error('Error de conexion');
    }
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}><Loader2 className="animate-spin" size={40} color="var(--accent-primary)" /></div>;

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const filtered = notifications.filter((n) => {
    if (filter === 'ALL') return true;
    if (filter === 'UNREAD') return !n.isRead;
    const isCritical = n.type === 'error' || n.type === 'warning';
    if (filter === 'CRITICAL') return isCritical;
    if (filter === 'OPERATIONAL') return !isCritical;
    return true;
  });

  return (
    <div className="animate-premium">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h2 style={{ fontSize: '32px', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '4px', letterSpacing: '-1.5px' }}>
            Centro de Notificaciones
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 600 }}>
             Tienes {unreadCount} mensajes sin leer
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={markAllRead} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }} disabled={unreadCount === 0}>
             <CheckCircle2 size={16} /> Marcar todo leído
          </button>
          <button onClick={clearAll} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }} disabled={notifications.length === 0}>
             <Trash2 size={16} /> Limpiar Todo
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {filtered.map((n) => (
          <div key={n.id} className="glass-card" style={{ 
            padding: '24px', 
            background: n.isRead ? 'var(--bg-card)' : 'white',
            borderLeft: `6px solid ${
              n.type === 'warning' ? '#f59e0b' : 
              n.type === 'error' ? '#ef4444' : 
              n.type === 'success' ? '#10b981' : 
              'var(--accent-primary)'
            }`,
            opacity: n.isRead ? 0.8 : 1,
            position: 'relative'
          }}>
            <div style={{ display: 'flex', gap: '20px' }}>
                <div style={{ 
                  width: '48px', height: '48px', borderRadius: '14px', 
                  background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: n.type === 'warning' ? '#f59e0b' : n.type === 'success' ? '#10b981' : 'var(--accent-primary)'
                }}>
                  {n.type === 'warning' ? <AlertTriangle size={20} /> : 
                   n.type === 'success' ? <CheckCircle2 size={20} /> : 
                   <Info size={20} />}
                </div>
                <div style={{ flex: 1 }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <h4 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>{n.title}</h4>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={12} /> {formatDate(n.createdAt)}
                      </span>
                   </div>
                   <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '20px' }}>{n.message}</p>
                   
                   <div style={{ display: 'flex', gap: '12px' }}>
                      {!n.isRead && (
                        <button onClick={() => markAsRead(n.id)} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', height: '32px' }}>Marcar como leído</button>
                      )}
                      <button onClick={() => deleteNotification(n.id)} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '12px', cursor: 'pointer', fontWeight: 700 }}>Eliminar</button>
                   </div>
                </div>
            </div>
            {!n.isRead && (
              <div style={{ position: 'absolute', top: '12px', right: '12px', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-primary)' }} />
            )}
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="glass-card" style={{ padding: '100px', textAlign: 'center' }}>
             <Inbox size={64} style={{ margin: '0 auto 24px', opacity: 0.1 }} />
             <h3 style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text-primary)' }}>Bandeja Vacía</h3>
             <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No tienes notificaciones pendientes en este momento.</p>
          </div>
        )}
      </div>

      {/* Quick Filters */}
      <div style={{ marginTop: '40px', display: 'flex', gap: '10px' }}>
         <div className={`badge ${filter === 'ALL' ? 'badge-info' : ''}`} style={{ cursor: 'pointer', background: filter === 'ALL' ? undefined : 'white', border: filter === 'ALL' ? undefined : '1px solid var(--border-color)' }} onClick={() => setFilter('ALL')}>Todos</div>
         <div className={`badge ${filter === 'UNREAD' ? 'badge-info' : ''}`} style={{ cursor: 'pointer', background: filter === 'UNREAD' ? undefined : 'white', border: filter === 'UNREAD' ? undefined : '1px solid var(--border-color)' }} onClick={() => setFilter('UNREAD')}>Sin leer</div>
         <div className={`badge ${filter === 'CRITICAL' ? 'badge-info' : ''}`} style={{ cursor: 'pointer', background: filter === 'CRITICAL' ? undefined : 'white', border: filter === 'CRITICAL' ? undefined : '1px solid var(--border-color)' }} onClick={() => setFilter('CRITICAL')}>Alertas Críticas</div>
         <div className={`badge ${filter === 'OPERATIONAL' ? 'badge-info' : ''}`} style={{ cursor: 'pointer', background: filter === 'OPERATIONAL' ? undefined : 'white', border: filter === 'OPERATIONAL' ? undefined : '1px solid var(--border-color)' }} onClick={() => setFilter('OPERATIONAL')}>Operacionales</div>
      </div>
    </div>
  );
}
