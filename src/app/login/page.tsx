'use client';

import { useState, FormEvent } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import Icon from '@/components/Icon';

export default function LoginPage() {
    const { signIn, loading } = useAuth();
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const isBusy = submitting || loading;

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setError('');
        setSubmitting(true);

        const { error } = await signIn(email, password);
        if (error) {
            setError(error === 'Invalid login credentials'
                ? 'Email o contrasena incorrectos'
                : error
            );
            setSubmitting(false);
        } else {
            router.push('/');
        }
    }

    return (
        <div className="login-split">
            <div className="login-split__cover">
                <div className="cover-logo">
                    <div className="cover-logo__icon">Z</div>
                    <span>Zeus Fisioterapia</span>
                </div>

                <div className="cover-text">
                    <h1>Gestion clara para tu clinica.</h1>
                    <p>
                        Agenda, pacientes, servicios y horarios en un unico panel.
                        Rapido, limpio y preparado para el trabajo diario.
                    </p>
                    <ul className="cover-points">
                        <li className="cover-point">Vista dia, semana y agenda con foco clinico</li>
                        <li className="cover-point">Interfaz visual para confirmar y mover citas rapido</li>
                        <li className="cover-point">Diseno limpio para trabajar todo el dia sin fatiga</li>
                    </ul>
                </div>
            </div>

            <div className="login-split__form-wrapper">
                <div className="login-form-container">
                    <div className="login-heading">
                        <h2>Iniciar sesion</h2>
                        <p>Accede con tu cuenta profesional para continuar.</p>
                    </div>

                    {loading && (
                        <div className="login-info" role="status" aria-live="polite">
                            <div className="spinner" style={{ width: 14, height: 14 }} />
                            Verificando sesion...
                        </div>
                    )}

                    {error && (
                        <div className="login-error" role="alert" aria-live="polite">
                            <Icon name="warning" size={16} /> {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label" htmlFor="login-email">Correo de acceso</label>
                            <input
                                id="login-email"
                                type="email"
                                className="form-input"
                                placeholder="tunombre@zeus.com"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                                autoComplete="email"
                            />
                        </div>

                        <div className="form-group" style={{ marginBottom: 32 }}>
                            <label className="form-label" htmlFor="login-password">Contrasena</label>
                            <input
                                id="login-password"
                                type="password"
                                className="form-input"
                                placeholder="********"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                                autoComplete="current-password"
                            />
                        </div>

                        <button
                            type="submit"
                            className="btn btn--primary btn--lg"
                            style={{ width: '100%' }}
                            disabled={isBusy}
                        >
                            {isBusy ? (
                                <>
                                    <div className="spinner" style={{ width: 14, height: 14, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />
                                    {loading ? 'Preparando...' : 'Verificando...'}
                                </>
                            ) : (
                                'Entrar al panel'
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
