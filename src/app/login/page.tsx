'use client';

import { useState, FormEvent } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import Icon from '@/components/Icon'; // Added SVG Icon

export default function LoginPage() {
    const { signIn, loading } = useAuth();
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setError('');
        setSubmitting(true);

        const { error } = await signIn(email, password);
        if (error) {
            setError(error === 'Invalid login credentials'
                ? 'Email o contraseña incorrectos'
                : error
            );
            setSubmitting(false);
        } else {
            router.push('/');
        }
    }

    if (loading) {
        return (
            <div className="loading-page">
                <div className="spinner" />
            </div>
        );
    }

    return (
        <div className="login-split">
            {/* Left Cover */}
            <div className="login-split__cover">
                <div className="cover-logo">
                    <div className="cover-logo__icon">Z</div>
                    <span>Zeus Fisioterapia</span>
                </div>
                <div className="cover-text">
                    <h1>Control absoluto de tu clínica.</h1>
                    <p>Accede al panel de administración avanzado. Un entorno hiper-rápido diseñado para coordinar agendas, pacientes y analíticas en tiempo real sin distracciones.</p>
                </div>
            </div>

            {/* Right Form */}
            <div className="login-split__form-wrapper">
                <div className="login-form-container">
                    <div className="login-heading">
                        <h2>Iniciar sesión</h2>
                        <p>Introduce tus credenciales para continuar</p>
                    </div>

                    {error && (
                        <div className="login-error">
                            <Icon name="warning" size={16} /> {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label">Email de acceso</label>
                            <input
                                type="email"
                                className="form-input"
                                placeholder="tunombre@zeus.com"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                                autoFocus
                            />
                        </div>
                        <div className="form-group" style={{ marginBottom: 32 }}>
                            <label className="form-label">Contraseña</label>
                            <input
                                type="password"
                                className="form-input"
                                placeholder="••••••••"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            className="btn btn--primary btn--lg"
                            style={{ width: '100%' }}
                            disabled={submitting}
                        >
                            {submitting ? (
                                <>
                                    <div className="spinner" style={{ width: 14, height: 14, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />
                                    Autenticando...
                                </>
                            ) : (
                                'Acceder al panel'
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
