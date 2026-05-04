import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'Zeus Panel',
        short_name: 'Zeus',
        description: 'Panel de administración para Zeus Fisioterapia y Psicología',
        start_url: '/',
        display: 'standalone',
        background_color: '#f8f4ef',
        theme_color: '#ad7332',
        lang: 'es-ES',
        icons: [
            {
                src: '/zeus-favicon.png',
                sizes: '192x192',
                type: 'image/png',
            },
            {
                src: '/zeus-favicon.png',
                sizes: '512x512',
                type: 'image/png',
            },
        ],
    };
}

