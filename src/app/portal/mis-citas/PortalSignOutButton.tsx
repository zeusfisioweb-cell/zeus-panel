'use client';

import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export function PortalSignOutButton() {
    const router = useRouter();

    async function handleSignOut() {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.replace('/portal/login');
    }

    return (
        <button
            type="button"
            className="portal-signout-btn"
            onClick={handleSignOut}
        >
            Salir
        </button>
    );
}
