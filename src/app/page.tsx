'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LogIn, Database, Loader2, ParkingCircle, Mail, Lock, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      router.push('/dashboard');
    }
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setError('Ingresa tu correo y contraseña.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', email: normalizedEmail, password }),
      });

      const data = (await res.json().catch(() => ({}))) as { accessToken?: string; refreshToken?: string; user?: unknown; error?: string };
      if (res.ok) {
        if (!data.accessToken || !data.refreshToken || !data.user) {
          setError('Respuesta inválida del servidor.');
          return;
        }
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        localStorage.setItem('user', JSON.stringify(data.user));
        toast.success('Bienvenido/a');
        router.replace('/dashboard');
      } else {
        const msg = data.error || (res.status === 401 ? 'Credenciales inválidas' : 'No se pudo iniciar sesión');
        setError(msg);
        toast.error(msg);
      }
    } catch (err) {
      console.error(err);
      setError('Error de conexión');
      toast.error('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const seedData = async () => {
    setSeeding(true);
    try {
      const res = await fetch('/api/seed', { method: 'POST' });
      const seedResult = await res.json();
      
      if (res.ok) {
        toast.success('Datos sincronizados. Inicia sesión.');
      } else {
        toast.error(seedResult.error || 'Error al inicializar');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error de conexión al inicializar');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="mesh-bg" style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
      fontFamily: 'Outfit, sans-serif'
    }}>
      {/* Decorative Elements */}
      <div style={{
        position: 'absolute', top: '-5rem', right: '-5rem', width: '25rem', height: '25rem',
        background: 'rgba(233, 185, 73, 0.1)', borderRadius: '50%', filter: 'blur(80px)',
      }} />
      <div style={{
        position: 'absolute', bottom: '-5rem', left: '-5rem', width: '30rem', height: '30rem',
        background: 'rgba(56, 178, 172, 0.05)', borderRadius: '50%', filter: 'blur(100px)',
      }} />

      <div className="glass-card animate-premium" style={{ 
        width: '100%', maxWidth: '440px', padding: '50px', 
        background: 'rgba(255, 255, 255, 0.8)',
        border: '1px solid rgba(255, 255, 255, 0.5)', 
        backdropFilter: 'blur(40px)', 
        position: 'relative', zIndex: 10,
        boxShadow: '0 20px 60px rgba(0,0,0,0.05)',
        borderRadius: '40px'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{
            width: '72px', height: '72px', borderRadius: '24px',
            background: 'var(--text-primary)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-gold)',
            boxShadow: '0 12px 24px rgba(0,0,0,0.1)',
            marginBottom: '24px'
          }}>
            <ParkingCircle size={40} />
          </div>
          <h1 style={{ fontSize: '32px', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-1.5px', marginBottom: '4px' }}>
            ParkingOS
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: 600, letterSpacing: '0.5px' }}>
            GESTIÓN DE PARQUEADERO ELITE
          </p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {error && (
            <div className="white-card" style={{ border: '1px solid rgba(220, 38, 38, 0.25)', background: 'rgba(220, 38, 38, 0.06)', padding: '14px 16px', borderRadius: '16px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <AlertTriangle size={18} color="var(--accent-danger)" style={{ marginTop: '2px' }} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontWeight: 900, fontSize: '13px', color: 'var(--text-primary)' }}>No se pudo iniciar sesión</div>
                <div style={{ fontWeight: 700, fontSize: '12px', color: 'var(--text-muted)' }}>{error}</div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
             <div>
                <label style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px', display: 'block', marginLeft: '4px' }}>
                  Correo Electrónico
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail size={18} style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--text-muted)' }} />
                  <input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="correo@empresa.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    style={{ width: '100%', outline: 'none', background: 'white', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '14px 18px 14px 44px', borderRadius: '16px', fontSize: '14px', fontWeight: 700 }}
                  />
                </div>
             </div>
             <div>
                <label style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px', display: 'block', marginLeft: '4px' }}>
                  Contraseña
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={18} style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--text-muted)' }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="********"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => setCapsLockOn(e.getModifierState('CapsLock'))}
                    onBlur={() => setCapsLockOn(false)}
                    required
                    style={{ width: '100%', outline: 'none', background: 'white', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '14px 48px 14px 44px', borderRadius: '16px', fontSize: '14px', fontWeight: 700 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    style={{ position: 'absolute', right: '10px', top: '10px', width: '38px', height: '38px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {capsLockOn && (
                  <div style={{ marginTop: '8px', fontSize: '12px', fontWeight: 800, color: 'var(--accent-warning)' }}>
                    Caps Lock activado
                  </div>
                )}
             </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button
               type="button"
              onClick={() => toast('Contacta al administrador para recuperar acceso.')}
               style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'color 0.2s ease' }}
               onMouseOver={(e) => (e.currentTarget.style.color = 'var(--accent-gold)')}
               onMouseOut={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
               ¿Olvidó su contraseña?
            </button>
          </div>

          <button
            type="submit"
            disabled={loading || seeding}
            className="btn-primary"
            style={{ 
              padding: '16px', borderRadius: '16px', fontSize: '15px', fontWeight: 900,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
              transition: 'all 0.3s ease', cursor: 'pointer', border: 'none', width: '100%',
              background: 'var(--text-primary)',
              color: 'var(--accent-gold)',
              boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
            }}
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <LogIn size={18} />}
            Acceder al Panel
          </button>

        </form>

        <div style={{ marginTop: '40px', paddingTop: '24px', borderTop: '1px solid var(--border-color)', textAlign: 'center' }}>
          <button
            onClick={seedData}
            disabled={seeding || loading}
            style={{ 
              background: 'transparent', border: 'none', color: 'var(--accent-gold)', 
              fontSize: '11px', fontWeight: 900, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px',
              textTransform: 'uppercase', letterSpacing: '1px',
            }}
          >
            {seeding ? <Loader2 className="animate-spin" size={12} /> : <Database size={12} />}
            Sincronizar Datos Maestros
          </button>
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: '30px', color: 'var(--text-muted)', fontSize: '10px', fontWeight: 800, letterSpacing: '1.5px' }}>
        PARKINGOS CLOUD © 2026 · ELITE ACCESS
      </div>
    </div>
  );
}
