import { useState } from 'react';

export const EmbedTest = () => {
    const [docUrl, setDocUrl] = useState('');
    const [embedUrl, setEmbedUrl] = useState('');
    const [error, setError] = useState('');

    const handleEmbed = () => {
        const docId = docUrl.match(/\/d\/([a-zA-Z0-9-_]+)/)?.[1];
        if (!docId) {
            setError('Invalid Google Docs URL');
            return;
        }

        const newEmbedUrl = `https://docs.google.com/document/d/${docId}/preview`;
        setEmbedUrl(newEmbedUrl);
        setError('');
    };

    return (
        <div style={{ padding: '20px' }}>
            <h2>Embed Test</h2>

            <div style={{ marginBottom: '20px' }}>
                <input
                    type="text"
                    value={docUrl}
                    onChange={(e) => setDocUrl(e.target.value)}
                    placeholder="Paste Google Doc URL"
                    style={{ width: '100%', padding: '8px' }}
                />
                <button onClick={handleEmbed} style={{ marginTop: '10px' }}>
                    Embed Document
                </button>
            </div>

            {error && <p style={{ color: 'red' }}>{error}</p>}

            {embedUrl && (
                <div>
                    <h3>Embedded Document:</h3>
                    <iframe
                        src={embedUrl}
                        style={{ width: '100%', height: '500px', border: '1px solid #ccc' }}
                        allowFullScreen
                    />
                </div>
            )}
        </div>
    );
};