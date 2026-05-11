import { NextResponse } from 'next/server';
import { handleApiError, requirePanelAccess } from '../_lib';

export async function GET() {
    try {
        const { role, professionalId, profileData } = await requirePanelAccess();

        return NextResponse.json({
            ...profileData,
            professional_id: role === 'professional' ? professionalId : null,
        });
    } catch (error: unknown) {
        return handleApiError(error);
    }
}
