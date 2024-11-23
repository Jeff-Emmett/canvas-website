/// <reference path="../types/google.accounts.d.ts" />

import { BaseBoxShapeUtil, TLBaseShape } from "tldraw";
import { useState, useCallback } from "react";
import { useGoogleAuth } from '@/context/GoogleAuthContext';

export type IEmbedShape = TLBaseShape<
    'Embed',
    {
        w: number;
        h: number;
        url: string | null;
    }
>;

export class EmbedShape extends BaseBoxShapeUtil<IEmbedShape> {
    static override type = 'Embed';

    getDefaultProps(): IEmbedShape['props'] {
        return {
            w: 400,
            h: 300,
            url: null,
        }
    }

    indicator(shape: IEmbedShape) {
        return <rect width={shape.props.w} height={shape.props.h} />
    }

    component(shape: IEmbedShape) {
        const [inputUrl, setInputUrl] = useState('');
        const [error, setError] = useState('');
        const { isAuthenticated, setIsAuthenticated, accessToken, setAccessToken } = useGoogleAuth();

        const handleGoogleAuth = useCallback((docId: string) => {
            // Create message handler before opening window
            const messageHandler = (event: MessageEvent) => {
                if (event.origin !== window.location.origin) return;
                if (event.data.type === 'auth-complete') {
                    console.log('Auth complete received', event.data);
                    setAccessToken(event.data.accessToken);
                    setIsAuthenticated(true);
                    const embedUrl = `https://docs.google.com/document/d/${docId}/preview?embedded=true&access_token=${event.data.accessToken}`;
                    this.editor.updateShape<IEmbedShape>({
                        id: shape.id,
                        type: 'Embed',
                        props: { ...shape.props, url: embedUrl }
                    });
                    // Clean up
                    window.removeEventListener('message', messageHandler);
                }
            };

            // Add message listener
            window.addEventListener('message', messageHandler);

            // Open auth window with additional parameters
            const authWindow = window.open(
                `https://accounts.google.com/o/oauth2/v2/auth?` +
                `client_id=${import.meta.env.VITE_GOOGLE_CLIENT_ID}` +
                `&redirect_uri=${window.location.origin}/auth/callback` +
                `&response_type=token` +
                `&scope=https://www.googleapis.com/auth/drive.readonly` +
                `&prompt=consent` +
                `&access_type=online` +
                `&state=${encodeURIComponent(docId)}`,
                'googleAuth',
                'width=500,height=600'
            );

            if (!authWindow) {
                setError('Popup blocked. Please allow popups and try again.');
                return;
            }

            // Simplified window check
            const checkWindow = setInterval(() => {
                try {
                    if (!authWindow || authWindow.closed) {
                        clearInterval(checkWindow);
                        window.removeEventListener('message', messageHandler);
                    }
                } catch (e) {
                    // Ignore COOP errors
                }
            }, 500);

            // Cleanup after 5 minutes
            setTimeout(() => {
                clearInterval(checkWindow);
                window.removeEventListener('message', messageHandler);
            }, 300000);

        }, []);

        const handleSubmit = useCallback((e: React.FormEvent) => {
            e.preventDefault();
            setError('');

            try {
                // Check if it's a Google Docs URL
                if (inputUrl.includes('docs.google.com')) {
                    const docId = inputUrl.match(/\/d\/([a-zA-Z0-9-_]+)/)?.[1];
                    if (!docId) {
                        setError('Invalid Google Docs URL');
                        return;
                    }

                    if (!isAuthenticated) {
                        handleGoogleAuth(docId);
                        return;
                    }

                    // If already authenticated, use preview URL
                    const embedUrl = `https://docs.google.com/document/d/${docId}/preview`;
                    this.editor.updateShape<IEmbedShape>({
                        id: shape.id,
                        type: 'Embed',
                        props: { ...shape.props, url: embedUrl }
                    });
                } else {
                    // For non-Google URLs
                    this.editor.updateShape<IEmbedShape>({
                        id: shape.id,
                        type: 'Embed',
                        props: { ...shape.props, url: inputUrl }
                    });
                }
            } catch (err) {
                setError('Error processing URL');
                console.error(err);
            }
        }, [inputUrl, isAuthenticated]);

        if (!shape.props.url) {
            return (
                <div
                    style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '20px',
                        pointerEvents: 'all'
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    <form
                        onSubmit={handleSubmit}
                        style={{ width: '100%' }}
                        onPointerDown={(e) => e.stopPropagation()}
                    >
                        <div
                            contentEditable
                            suppressContentEditableWarning
                            style={{
                                width: '100%',
                                padding: '8px',
                                marginBottom: '10px',
                                border: '1px solid #ccc',
                                borderRadius: '4px',
                                minHeight: '36px',
                                cursor: 'text',
                                background: 'white'
                            }}
                            onKeyDown={(e) => {
                                e.stopPropagation();
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSubmit(e as any);
                                }
                            }}
                            onInput={(e) => {
                                setInputUrl(e.currentTarget.textContent || '');
                            }}
                            onPaste={(e) => {
                                e.preventDefault();
                                const text = e.clipboardData.getData('text/plain');
                                document.execCommand('insertText', false, text);
                            }}
                            onPointerDown={(e) => {
                                e.stopPropagation();
                            }}
                            onClick={(e) => {
                                e.stopPropagation();
                            }}
                        />
                        <button
                            type="submit"
                            style={{
                                pointerEvents: 'all',
                                touchAction: 'manipulation',
                                padding: '8px 16px',
                                cursor: 'pointer'
                            }}
                            onPointerDown={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            Embed Content
                        </button>
                    </form>
                    {error && <p style={{ color: 'red', marginTop: '10px' }}>{error}</p>}
                </div>
            );
        }

        return (
            <div style={{
                width: `${shape.props.w}px`,
                height: `${shape.props.h}px`,
                overflow: 'hidden',
            }}>
                <iframe
                    src={shape.props.url}
                    width="100%"
                    height="100%"
                    style={{ border: 'none' }}
                    allowFullScreen
                />
            </div>
        );
    }

    // ... rest of your utility methods ...
}
