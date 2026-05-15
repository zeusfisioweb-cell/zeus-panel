'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/lib/types';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
    user: User | null;
    profile: Profile | null;
    session: Session | null;
    loading: boolean;
    profileError: boolean;
    refreshProfile: () => Promise<void>;
    signIn: (email: string, password: string) => Promise<{ error: string | null }>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);
const PROFILE_CACHE_KEY = 'zeus_profile_cache_v1';
const PROFILE_CACHE_TTL_MS = 30 * 60 * 1000;

interface CachedProfilePayload {
    userId: string;
    profile: Profile;
    timestamp: number;
}

export function AuthProvider({ children }: { children: ReactNode }) {
    // Stable supabase instance — memoized to prevent re-creation on every render
    // which would break React 19 Compiler memoization and cause fetchProfile
    // to be recreated on every render (it has supabase in its dep array).
    const [supabase] = useState(() => createClient());

    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const [profileError, setProfileError] = useState(false);
    const initialSessionResolvedRef = useRef(false);
    const profileRef = useRef<Profile | null>(null);
    // Deduplication: track in-flight fetchProfile to prevent concurrent calls
    const fetchProfileRef = useRef<Promise<void> | null>(null);
    const fetchCallIdRef = useRef(0);

    const readCachedProfile = useCallback((userId: string): Profile | null => {
        try {
            const raw = window.localStorage.getItem(PROFILE_CACHE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw) as CachedProfilePayload;
            if (!parsed || parsed.userId !== userId) return null;
            if (Date.now() - parsed.timestamp > PROFILE_CACHE_TTL_MS) return null;
            return parsed.profile;
        } catch {
            return null;
        }
    }, []);

    const writeCachedProfile = useCallback((userId: string, nextProfile: Profile) => {
        try {
            const payload: CachedProfilePayload = {
                userId,
                profile: nextProfile,
                timestamp: Date.now(),
            };
            window.localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(payload));
        } catch {
            // Ignore cache write failures (private mode/storage quotas).
        }
    }, []);

    const clearCachedProfile = useCallback(() => {
        try {
            window.localStorage.removeItem(PROFILE_CACHE_KEY);
        } catch {
            // Ignore cache cleanup failures.
        }
    }, []);

    const hydrateProfileFromCache = useCallback((userId: string) => {
        const cached = readCachedProfile(userId);
        if (!cached) return false;

        profileRef.current = cached;
        setProfile(cached);
        setProfileError(false);
        setLoading(false);
        return true;
    }, [readCachedProfile]);

    useEffect(() => {
        profileRef.current = profile;
    }, [profile]);

    const fetchProfile = useCallback(async (userId: string) => {
        const shouldBlockUI = !profileRef.current;

        // If there's already an in-flight request for this user, reuse it
        if (fetchProfileRef.current) {
            await fetchProfileRef.current;
            return;
        }

        const PROFILE_TIMEOUT_MS = 4500;
        const MAX_RETRIES = 0;
        const callId = ++fetchCallIdRef.current;
        // Only block the whole app while bootstrapping.
        // If a profile is already present, refresh in background to avoid full-screen flicker.
        if (shouldBlockUI) {
            setLoading(true);
        }

        const doFetch = async (attempt: number): Promise<void> => {
            let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
            try {
                const profilePromise = fetch('/api/admin/profile', {
                    method: 'GET',
                    credentials: 'same-origin',
                }).then(async (response): Promise<{ data: Profile | null; error: Error | null }> => {
                    if (!response.ok) {
                        let message = `HTTP ${response.status}`;
                        try {
                            const body = (await response.json()) as { error?: string };
                            message = body.error || message;
                        } catch {
                            // Keep the HTTP status as the error message.
                        }

                        return { data: null, error: new Error(message) };
                    }

                    return { data: (await response.json()) as Profile, error: null };
                });

                const timeoutPromise = new Promise<'timeout'>((resolve) => {
                    timeoutHandle = setTimeout(() => resolve('timeout'), PROFILE_TIMEOUT_MS);
                });

                const result = await Promise.race([profilePromise, timeoutPromise]);

                // Stale call — a newer fetchProfile was triggered
                if (callId !== fetchCallIdRef.current) return;

                if (result === 'timeout') {
                    if (attempt < MAX_RETRIES) {
                        console.warn(`[Auth] fetchProfile timeout (attempt ${attempt + 1}), retrying...`);
                        if (timeoutHandle) clearTimeout(timeoutHandle);
                        return doFetch(attempt + 1);
                    }
                    console.error(`[Auth] fetchProfile timeout after ${PROFILE_TIMEOUT_MS}ms (${attempt + 1} attempts)`);
                    if (!profileRef.current) {
                        setProfile(null);
                        setProfileError(true);
                    } else {
                        // Keep cached/current profile to avoid blocking UX on transient network issues.
                        setProfileError(false);
                    }
                    return;
                }

                const { data, error } = result;
                if (error || !data) {
                    // 403 Forbidden is expected for portal-only users (no admin access).
                    // Treat as "no profile" instead of an error to avoid noise.
                    if (error?.message?.includes('403') || error?.message?.includes('Forbidden')) {
                        if (!profileRef.current) {
                            setProfile(null);
                            setProfileError(false);
                        }
                        return;
                    }
                    console.error('Error fetching profile:', error?.message);
                    if (!profileRef.current) {
                        setProfile(null);
                        setProfileError(true);
                    } else {
                        setProfileError(false);
                    }
                } else {
                    const nextProfile = data as Profile;
                    // If the cached role differs from the server role, clear the stale cache
                    // before writing the fresh one. This prevents a tampered localStorage role
                    // from persisting until the TTL expires.
                    const cached = readCachedProfile(userId);
                    if (cached && cached.role !== nextProfile.role) {
                        clearCachedProfile();
                    }
                    profileRef.current = nextProfile;
                    setProfile(nextProfile);
                    setProfileError(false);
                    writeCachedProfile(userId, nextProfile);
                }
            } catch (err) {
                console.error('Unexpected error fetching profile:', err);
                if (!profileRef.current) {
                    setProfile(null);
                    setProfileError(true);
                } else {
                    setProfileError(false);
                }
            } finally {
                if (timeoutHandle) clearTimeout(timeoutHandle);
            }
        };

        const promise = doFetch(0).finally(() => {
            fetchProfileRef.current = null;
            if (shouldBlockUI && callId === fetchCallIdRef.current) {
                setLoading(false);
            }
        });
        fetchProfileRef.current = promise;
        await promise;
    }, [writeCachedProfile]);

    useEffect(() => {
        let mounted = true;
        const SESSION_TIMEOUT_MS = 1800;

        // Fetch initial session manually in case onAuthStateChange misses it
        const initSession = async () => {
            try {
                // Prevent getSession from blocking the app forever on stale locks.
                const result = await Promise.race([
                    supabase.auth.getSession(),
                    new Promise<'timeout'>((resolve) =>
                        setTimeout(() => resolve('timeout'), SESSION_TIMEOUT_MS)
                    ),
                ]);

                if (!mounted) return;

                if (result === 'timeout') {
                    // Noisy auth errors in console are confusing for normal timeout scenarios.
                    if (process.env.NODE_ENV === 'development') {
                        console.warn(`[Auth] getSession timeout after ${SESSION_TIMEOUT_MS}ms, trying getUser fallback`);
                    }

                    const userFallback = await Promise.race([
                        supabase.auth.getUser(),
                        new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 1200)),
                    ]);

                    if (!mounted) return;

                    if (userFallback !== 'timeout' && userFallback.data?.user) {
                        setSession(null);
                        setUser(userFallback.data.user);
                        if (!hydrateProfileFromCache(userFallback.data.user.id)) {
                            await fetchProfile(userFallback.data.user.id);
                        } else {
                            void fetchProfile(userFallback.data.user.id);
                        }
                        return;
                    }

                    setLoading(false);
                    return;
                }

                initialSessionResolvedRef.current = true;
                const { data: { session }, error } = result;

                if (error) {
                    console.warn('[Auth] getSession warning:', error.message);
                }

                setSession(session);
                setUser(session?.user ?? null);

                if (session?.user) {
                    if (!hydrateProfileFromCache(session.user.id)) {
                        await fetchProfile(session.user.id);
                    } else {
                        void fetchProfile(session.user.id);
                    }
                } else {
                    setProfile(null);
                    setProfileError(false);
                    setLoading(false);
                }
            } catch (err) {
                console.error('[Auth] initSession error:', err);
                if (mounted) {
                    setSession(null);
                    setUser(null);
                    setProfile(null);
                    setProfileError(false);
                    setLoading(false);
                }
            }
        };

        // Start initialization immediately
        initSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event: string, session: Session | null) => {
                if (!mounted) return;

                // Auth state change tracked internally

                // If manual bootstrap succeeded, ignore duplicated INITIAL_SESSION.
                if (event === 'INITIAL_SESSION' && initialSessionResolvedRef.current) return;
                if (event === 'INITIAL_SESSION') initialSessionResolvedRef.current = true;

                setSession(session);
                setUser(session?.user ?? null);

                if (session?.user) {
                    if (!hydrateProfileFromCache(session.user.id)) {
                        await fetchProfile(session.user.id);
                    } else {
                        void fetchProfile(session.user.id);
                    }
                } else {
                    setProfile(null);
                    setProfileError(false);
                    setLoading(false);
                }
            }
        );

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, [supabase, fetchProfile, hydrateProfileFromCache]);

    const refreshProfile = useCallback(async () => {
        if (!user) return;
        await fetchProfile(user.id);
    }, [user, fetchProfile]);

    async function signIn(email: string, password: string) {
        const SIGNIN_TIMEOUT_MS = 12000;
        setLoading(true);
        setProfileError(false);
        const timeout = new Promise<'timeout'>((resolve) =>
            setTimeout(() => resolve('timeout'), SIGNIN_TIMEOUT_MS)
        );

        const signInResult = await Promise.race([
            supabase.auth.signInWithPassword({ email, password }),
            timeout,
        ]);

        if (signInResult === 'timeout') {
            setLoading(false);
            return { error: 'Tiempo de espera agotado al iniciar sesión. Inténtalo de nuevo.' };
        }

        if (signInResult.error) {
            setLoading(false);
            return { error: signInResult.error.message };
        }

        // Fallback robusto: si onAuthStateChange no llega a tiempo, resolvemos
        // sesión/perfil manualmente para evitar spinner infinito.
        const sessionResult = await Promise.race([
            supabase.auth.getSession(),
            timeout,
        ]);

        if (sessionResult === 'timeout') {
            setLoading(false);
            return { error: 'La sesión tardó demasiado en establecerse. Inténtalo otra vez.' };
        }

        const activeSession = sessionResult.data.session;
        if (!activeSession?.user) {
            setLoading(false);
            return { error: 'No se pudo establecer la sesión de usuario.' };
        }

        setSession(activeSession);
        setUser(activeSession.user);
        await fetchProfile(activeSession.user.id);
        return { error: null };
    }

    async function signOut() {
        await supabase.auth.signOut();
        setUser(null);
        setProfile(null);
        profileRef.current = null;
        setSession(null);
        setProfileError(false);
        clearCachedProfile();
    }

    return (
        <AuthContext.Provider value={{ user, profile, session, loading, profileError, refreshProfile, signIn, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
