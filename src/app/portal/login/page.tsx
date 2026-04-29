'use client';

import { useState, FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Icon from '@/components/Icon';
import { useSearchParams } from 'next/navigation';

export default function PortalLoginPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [error, setError] = useState(searchParams.get('error') === 'auth' ? 'Error de autenticación. Inténtalo de nuevo.' : '');
    const [resetSent, setResetSent] = useState(false);

    async function handleLogin(e: FormEvent) {
        e.preventDefault();
        setError('');
        setSubmitting(true);

        const supabase = createClient();
        const { error: authError } = await supabase.auth.signInWithPassword({
            email: email.trim().toLowerCase(),
            password,
        });

        setSubmitting(false);

        if (authError) {
            setError('Email o contraseña incorrectos. Si no tienes acceso, contacta con la clínica.');
            return;
        }

        router.push('/portal/mis-citas');
        router.refresh();
    }

    async function handleGoogleLogin() {
        setError('');
        setGoogleLoading(true);
        const supabase = createClient();
        const origin = window.location.origin;
        const { error: authError } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${origin}/auth/callback?next=/portal/mis-citas`,
            },
        });
        if (authError) {
            setError('Error al conectar con Google. Inténtalo de nuevo.');
            setGoogleLoading(false);
        }
    }

    async function handleForgotPassword() {
        if (!email.trim()) {
            setError('Introduce tu correo primero.');
            return;
        }
        setError('');
        const supabase = createClient();
        const origin = window.location.origin;
        await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
            redirectTo: `${origin}/auth/callback?next=/portal/reset-password`,
        });
        setResetSent(true);
    }

    return (
        <div className="portal-login-split">
            <div className="portal-login-cover">
                <div className="portal-cover-logo">
                    <div className="portal-cover-logo__mark">Z</div>
                    <span>Zeus</span>
                </div>
                <div className="portal-cover-text">
                    <h1>Tu espacio de salud</h1>
                    <p>Consulta tus citas, historial y documentos desde cualquier dispositivo.</p>
                </div>
            </div>

            <div className="portal-login-form-wrapper">
                <div className="portal-login-container">
                    <div className="portal-login-heading">
                        <h2>Acceder al portal</h2>
                        <p>Introduce tus credenciales para ver tus citas.</p>
                    </div>

                    {error && (
                        <div className="login-error" role="alert">
                            <Icon name="warning" size={16} /> {error}
                        </div>
                    )}

                    {resetSent && (
                        <div className="portal-login-info" role="status">
                            <Icon name="mail" size={16} />
                            Email de recuperación enviado. Revisa tu bandeja de entrada.
                        </div>
                    )}

                    <form onSubmit={handleLogin}>
                        <div className="form-group">
                            <label className="form-label" htmlFor="portal-email">
                                Correo electrónico
                            </label>
                            <input
                                id="portal-email"
                                type="email"
                                className="form-input"
                                placeholder="tu@email.com"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                                autoComplete="email"
                                autoFocus
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label" htmlFor="portal-password">
                                Contraseña
                            </label>
                            <input
                                id="portal-password"
                                type="password"
                                className="form-input"
                                placeholder="••••••••"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                                autoComplete="current-password"
                            />
                        </div>

                        <button
                            type="submit"
                            className="btn btn--primary btn--lg portal-login-btn"
                            disabled={submitting}
                        >
                            {submitting ? (
                                <>
                                    <div className="spinner" style={{ width: 14, height: 14, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />
                                    Entrando...
                                </>
                            ) : (
                                'Entrar al portal'
                            )}
                        </button>
                    </form>

                    <button
                        type="button"
                        className="portal-login-forgot"
                        onClick={handleForgotPassword}
                        disabled={submitting}
                    >
                        ¿Olvidaste tu contraseña?
                    </button>

                    <div className="portal-login-divider">
                        <span>o</span>
                    </div>

                    <button
                        type="button"
                        className="portal-login-google"
                        onClick={handleGoogleLogin}
                        disabled={submitting || googleLoading}
                    >
                        {googleLoading ? (
                            <div className="spinner" style={{ width: 16, height: 16 }} />
                        ) : (
                            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                                <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                                <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"/>
                                <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z"/>
                            </svg>
                        )}
                        Continuar con Google
                    </button>

                    <p className="portal-login-help">
                        ¿No tienes cuenta? La clínica te registra con tu email.
                    </p>
                </div>
            </div>
        </div>
    );
}
