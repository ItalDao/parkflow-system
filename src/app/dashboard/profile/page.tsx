'use client';

import { useEffect, useMemo, useState } from 'react';
import { Mail, Shield, UserCircle2, Calendar, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';

type JwtPayload = { role?: string; userId?: string; exp?: number };

type UserInfo = {
  id?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  role?: string;
};

function decodeJwt(token: string | null): JwtPayload {
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

function roleLabel(role?: string) {
  const normalized = String(role || '').toUpperCase();
  if (normalized === 'SUPER_ADMIN') return 'Super Admin';
  if (normalized === 'ADMIN') return 'Administrador';
  if (normalized === 'OPERATOR') return 'Operador';
  if (normalized === 'CUSTOMER') return 'Cliente';
  return 'Usuario';
}

export default function ProfilePage() {
  const [lotName, setLotName] = useState<string>('No asignada');
  const [draft, setDraft] = useState({ firstName: '', lastName: '', phone: '', currentPassword: '', newPassword: '' });
  const [saving, setSaving] = useState(false);

  const user = useMemo<UserInfo | null>(() => {
    try {
      const rawUser = localStorage.getItem('user');
      if (!rawUser) return null;
      return JSON.parse(rawUser) as UserInfo;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    const loadLot = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        if (!token) return;
        const res = await fetch('/api/dashboard?resource=parking-lot', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = (await res.json()) as { name?: string };
        if (data?.name) setLotName(data.name);
      } catch {
        // Non-critical: profile view still works without lot context.
      }
    };
    void loadLot();
  }, []);

  const tokenInfo = useMemo(() => decodeJwt(localStorage.getItem('accessToken')), []);
  const expiresAt = tokenInfo.exp ? new Date(tokenInfo.exp * 1000) : null;

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        if (!token) return;
        const res = await fetch('/api/dashboard?resource=profile', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = (await res.json()) as UserInfo;
        setDraft({
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          phone: data.phone || '',
          currentPassword: '',
          newPassword: '',
        });
      } catch {
        // Keep local fallback values.
      }
    };
    void loadProfile();
  }, []);

  const handleSave = async () => {
    if (!draft.firstName.trim() || !draft.lastName.trim()) {
      toast.error('Nombre y apellido son requeridos');
      return;
    }
    if (draft.newPassword && draft.newPassword.length < 8) {
      toast.error('La nueva contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (draft.newPassword && !draft.currentPassword) {
      toast.error('Debes confirmar tu contraseña actual');
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/dashboard', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resource: 'profile',
          data: {
            firstName: draft.firstName.trim(),
            lastName: draft.lastName.trim(),
            phone: draft.phone.trim() || null,
            currentPassword: draft.currentPassword || undefined,
            newPassword: draft.newPassword || undefined,
          },
        }),
      });

      const data = (await res.json().catch(() => ({}))) as { error?: string; user?: UserInfo };
      if (!res.ok) {
        toast.error(data.error || 'No se pudo actualizar el perfil');
        return;
      }

      const currentRaw = localStorage.getItem('user');
      if (currentRaw) {
        try {
          const current = JSON.parse(currentRaw) as UserInfo;
          const next = {
            ...current,
            firstName: data.user?.firstName ?? draft.firstName,
            lastName: data.user?.lastName ?? draft.lastName,
            phone: data.user?.phone ?? draft.phone,
          };
          localStorage.setItem('user', JSON.stringify(next));
        } catch {
          // ignore
        }
      }

      setDraft((prev) => ({ ...prev, currentPassword: '', newPassword: '' }));
      toast.success('Perfil actualizado');
    } catch {
      toast.error('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="animate-premium" style={{ paddingTop: '10px' }}>
      <div className="glass-card" style={{ padding: 'clamp(20px, 4vw, 40px)', maxWidth: '880px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '28px' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--bg-white)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <UserCircle2 size={34} color="var(--accent-gold)" />
          </div>
          <div>
            <h2 style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-primary)' }}>Mi perfil</h2>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Información de sesión y rol activo</div>
          </div>
        </div>

        <div className="responsive-two-col" style={{ gap: '16px' }}>
          <div className="white-card" style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <UserCircle2 size={16} color="var(--text-muted)" />
              <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Nombre</span>
            </div>
            <div style={{ fontSize: '16px', fontWeight: 900 }}>{user?.firstName || '-'} {user?.lastName || ''}</div>
          </div>

          <div className="white-card" style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <Mail size={16} color="var(--text-muted)" />
              <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Correo</span>
            </div>
            <div style={{ fontSize: '16px', fontWeight: 900 }}>{user?.email || '-'}</div>
          </div>

          <div className="white-card" style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <Shield size={16} color="var(--text-muted)" />
              <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Rol</span>
            </div>
            <div style={{ fontSize: '16px', fontWeight: 900 }}>{roleLabel(user?.role)}</div>
          </div>

          <div className="white-card" style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <Building2 size={16} color="var(--text-muted)" />
              <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Sede de contexto</span>
            </div>
            <div style={{ fontSize: '16px', fontWeight: 900 }}>{lotName}</div>
          </div>

          <div className="white-card" style={{ padding: '18px 20px', gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <Calendar size={16} color="var(--text-muted)" />
              <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Sesión</span>
            </div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-secondary)' }}>
              {expiresAt ? `Token expira: ${expiresAt.toLocaleString()}` : 'Sin fecha de expiración disponible en token.'}
            </div>
          </div>

          <div className="white-card" style={{ padding: '18px 20px', gridColumn: '1 / -1' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px' }}>Editar perfil</div>
            <div className="responsive-two-col" style={{ marginBottom: '12px' }}>
              <input className="input-field" placeholder="Nombre" value={draft.firstName} onChange={(e) => setDraft((d) => ({ ...d, firstName: e.target.value }))} />
              <input className="input-field" placeholder="Apellido" value={draft.lastName} onChange={(e) => setDraft((d) => ({ ...d, lastName: e.target.value }))} />
            </div>
            <div className="responsive-two-col" style={{ marginBottom: '12px' }}>
              <input className="input-field" placeholder="Teléfono" value={draft.phone} onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))} />
              <input className="input-field" value={user?.email || ''} readOnly disabled />
            </div>
            <div className="responsive-two-col" style={{ marginBottom: '14px' }}>
              <input className="input-field" type="password" placeholder="Contraseña actual (si cambias clave)" value={draft.currentPassword} onChange={(e) => setDraft((d) => ({ ...d, currentPassword: e.target.value }))} />
              <input className="input-field" type="password" placeholder="Nueva contraseña (opcional)" value={draft.newPassword} onChange={(e) => setDraft((d) => ({ ...d, newPassword: e.target.value }))} />
            </div>
            <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ width: '100%', maxWidth: '300px' }}>
              {saving ? 'Guardando...' : 'Guardar perfil'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
