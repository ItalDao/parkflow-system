'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LogIn, Database, Loader2, ParkingCircle } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('admin@parkingos.com');
  const [password, setPassword] = useState('Admin123!');
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      router.push('/dashboard');
    }
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        localStorage.setItem('user', JSON.stringify(data.user));
        router.push('/dashboard');
      } else {
        alert(data.error || 'Error al iniciar sesión');
      }
    } catch (err) {
      alert('Error de conexión');
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
        // Auto-login after successful seed
        const loginRes = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'login', email: 'admin@parkingos.com', password: 'Admin123!' }),
        });
        const data = await loginRes.json();
        if (loginRes.ok) {
          localStorage.setItem('accessToken', data.accessToken);
          localStorage.setItem('refreshToken', data.refreshToken);
          localStorage.setItem('user', JSON.stringify(data.user));
          router.push('/dashboard');
        } else {
          alert('Datos inicializados. Por favor ingrese manualmente.');
        }
      } else {
        alert(seedResult.error || 'Error al inicializar');
      }
    } catch (err) {
      alert('Error de conexión al inicializar');
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
        background: 'rgba(49, 130, 206, 0.1)', borderRadius: '50%', filter: 'blur(80px)',
      }} />
      <div style={{
        position: 'absolute', bottom: '-5rem', left: '-5rem', width: '30rem', height: '30rem',
        background: 'rgba(56, 178, 172, 0.08)', borderRadius: '50%', filter: 'blur(100px)',
      }} />

      <div className="glass-card animate-premium" style={{ 
        width: '100%', maxWidth: '440px', padding: '50px', 
        background: 'rgba(255, 255, 255, 0.7)',
        border: '1px solid rgba(255, 255, 255, 0.5)', 
        backdropFilter: 'blur(40px)', 
        position: 'relative', zIndex: 10,
        boxShadow: '0 20px 60px rgba(0,0,0,0.05)',
        borderRadius: '40px'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{
            width: '72px', height: '72px', borderRadius: '24px',
            background: 'var(--accent-gradient)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'white',
            boxShadow: '0 12px 24px rgba(49, 130, 206, 0.2)',
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
             <div>
               <label style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px', display: 'block', marginLeft: '4px' }}>
                 Correo Electrónico
               </label>
               <input
                 type="email"
                 placeholder="admin@parkingos.com"
                 value={email}
                 onChange={(e) => setEmail(e.target.value)}
                 required
                 style={{ width: '100%', outline: 'none', background: 'white', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '14px 18px', borderRadius: '16px', fontSize: '14px' }}
               />
             </div>
             <div>
               <label style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px', display: 'block', marginLeft: '4px' }}>
                 Contraseña
               </label>
               <input
                 type="password"
                 placeholder="••••••••"
                 value={password}
                 onChange={(e) => setPassword(e.target.value)}
                 required
                 style={{ width: '100%', outline: 'none', background: 'white', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '14px 18px', borderRadius: '16px', fontSize: '14px' }}
               />
             </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button
               type="button"
               onClick={() => alert('Sistema de recuperación enviado a su correo corporativo.')}
               style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'color 0.2s ease' }}
               onMouseOver={(e) => (e.currentTarget.style.color = 'var(--accent-primary)')}
               onMouseOut={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              ¿Olvidó su contraseña?
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{ 
              padding: '16px', borderRadius: '16px', fontSize: '15px', fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
              transition: 'all 0.3s ease', cursor: 'pointer', border: 'none', width: '100%',
              background: 'var(--accent-gradient)',
              color: 'white',
              boxShadow: '0 10px 20px rgba(49, 130, 206, 0.2)'
            }}
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <LogIn size={18} />}
            Acceder al Panel
          </button>
        </form>

        <div style={{ marginTop: '40px', paddingTop: '24px', borderTop: '1px solid var(--border-color)', textAlign: 'center' }}>
          <button
            onClick={seedData}
            disabled={seeding}
            style={{ 
              background: 'transparent', border: 'none', color: 'var(--accent-primary)', 
              fontSize: '12px', fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px',
              textTransform: 'uppercase', letterSpacing: '1px',
            }}
          >
            {seeding ? <Loader2 className="animate-spin" size={12} /> : <Database size={12} />}
            Sincronizar Datos Maestros
          </button>
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: '30px', color: 'var(--text-muted)', fontSize: '10px', fontWeight: 800, letterSpacing: '1.5px' }}>
        PARKING-OS CLOUD © 2026 · SECURE ACCESS
      </div>
    </div>
  );
}
