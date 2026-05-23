'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/Icon';

const MIN_LENGTH = 8;

export default function SetPasswordPage() {
    const router = useRouter();
    const supabase = createClient();
    const [ready, setReady] = useState(false);
    const [sessionError, setSessionError] = useState<string | null>(null);
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        let cancelled = false;
        async function check() {
            const { data, error } = await supabase.auth.getSession();
            if (cancelled) return;
            if (error || !data.session) {
                setSessionError('Enlace inválido o caducado. Solicita uno nuevo desde la pantalla de acceso.');
            }
            setReady(true);
        }
        check();
        return () => { cancelled = true; };
    }, [supabase]);

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setError('');

        if (password.length < MIN_LENGTH) {
            setError(`La contraseña debe tener al menos ${MIN_LENGTH} caracteres`);
            return;
        }
        if (password !== confirm) {
            setError('Las contraseñas no coinciden');
            return;
        }

        setSubmitting(true);
        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) {
            setError(updateError.message);
            setSubmitting(false);
            return;
        }

        await supabase.auth.signOut();
        setSuccess(true);
        setSubmitting(false);
        setTimeout(() => router.push('/login'), 2000);
    }

    if (!ready) {
        return (
            <div className="login-split">
                <div className="login-split__form-wrapper">
                    <div className="login-form-container">
                        <div className="spinner" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="login-split">
            <div className="login-split__cover">
                <div className="cover-logo">
                    <div className="cover-logo__icon">Z</div>
                    <span>Zeus Fisioterapia</span>
                </div>
                <div className="cover-text">
                    <h1>Establece tu contraseña.</h1>
                    <p>Crea una contraseña segura para acceder al panel.</p>
                </div>
            </div>

            <div className="login-split__form-wrapper">
                <div className="login-form-container">
                    <div className="login-heading">
                        <h2>Nueva contraseña</h2>
                        <p>Elige una contraseña con al menos {MIN_LENGTH} caracteres.</p>
                    </div>

                    {sessionError && (
                        <div className="login-error" role="alert">
                            <Icon name="warning" size={16} /> {sessionError}
                        </div>
                    )}

                    {success && (
                        <div className="login-info" role="status">
                            Contraseña establecida. Redirigiendo al acceso...
                        </div>
                    )}

                    {error && (
                        <div className="login-error" role="alert">
                            <Icon name="warning" size={16} /> {error}
                        </div>
                    )}

                    {!sessionError && !success && (
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label className="form-label" htmlFor="new-password">Nueva contraseña</label>
                                <input
                                    id="new-password"
                                    type="password"
                                    className="form-input"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    minLength={MIN_LENGTH}
                                    autoComplete="new-password"
                                />
                            </div>

                            <div className="form-group mb-8">
                                <label className="form-label" htmlFor="confirm-password">Repite la contraseña</label>
                                <input
                                    id="confirm-password"
                                    type="password"
                                    className="form-input"
                                    value={confirm}
                                    onChange={(e) => setConfirm(e.target.value)}
                                    required
                                    minLength={MIN_LENGTH}
                                    autoComplete="new-password"
                                />
                            </div>

                            <button
                                type="submit"
                                className="btn btn--primary btn--lg w-full"
                                disabled={submitting}
                            >
                                {submitting ? 'Guardando...' : 'Establecer contraseña'}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
