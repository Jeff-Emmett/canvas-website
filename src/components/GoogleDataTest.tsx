// Simple test component for Google Data Sovereignty OAuth flow
import { useState, useEffect } from 'react';
import {
  initiateGoogleAuth,
  handleGoogleCallback,
  parseCallbackParams,
  isGoogleAuthenticated,
  getGrantedScopes,
  generateMasterKey,
  importGmail,
  importDrive,
  importPhotos,
  importCalendar,
  gmailStore,
  driveStore,
  photosStore,
  calendarStore,
  deleteDatabase,
  createShareService,
  type GoogleService,
  type ImportProgress,
  type ShareableItem
} from '../lib/google';

export function GoogleDataTest() {
  const [status, setStatus] = useState<string>('Initializing...');
  const [isAuthed, setIsAuthed] = useState(false);
  const [scopes, setScopes] = useState<string[]>([]);
  const [masterKey, setMasterKey] = useState<CryptoKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [storedCounts, setStoredCounts] = useState<{gmail: number; drive: number; photos: number; calendar: number}>({
    gmail: 0, drive: 0, photos: 0, calendar: 0
  });
  const [logs, setLogs] = useState<string[]>([]);
  const [viewingService, setViewingService] = useState<GoogleService | null>(null);
  const [viewItems, setViewItems] = useState<ShareableItem[]>([]);

  const addLog = (msg: string) => {
    console.log(msg);
    setLogs(prev => [...prev.slice(-20), `${new Date().toLocaleTimeString()}: ${msg}`]);
  };

  // Initialize on mount
  useEffect(() => {
    initializeService();
  }, []);

  // Check for OAuth callback - wait for masterKey to be ready
  useEffect(() => {
    const url = window.location.href;
    if (url.includes('/oauth/google/callback') && masterKey) {
      handleCallback(url);
    }
  }, [masterKey]);  // Re-run when masterKey becomes available

  async function initializeService() {
    try {
      // Generate or load master key
      const key = await generateMasterKey();
      setMasterKey(key);

      // Check if already authenticated
      const authed = await isGoogleAuthenticated();
      setIsAuthed(authed);

      if (authed) {
        const grantedScopes = await getGrantedScopes();
        setScopes(grantedScopes);
        setStatus('Authenticated with Google');
      } else {
        setStatus('Ready to connect to Google');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Initialization failed');
      setStatus('Error');
    }
  }

  async function handleCallback(url: string) {
    setStatus('Processing OAuth callback...');

    const params = parseCallbackParams(url);

    if (params.error) {
      setError(`OAuth error: ${params.error_description || params.error}`);
      setStatus('Error');
      return;
    }

    if (params.code && params.state && masterKey) {
      const result = await handleGoogleCallback(params.code, params.state, masterKey);

      if (result.success) {
        setIsAuthed(true);
        setScopes(result.scopes);
        setStatus('Successfully connected to Google!');
        // Clean up URL
        window.history.replaceState({}, '', '/');
      } else {
        setError(result.error || 'Callback failed');
        setStatus('Error');
      }
    }
  }

  async function connectGoogle() {
    setStatus('Redirecting to Google...');
    const services: GoogleService[] = ['gmail', 'drive', 'photos', 'calendar'];
    await initiateGoogleAuth(services);
  }

  async function resetAndReconnect() {
    addLog('Resetting: Clearing all data...');
    try {
      await deleteDatabase();
      addLog('Resetting: Database cleared');
      setIsAuthed(false);
      setScopes([]);
      setStoredCounts({ gmail: 0, drive: 0, photos: 0, calendar: 0 });
      setError(null);
      setStatus('Database cleared. Click Connect to re-authenticate.');
      addLog('Resetting: Done. Please re-connect to Google.');
    } catch (err) {
      addLog(`Resetting: ERROR - ${err}`);
    }
  }

  async function viewData(service: GoogleService) {
    if (!masterKey) return;
    addLog(`Viewing ${service} data...`);
    try {
      const shareService = createShareService(masterKey);
      const items = await shareService.listShareableItems(service, 20);
      addLog(`Found ${items.length} ${service} items`);
      setViewItems(items);
      setViewingService(service);
    } catch (err) {
      addLog(`View error: ${err}`);
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function refreshCounts() {
    const [gmail, drive, photos, calendar] = await Promise.all([
      gmailStore.count(),
      driveStore.count(),
      photosStore.count(),
      calendarStore.count()
    ]);
    setStoredCounts({ gmail, drive, photos, calendar });
  }

  async function testImportGmail() {
    addLog('Gmail: Starting...');
    if (!masterKey) {
      addLog('Gmail: ERROR - No master key');
      setError('No master key available');
      return;
    }
    setError(null);
    setImportProgress(null);
    setStatus('Importing Gmail (max 10 messages)...');
    try {
      addLog('Gmail: Calling importGmail...');
      const result = await importGmail(masterKey, {
        maxMessages: 10,
        onProgress: (p) => {
          addLog(`Gmail: Progress ${p.imported}/${p.total} - ${p.status}`);
          setImportProgress(p);
        }
      });
      addLog(`Gmail: Result - ${result.status}, ${result.imported} items`);
      setImportProgress(result);
      if (result.status === 'error') {
        addLog(`Gmail: ERROR - ${result.errorMessage}`);
        setError(result.errorMessage || 'Unknown error');
        setStatus('Gmail import failed');
      } else {
        setStatus(`Gmail import ${result.status}: ${result.imported} messages`);
      }
      await refreshCounts();
    } catch (err) {
      const errorMsg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      addLog(`Gmail: EXCEPTION - ${errorMsg}`);
      setError(errorMsg);
      setStatus('Gmail import error');
    }
  }

  async function testImportDrive() {
    if (!masterKey) return;
    setError(null);
    setStatus('Importing Drive (max 10 files)...');
    try {
      const result = await importDrive(masterKey, {
        maxFiles: 10,
        onProgress: (p) => setImportProgress(p)
      });
      setImportProgress(result);
      setStatus(`Drive import ${result.status}: ${result.imported} files`);
      await refreshCounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setStatus('Error');
    }
  }

  async function testImportPhotos() {
    if (!masterKey) return;
    setError(null);
    setStatus('Importing Photos (max 10 thumbnails)...');
    try {
      const result = await importPhotos(masterKey, {
        maxPhotos: 10,
        onProgress: (p) => setImportProgress(p)
      });
      setImportProgress(result);
      setStatus(`Photos import ${result.status}: ${result.imported} photos`);
      await refreshCounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setStatus('Error');
    }
  }

  async function testImportCalendar() {
    if (!masterKey) return;
    setError(null);
    setStatus('Importing Calendar (max 20 events)...');
    try {
      const result = await importCalendar(masterKey, {
        maxEvents: 20,
        onProgress: (p) => setImportProgress(p)
      });
      setImportProgress(result);
      setStatus(`Calendar import ${result.status}: ${result.imported} events`);
      await refreshCounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setStatus('Error');
    }
  }

  const buttonStyle = {
    padding: '10px 16px',
    fontSize: '14px',
    background: '#1a73e8',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    marginRight: '10px',
    marginBottom: '10px'
  };

  return (
    <div style={{
      padding: '20px',
      fontFamily: 'system-ui, sans-serif',
      maxWidth: '600px',
      margin: '40px auto'
    }}>
      <h1>Google Data Sovereignty Test</h1>

      <div style={{
        padding: '15px',
        background: error ? '#fee' : '#f0f0f0',
        borderRadius: '8px',
        marginBottom: '20px'
      }}>
        <strong>Status:</strong> {status}
        {error && (
          <div style={{
            color: 'red',
            marginTop: '10px',
            padding: '10px',
            background: '#fdd',
            borderRadius: '4px',
            fontFamily: 'monospace',
            fontSize: '12px',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all'
          }}>
            <strong>Error:</strong> {error}
          </div>
        )}
      </div>

      {!isAuthed ? (
        <button
          onClick={connectGoogle}
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            background: '#4285f4',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Connect Google Account
        </button>
      ) : (
        <div>
          <h3 style={{ color: 'green' }}>Connected!</h3>
          <p><strong>Granted scopes:</strong></p>
          <ul>
            {scopes.map(scope => (
              <li key={scope} style={{ fontSize: '12px', fontFamily: 'monospace' }}>
                {scope.replace('https://www.googleapis.com/auth/', '')}
              </li>
            ))}
          </ul>

          <h3>Test Import (Small Batches)</h3>
          <div style={{ marginBottom: '20px' }}>
            <button style={buttonStyle} onClick={testImportGmail}>
              Import Gmail (10)
            </button>
            <button style={buttonStyle} onClick={testImportDrive}>
              Import Drive (10)
            </button>
            <button style={buttonStyle} onClick={testImportPhotos}>
              Import Photos (10)
            </button>
            <button style={buttonStyle} onClick={testImportCalendar}>
              Import Calendar (20)
            </button>
          </div>

          {importProgress && (
            <div style={{
              padding: '10px',
              background: importProgress.status === 'error' ? '#fee' :
                          importProgress.status === 'completed' ? '#efe' : '#fff3e0',
              borderRadius: '4px',
              marginBottom: '15px'
            }}>
              <strong>{importProgress.service}:</strong> {importProgress.status}
              {importProgress.status === 'importing' && (
                <span> - {importProgress.imported}/{importProgress.total}</span>
              )}
              {importProgress.status === 'completed' && (
                <span> - {importProgress.imported} items imported</span>
              )}
              {importProgress.errorMessage && (
                <div style={{ color: 'red', marginTop: '5px' }}>{importProgress.errorMessage}</div>
              )}
            </div>
          )}

          <h3>Stored Data (Encrypted in IndexedDB)</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>Gmail</td>
                <td style={{ padding: '8px', borderBottom: '1px solid #ddd', textAlign: 'right' }}>{storedCounts.gmail} messages</td>
                <td style={{ padding: '8px', borderBottom: '1px solid #ddd', textAlign: 'right' }}>
                  {storedCounts.gmail > 0 && <button onClick={() => viewData('gmail')} style={{ fontSize: '12px', padding: '4px 8px' }}>View</button>}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>Drive</td>
                <td style={{ padding: '8px', borderBottom: '1px solid #ddd', textAlign: 'right' }}>{storedCounts.drive} files</td>
                <td style={{ padding: '8px', borderBottom: '1px solid #ddd', textAlign: 'right' }}>
                  {storedCounts.drive > 0 && <button onClick={() => viewData('drive')} style={{ fontSize: '12px', padding: '4px 8px' }}>View</button>}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>Photos</td>
                <td style={{ padding: '8px', borderBottom: '1px solid #ddd', textAlign: 'right' }}>{storedCounts.photos} photos</td>
                <td style={{ padding: '8px', borderBottom: '1px solid #ddd', textAlign: 'right' }}>
                  {storedCounts.photos > 0 && <button onClick={() => viewData('photos')} style={{ fontSize: '12px', padding: '4px 8px' }}>View</button>}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>Calendar</td>
                <td style={{ padding: '8px', borderBottom: '1px solid #ddd', textAlign: 'right' }}>{storedCounts.calendar} events</td>
                <td style={{ padding: '8px', borderBottom: '1px solid #ddd', textAlign: 'right' }}>
                  {storedCounts.calendar > 0 && <button onClick={() => viewData('calendar')} style={{ fontSize: '12px', padding: '4px 8px' }}>View</button>}
                </td>
              </tr>
            </tbody>
          </table>

          {viewingService && viewItems.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <h4>
                {viewingService.charAt(0).toUpperCase() + viewingService.slice(1)} Items (Decrypted)
                <button onClick={() => { setViewingService(null); setViewItems([]); }} style={{ marginLeft: '10px', fontSize: '12px' }}>Close</button>
              </h4>
              <div style={{ maxHeight: '300px', overflow: 'auto', border: '1px solid #ddd', borderRadius: '4px' }}>
                {viewItems.map((item, i) => (
                  <div key={item.id} style={{
                    padding: '10px',
                    borderBottom: '1px solid #eee',
                    background: i % 2 === 0 ? '#fff' : '#f9f9f9'
                  }}>
                    <strong>{item.title}</strong>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      {new Date(item.date).toLocaleString()}
                    </div>
                    {item.preview && (
                      <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
                        {item.preview.substring(0, 100)}...
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          <button
            onClick={refreshCounts}
            style={{ ...buttonStyle, background: '#666', marginTop: '10px' }}
          >
            Refresh Counts
          </button>
          <button
            onClick={resetAndReconnect}
            style={{ ...buttonStyle, background: '#c00', marginTop: '10px' }}
          >
            Reset & Clear All Data
          </button>
        </div>
      )}

      <hr style={{ margin: '30px 0' }} />

      <h3>Activity Log</h3>
      <div style={{
        background: '#1a1a1a',
        color: '#0f0',
        padding: '10px',
        borderRadius: '4px',
        fontFamily: 'monospace',
        fontSize: '11px',
        height: '150px',
        overflow: 'auto',
        marginBottom: '20px'
      }}>
        {logs.length === 0 ? (
          <span style={{ color: '#666' }}>Click an import button to see activity...</span>
        ) : (
          logs.map((log, i) => <div key={i}>{log}</div>)
        )}
      </div>

      <details>
        <summary style={{ cursor: 'pointer' }}>Debug Info</summary>
        <pre style={{ fontSize: '11px', background: '#f5f5f5', padding: '10px', overflow: 'auto' }}>
{JSON.stringify({
  isAuthed,
  hasMasterKey: !!masterKey,
  scopeCount: scopes.length,
  storedCounts,
  importProgress,
  currentUrl: typeof window !== 'undefined' ? window.location.href : 'N/A'
}, null, 2)}
        </pre>
      </details>
    </div>
  );
}

export default GoogleDataTest;
