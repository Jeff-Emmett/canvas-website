/**
 * Miro Integration Modal
 *
 * Allows users to import Miro boards into their canvas.
 * Supports two methods:
 * 1. Paste JSON from miro-export CLI tool (recommended for casual use)
 * 2. Connect Miro API for direct imports (power users)
 */

import React, { useState, useCallback, useRef } from 'react';
import { useEditor } from 'tldraw';
import { importMiroJson } from '@/lib/miroImport';
import {
  getMiroApiKey,
  saveMiroApiKey,
  removeMiroApiKey,
  isMiroApiKeyConfigured,
  extractMiroBoardId,
  isValidMiroBoardUrl,
} from '@/lib/miroApiKey';

interface MiroIntegrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  username: string;
  isDarkMode?: boolean;
}

type Tab = 'import' | 'api-setup' | 'help';

export function MiroIntegrationModal({
  isOpen,
  onClose,
  username,
  isDarkMode: _isDarkMode = false,
}: MiroIntegrationModalProps) {
  const editor = useEditor();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<Tab>('import');
  const [jsonText, setJsonText] = useState('');
  const [boardUrl, setBoardUrl] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState({ stage: '', percent: 0 });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const hasApiKey = isMiroApiKeyConfigured(username);

  const resetState = useCallback(() => {
    setJsonText('');
    setBoardUrl('');
    setIsImporting(false);
    setProgress({ stage: '', percent: 0 });
    setError(null);
    setSuccess(null);
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [onClose, resetState]);

  // Import from JSON string
  const handleJsonImport = useCallback(async (json: string) => {
    setIsImporting(true);
    setError(null);
    setSuccess(null);

    try {
      const viewportBounds = editor.getViewportPageBounds();
      const offset = {
        x: viewportBounds.x + viewportBounds.w / 2,
        y: viewportBounds.y + viewportBounds.h / 2,
      };

      const result = await importMiroJson(
        json,
        { migrateAssets: true, offset },
        {
          onProgress: (stage, percent) => {
            setProgress({ stage, percent: Math.round(percent * 100) });
          },
        }
      );

      if (result.success && result.shapes.length > 0) {
        // Create assets first
        for (const asset of result.assets) {
          try {
            editor.createAssets([asset]);
          } catch (e) {
            console.warn('Failed to create asset:', e);
          }
        }

        // Create shapes
        editor.createShapes(result.shapes);

        // Select and zoom to imported shapes
        const shapeIds = result.shapes.map((s: any) => s.id);
        editor.setSelectedShapes(shapeIds);
        editor.zoomToSelection();

        setSuccess(`Imported ${result.shapesCreated} shapes${result.assetsUploaded > 0 ? ` and ${result.assetsUploaded} images` : ''}!`);

        // Auto-close after success
        setTimeout(() => handleClose(), 2000);
      } else {
        setError(result.errors.join(', ') || 'No shapes found in the import');
      }
    } catch (e) {
      console.error('Import error:', e);
      setError(e instanceof Error ? e.message : 'Failed to import Miro board');
    } finally {
      setIsImporting(false);
    }
  }, [editor, handleClose]);

  // Handle file upload
  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      await handleJsonImport(text);
    } catch (e) {
      setError('Failed to read file');
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [handleJsonImport]);

  // Handle paste import
  const handlePasteImport = useCallback(() => {
    if (!jsonText.trim()) {
      setError('Please paste Miro JSON data');
      return;
    }
    handleJsonImport(jsonText);
  }, [jsonText, handleJsonImport]);

  // Save API key
  const handleSaveApiKey = useCallback(() => {
    if (!apiKeyInput.trim()) {
      setError('Please enter your Miro API token');
      return;
    }
    saveMiroApiKey(apiKeyInput.trim(), username);
    setApiKeyInput('');
    setSuccess('Miro API token saved!');
    setTimeout(() => setSuccess(null), 2000);
  }, [apiKeyInput, username]);

  // Disconnect API
  const handleDisconnectApi = useCallback(() => {
    removeMiroApiKey(username);
    setSuccess('Miro API disconnected');
    setTimeout(() => setSuccess(null), 2000);
  }, [username]);

  if (!isOpen) return null;

  return (
    <div
      className="miro-modal-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999999,
        isolation: 'isolate',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        className="miro-modal"
        style={{
          backgroundColor: 'var(--color-panel, #ffffff)',
          borderRadius: '16px',
          width: '520px',
          maxWidth: '95vw',
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 80px rgba(0, 0, 0, 0.5)',
          position: 'relative',
          zIndex: 1000000,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--color-panel-contrast)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #FFD02F 0%, #F2CA00 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
          }}>
            📋
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: 'var(--color-text)' }}>
              Import from Miro
            </h2>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-3)' }}>
              Bring your Miro boards into the canvas
            </p>
          </div>
          <button
            onClick={handleClose}
            style={{
              background: '#f3f4f6',
              border: '2px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '18px',
              cursor: 'pointer',
              color: '#6b7280',
              padding: '6px 10px',
              fontWeight: 600,
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#e5e7eb';
              e.currentTarget.style.borderColor = '#d1d5db';
              e.currentTarget.style.color = '#374151';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#f3f4f6';
              e.currentTarget.style.borderColor = '#e5e7eb';
              e.currentTarget.style.color = '#6b7280';
            }}
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--color-panel-contrast)',
          padding: '0 16px',
        }}>
          {[
            { id: 'import', label: 'Import Board' },
            { id: 'api-setup', label: 'API Setup' },
            { id: 'help', label: 'How It Works' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              style={{
                padding: '12px 16px',
                fontSize: '13px',
                fontWeight: 500,
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid #FFD02F' : '2px solid transparent',
                color: activeTab === tab.id ? 'var(--color-text)' : 'var(--color-text-3)',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{
          padding: '20px 24px',
          overflowY: 'auto',
          flex: 1,
        }}>
          {/* Import Tab */}
          {activeTab === 'import' && (
            <div>
              {/* Method 1: JSON Upload */}
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{
                  margin: '0 0 8px 0',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--color-text)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}>
                  <span style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: '#FFD02F',
                    color: '#000',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: 700,
                  }}>1</span>
                  Upload JSON File
                </h3>
                <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: 'var(--color-text-3)', lineHeight: 1.5 }}>
                  Export your board using the miro-export CLI, then upload the JSON file here.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isImporting}
                  style={{
                    width: '100%',
                    padding: '16px',
                    fontSize: '14px',
                    fontWeight: 600,
                    borderRadius: '8px',
                    border: '2px dashed #9ca3af',
                    background: '#f9fafb',
                    color: '#374151',
                    cursor: isImporting ? 'wait' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    if (!isImporting) {
                      e.currentTarget.style.borderColor = '#FFD02F';
                      e.currentTarget.style.background = '#fffbeb';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#9ca3af';
                    e.currentTarget.style.background = '#f9fafb';
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  Choose JSON File
                </button>
              </div>

              {/* Divider */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                margin: '20px 0',
              }}>
                <div style={{ flex: 1, height: '1px', background: 'var(--color-panel-contrast)' }} />
                <span style={{ fontSize: '11px', color: 'var(--color-text-3)', textTransform: 'uppercase' }}>or</span>
                <div style={{ flex: 1, height: '1px', background: 'var(--color-panel-contrast)' }} />
              </div>

              {/* Method 2: Paste JSON */}
              <div>
                <h3 style={{
                  margin: '0 0 8px 0',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--color-text)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}>
                  <span style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: '#FFD02F',
                    color: '#000',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: 700,
                  }}>2</span>
                  Paste JSON
                </h3>
                <textarea
                  value={jsonText}
                  onChange={(e) => setJsonText(e.target.value)}
                  placeholder='[{"type":"sticky_note","id":"..."}]'
                  disabled={isImporting}
                  style={{
                    width: '100%',
                    height: '120px',
                    padding: '12px',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    borderRadius: '8px',
                    border: '2px solid #d1d5db',
                    background: '#ffffff',
                    color: '#1f2937',
                    resize: 'vertical',
                    marginBottom: '12px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#FFD02F';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(255, 208, 47, 0.2)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#d1d5db';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
                <button
                  onClick={handlePasteImport}
                  disabled={isImporting || !jsonText.trim()}
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    fontSize: '14px',
                    fontWeight: 600,
                    borderRadius: '8px',
                    border: jsonText.trim() ? '2px solid #e6b800' : '2px solid #d1d5db',
                    background: jsonText.trim() ? 'linear-gradient(135deg, #FFD02F 0%, #F2CA00 100%)' : '#f3f4f6',
                    color: jsonText.trim() ? '#000' : '#9ca3af',
                    cursor: isImporting || !jsonText.trim() ? 'not-allowed' : 'pointer',
                    boxShadow: jsonText.trim() ? '0 2px 8px rgba(255, 208, 47, 0.3)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {isImporting ? 'Importing...' : 'Import to Canvas'}
                </button>
              </div>

              {/* Progress */}
              {isImporting && (
                <div style={{ marginTop: '16px' }}>
                  <div style={{
                    height: '4px',
                    background: 'var(--color-muted-2)',
                    borderRadius: '2px',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${progress.percent}%`,
                      background: '#FFD02F',
                      transition: 'width 0.3s',
                    }} />
                  </div>
                  <p style={{ margin: '8px 0 0', fontSize: '12px', color: 'var(--color-text-3)', textAlign: 'center' }}>
                    {progress.stage}
                  </p>
                </div>
              )}

              {/* Error/Success messages */}
              {error && (
                <div style={{
                  marginTop: '16px',
                  padding: '12px',
                  borderRadius: '8px',
                  background: '#fee2e2',
                  color: '#dc2626',
                  fontSize: '13px',
                }}>
                  {error}
                </div>
              )}
              {success && (
                <div style={{
                  marginTop: '16px',
                  padding: '12px',
                  borderRadius: '8px',
                  background: '#dcfce7',
                  color: '#16a34a',
                  fontSize: '13px',
                }}>
                  {success}
                </div>
              )}
            </div>
          )}

          {/* API Setup Tab */}
          {activeTab === 'api-setup' && (
            <div>
              <div style={{
                padding: '16px',
                borderRadius: '8px',
                background: hasApiKey ? 'rgba(34, 197, 94, 0.1)' : 'var(--color-muted-1)',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}>
                <span style={{ fontSize: '24px' }}>{hasApiKey ? '✅' : '🔑'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)' }}>
                    {hasApiKey ? 'Miro API Connected' : 'Connect Miro API'}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-3)' }}>
                    {hasApiKey
                      ? 'You can import boards directly from Miro'
                      : 'For power users who want direct board imports'}
                  </div>
                </div>
              </div>

              {!hasApiKey ? (
                <>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '13px',
                      fontWeight: 500,
                      color: 'var(--color-text)',
                      marginBottom: '8px',
                    }}>
                      Miro API Access Token
                    </label>
                    <input
                      type="password"
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      placeholder="Enter your Miro access token..."
                      style={{
                        width: '100%',
                        padding: '14px',
                        fontSize: '14px',
                        borderRadius: '8px',
                        border: '2px solid #d1d5db',
                        background: '#ffffff',
                        color: '#1f2937',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#FFD02F';
                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(255, 208, 47, 0.2)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = '#d1d5db';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveApiKey();
                      }}
                    />
                  </div>
                  <button
                    onClick={handleSaveApiKey}
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      fontSize: '14px',
                      fontWeight: 600,
                      borderRadius: '8px',
                      border: '2px solid #e6b800',
                      background: 'linear-gradient(135deg, #FFD02F 0%, #F2CA00 100%)',
                      color: '#000',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(255, 208, 47, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    Save API Token
                  </button>
                </>
              ) : (
                <button
                  onClick={handleDisconnectApi}
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    fontSize: '14px',
                    fontWeight: 600,
                    borderRadius: '8px',
                    border: '2px solid #fca5a5',
                    background: '#fee2e2',
                    color: '#dc2626',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#fecaca';
                    e.currentTarget.style.borderColor = '#f87171';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#fee2e2';
                    e.currentTarget.style.borderColor = '#fca5a5';
                  }}
                >
                  Disconnect Miro API
                </button>
              )}

              {/* API Setup Instructions */}
              <div style={{
                marginTop: '24px',
                padding: '16px',
                borderRadius: '8px',
                background: 'var(--color-muted-1)',
                border: '1px solid var(--color-panel-contrast)',
              }}>
                <h4 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>
                  How to get your Miro API Token
                </h4>
                <ol style={{
                  margin: 0,
                  paddingLeft: '20px',
                  fontSize: '12px',
                  color: 'var(--color-text-3)',
                  lineHeight: 1.8,
                }}>
                  <li>Go to <a href="https://miro.com/app/settings/user-profile/apps" target="_blank" rel="noopener noreferrer" style={{ color: '#FFD02F' }}>Miro Developer Settings</a></li>
                  <li>Click "Create new app"</li>
                  <li>Give it a name (e.g., "Canvas Import")</li>
                  <li>Under "Permissions", enable:
                    <ul style={{ margin: '4px 0', paddingLeft: '16px' }}>
                      <li>boards:read</li>
                      <li>boards:write (optional)</li>
                    </ul>
                  </li>
                  <li>Click "Install app and get OAuth token"</li>
                  <li>Select your team and authorize</li>
                  <li>Copy the access token and paste it above</li>
                </ol>
                <p style={{ margin: '12px 0 0', fontSize: '11px', color: 'var(--color-text-3)' }}>
                  Note: This is a one-time setup. Your token is stored locally and never sent to our servers.
                </p>
              </div>

              {error && (
                <div style={{
                  marginTop: '16px',
                  padding: '12px',
                  borderRadius: '8px',
                  background: '#fee2e2',
                  color: '#dc2626',
                  fontSize: '13px',
                }}>
                  {error}
                </div>
              )}
              {success && (
                <div style={{
                  marginTop: '16px',
                  padding: '12px',
                  borderRadius: '8px',
                  background: '#dcfce7',
                  color: '#16a34a',
                  fontSize: '13px',
                }}>
                  {success}
                </div>
              )}
            </div>
          )}

          {/* Help Tab */}
          {activeTab === 'help' && (
            <div>
              <div style={{
                padding: '16px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, rgba(255, 208, 47, 0.1) 0%, rgba(242, 202, 0, 0.1) 100%)',
                border: '1px solid rgba(255, 208, 47, 0.3)',
                marginBottom: '20px',
              }}>
                <h3 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 600, color: 'var(--color-text)' }}>
                  Quick Start (Recommended)
                </h3>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-3)', lineHeight: 1.6 }}>
                  The easiest way to import a Miro board is using the <code style={{
                    background: 'var(--color-muted-2)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '12px',
                  }}>miro-export</code> CLI tool. This runs on your computer and exports your board as JSON.
                </p>
              </div>

              <h4 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 600, color: 'var(--color-text)' }}>
                Step-by-Step Instructions
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Step 1 */}
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: '#FFD02F',
                    color: '#000',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '13px',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}>1</div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '4px' }}>
                      Find your Miro Board ID
                    </div>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-3)', lineHeight: 1.5 }}>
                      Open your board in Miro. The Board ID is in the URL:
                    </p>
                    <code style={{
                      display: 'block',
                      margin: '8px 0',
                      padding: '8px 12px',
                      background: 'var(--color-muted-1)',
                      borderRadius: '6px',
                      fontSize: '11px',
                      color: 'var(--color-text)',
                      wordBreak: 'break-all',
                    }}>
                      miro.com/app/board/<span style={{ background: '#FFD02F', color: '#000', padding: '0 4px', borderRadius: '2px' }}>uXjVLxxxxxxxx=</span>/
                    </code>
                  </div>
                </div>

                {/* Step 2 */}
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: '#FFD02F',
                    color: '#000',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '13px',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}>2</div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '4px' }}>
                      Run the Export Command
                    </div>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-3)', lineHeight: 1.5 }}>
                      Open your terminal and run:
                    </p>
                    <code style={{
                      display: 'block',
                      margin: '8px 0',
                      padding: '8px 12px',
                      background: 'var(--color-muted-1)',
                      borderRadius: '6px',
                      fontSize: '11px',
                      color: 'var(--color-text)',
                      wordBreak: 'break-all',
                    }}>
                      npx miro-export -b YOUR_BOARD_ID -e json -o board.json
                    </code>
                    <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--color-text-3)' }}>
                      This will open Miro in a browser window. Sign in if prompted.
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: '#FFD02F',
                    color: '#000',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '13px',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}>3</div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '4px' }}>
                      Upload the JSON
                    </div>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-3)', lineHeight: 1.5 }}>
                      Go to the "Import Board" tab and upload your <code style={{
                        background: 'var(--color-muted-2)',
                        padding: '1px 4px',
                        borderRadius: '3px',
                        fontSize: '11px',
                      }}>board.json</code> file. That's it!
                    </p>
                  </div>
                </div>
              </div>

              {/* What Gets Imported */}
              <div style={{
                marginTop: '24px',
                padding: '16px',
                borderRadius: '8px',
                background: 'var(--color-muted-1)',
              }}>
                <h4 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>
                  What Gets Imported
                </h4>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '8px',
                  fontSize: '12px',
                }}>
                  {[
                    { icon: '📝', label: 'Sticky Notes' },
                    { icon: '🔷', label: 'Shapes' },
                    { icon: '📄', label: 'Text' },
                    { icon: '🖼️', label: 'Images' },
                    { icon: '🔗', label: 'Connectors' },
                    { icon: '🖼️', label: 'Frames' },
                    { icon: '🃏', label: 'Cards' },
                  ].map((item) => (
                    <div key={item.label} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: 'var(--color-text-3)',
                    }}>
                      <span style={{ fontSize: '14px' }}>{item.icon}</span>
                      {item.label}
                    </div>
                  ))}
                </div>
                <p style={{
                  margin: '12px 0 0',
                  fontSize: '11px',
                  color: 'var(--color-text-3)',
                  fontStyle: 'italic',
                }}>
                  Images are automatically downloaded and stored locally, so they'll persist even if you lose Miro access.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MiroIntegrationModal;
