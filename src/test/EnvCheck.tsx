import React from 'react';

export default function EnvCheck() {
    console.log('Client ID:', process.env.VITE_GOOGLE_CLIENT_ID);
    console.log('API Key:', process.env.VITE_GOOGLE_API_KEY);
    console.log(process.env)
    return <div>Check console for environment variables</div>;
} 