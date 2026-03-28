'use client';

import React, { useState, useEffect } from 'react';
import { Webhook, Trash2, PlusCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export function WebhooksConfig() {
  const [hooks, setHooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({ name: '', url: '', secret: '', events: '*' });

  const fetchHooks = async () => {
    try {
      const res = await fetch('/api/dashboard?resource=webhook-endpoints', {
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
      });
      if (res.ok) setHooks(await res.json());
    } catch {
      toast.error('Error al cargar webhooks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHooks();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este webhook?')) return;
    try {
      const res = await fetch('/api/dashboard', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ resource: 'webhook-endpoints', id })
      });
      if (res.ok) {
        toast.success('Webhook eliminado');
        fetchHooks();
      } else toast.error('Error al eliminar');
    } catch {
      toast.error('Error de red');
    }
  };

  const handleCreate = async () => {
    if (!draft.name || !draft.url || !draft.secret) return toast.error('Faltan campos (Nombre, URL, Secret)');
    setSaving(true);
    try {
      const res = await fetch('/api/dashboard', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ resource: 'webhook-endpoints', ...draft })
      });
      if (res.ok) {
        toast.success('Webhook creado');
        setShowModal(false);
        setDraft({ name: '', url: '', secret: '', events: '*' });
        fetchHooks();
      } else {
        toast.error('Error al guardar el Webhook');
      }
    } catch {
      toast.error('Error de red');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="glass-card" style={{ padding: '40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Webhook size={22} color="var(--accent-gold)" /> Webhooks API
          </h3>
          <button className="btn-primary" style={{ padding: '8px 16px', fontSize: '13px' }} onClick={() => setShowModal(true)}>
            <PlusCircle size={16} /> Nuevo
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '32px' }}>
            <Loader2 className="spinner" size={24} />
          </div>
        ) : hooks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
            No hay webhooks configurados.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {hooks.map(h => (
              <div key={h.id} className="white-card" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '14px', marginBottom: '4px' }}>{h.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{h.url}</div>
                  <div style={{ fontSize: '11px', marginTop: '4px', background: 'rgba(0,0,0,0.05)', padding: '2px 6px', borderRadius: '4px', display: 'inline-block' }}>
                    Eventos: {h.events}
                  </div>
                </div>
                <button onClick={() => handleDelete(h.id)} style={{ color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px' }}>
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content-premium animate-premium" style={{ maxWidth: '440px' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '24px', fontWeight: 900, marginBottom: '32px' }}>Nuevo Webhook</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '32px' }}>
              <div className="form-group">
                <label className="input-label">Nombre (Ej: Mi ERP)</label>
                <input className="white-card" style={{ border: 'none', padding: '18px', width: '100%', fontSize: '14px', fontWeight: 800 }} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="input-label">Endpoint URL</label>
                <input className="white-card" style={{ border: 'none', padding: '18px', width: '100%', fontSize: '14px', fontWeight: 800 }} placeholder="https://" value={draft.url} onChange={e => setDraft({ ...draft, url: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="input-label">Firma Secreta (Webhook Secret)</label>
                <input className="white-card" style={{ border: 'none', padding: '18px', width: '100%', fontSize: '14px', fontWeight: 800 }} value={draft.secret} onChange={e => setDraft({ ...draft, secret: e.target.value })} placeholder="String aleatorio para firmar HMAC SHA256" />
              </div>
              <div className="form-group">
                <label className="input-label">Eventos (separados por coma, o *)</label>
                <input className="white-card" style={{ border: 'none', padding: '18px', width: '100%', fontSize: '14px', fontWeight: 800 }} value={draft.events} onChange={e => setDraft({ ...draft, events: e.target.value })} placeholder="ticket.created, payment.completed" />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn-dark" style={{ flex: 1, padding: '16px' }} onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn-primary" style={{ flex: 1, padding: '16px' }} onClick={handleCreate} disabled={saving}>
                {saving ? 'Guardando...' : 'Crear Webhook'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}