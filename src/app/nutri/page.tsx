'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function NutriRoot() {
    const router = useRouter();

    useEffect(() => {
        // Check if user has completed setup
        const profile = localStorage.getItem('nutri_profile');
        if (profile) {
            router.replace('/nutri/dashboard');
        } else {
            router.replace('/nutri/setup');
        }
    }, [router]);

    return (
        <div style={{
            minHeight: '100dvh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0d1117',
            color: '#39d353',
            fontFamily: 'Outfit, sans-serif',
            fontSize: 32,
            fontWeight: 900,
        }}>
            🥗
        </div>
    );
}
