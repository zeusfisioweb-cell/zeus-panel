import { SignJWT, jwtVerify } from 'jose';

const AUDIENCE = 'zeus:portal:cancel';
const ALGORITHM = 'HS256';
const EXPIRY = '24h';

function getSecret(): Uint8Array {
    const raw = process.env.PORTAL_CANCEL_SECRET;
    if (!raw) {
        throw new Error('PORTAL_CANCEL_SECRET is required');
    }
    return new TextEncoder().encode(raw);
}

export async function signCancelToken(aptId: string, patientId: string, actorUserId?: string): Promise<string> {
    return new SignJWT({ aptId, patientId, actorUserId })
        .setProtectedHeader({ alg: ALGORITHM })
        .setAudience(AUDIENCE)
        .setIssuedAt()
        .setExpirationTime(EXPIRY)
        .sign(getSecret());
}

export async function verifyCancelToken(token: string): Promise<{ aptId: string; patientId: string; actorUserId: string | null }> {
    const { payload } = await jwtVerify(token, getSecret(), { audience: AUDIENCE });

    const aptId = payload['aptId'];
    const patientId = payload['patientId'];
    const actorUserId = payload['actorUserId'];

    if (typeof aptId !== 'string' || typeof patientId !== 'string') {
        throw new Error('Invalid token payload');
    }

    return {
        aptId,
        patientId,
        actorUserId: typeof actorUserId === 'string' ? actorUserId : null,
    };
}
