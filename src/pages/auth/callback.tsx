import { useEffect } from 'react';

export default function AuthCallback() {
    useEffect(() => {
        console.log('🎯 Callback page loaded');

        const hashParams = new URLSearchParams(window.location.hash.replace('#', ''));
        const queryParams = new URLSearchParams(window.location.search);

        console.log('📝 URL params:', {
            hash: window.location.hash,
            search: window.location.search
        });

        const state = hashParams.get('state') || queryParams.get('state');
        const accessToken = hashParams.get('access_token') || queryParams.get('access_token');
        const docId = state ? decodeURIComponent(state) : null;

        console.log('🔑 Extracted values:', {
            state,
            accessToken: accessToken ? 'present' : 'missing',
            docId
        });

        if (window.opener && docId) {
            console.log('📤 Sending message to opener');
            window.opener.postMessage({
                type: 'auth-complete',
                docId,
                accessToken
            }, window.location.origin);
            console.log('🚪 Closing callback window');
            window.close();
        } else {
            console.warn('⚠️ Missing window.opener or docId');
        }
    }, []);

    return <div>Processing authentication...</div>;
} 