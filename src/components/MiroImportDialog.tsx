/**
 * Miro Import Dialog
 *
 * A dialog component for importing Miro boards into the tldraw canvas.
 * Supports both JSON file upload and pasting JSON directly.
 */

import { useState, useCallback, useRef } from 'react'
import { useEditor } from 'tldraw'
import { importMiroJson, isValidMiroUrl, MiroImportResult } from '@/lib/miroImport'

interface MiroImportDialogProps {
  isOpen: boolean
  onClose: () => void
}

type ImportMethod = 'json-file' | 'json-paste'

export function MiroImportDialog({ isOpen, onClose }: MiroImportDialogProps) {
  const editor = useEditor()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [importMethod, setImportMethod] = useState<ImportMethod>('json-file')
  const [jsonText, setJsonText] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const [progress, setProgress] = useState({ stage: '', percent: 0 })
  const [result, setResult] = useState<MiroImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const resetState = useCallback(() => {
    setJsonText('')
    setIsImporting(false)
    setProgress({ stage: '', percent: 0 })
    setResult(null)
    setError(null)
  }, [])

  const handleClose = useCallback(() => {
    resetState()
    onClose()
  }, [onClose, resetState])

  const handleImport = useCallback(async (jsonString: string) => {
    setIsImporting(true)
    setError(null)
    setResult(null)

    try {
      // Get current viewport center for import offset
      const viewportBounds = editor.getViewportPageBounds()
      const offset = {
        x: viewportBounds.x + viewportBounds.w / 2,
        y: viewportBounds.y + viewportBounds.h / 2,
      }

      const importResult = await importMiroJson(
        jsonString,
        {
          migrateAssets: true,
          offset,
        },
        {
          onProgress: (stage, percent) => {
            setProgress({ stage, percent: Math.round(percent * 100) })
          },
        }
      )

      setResult(importResult)

      if (importResult.success && importResult.shapes.length > 0) {
        // Create assets first
        if (importResult.assets.length > 0) {
          for (const asset of importResult.assets) {
            try {
              editor.createAssets([asset])
            } catch (e) {
              console.warn('Failed to create asset:', e)
            }
          }
        }

        // Create shapes
        editor.createShapes(importResult.shapes)

        // Select and zoom to imported shapes
        const shapeIds = importResult.shapes.map((s: any) => s.id)
        editor.setSelectedShapes(shapeIds)
        editor.zoomToSelection()
      }
    } catch (e) {
      console.error('Import error:', e)
      setError(e instanceof Error ? e.message : 'Failed to import Miro board')
    } finally {
      setIsImporting(false)
    }
  }, [editor])

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      await handleImport(text)
    } catch (e) {
      setError('Failed to read file')
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [handleImport])

  const handlePasteImport = useCallback(() => {
    if (!jsonText.trim()) {
      setError('Please paste Miro JSON data')
      return
    }
    handleImport(jsonText)
  }, [jsonText, handleImport])

  if (!isOpen) return null

  return (
    <div className="miro-import-overlay" onClick={handleClose}>
      <div className="miro-import-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="miro-import-header">
          <h2>Import from Miro</h2>
          <button className="miro-import-close" onClick={handleClose}>
            &times;
          </button>
        </div>

        <div className="miro-import-content">
          {/* Import Method Tabs */}
          <div className="miro-import-tabs">
            <button
              className={`miro-import-tab ${importMethod === 'json-file' ? 'active' : ''}`}
              onClick={() => setImportMethod('json-file')}
              disabled={isImporting}
            >
              Upload JSON File
            </button>
            <button
              className={`miro-import-tab ${importMethod === 'json-paste' ? 'active' : ''}`}
              onClick={() => setImportMethod('json-paste')}
              disabled={isImporting}
            >
              Paste JSON
            </button>
          </div>

          {/* JSON File Upload */}
          {importMethod === 'json-file' && (
            <div className="miro-import-section">
              <p className="miro-import-help">
                Upload a JSON file exported from Miro using the{' '}
                <a href="https://github.com/jolle/miro-export" target="_blank" rel="noopener noreferrer">
                  miro-export
                </a>{' '}
                CLI tool:
              </p>
              <pre className="miro-import-code">
                npx miro-export -b YOUR_BOARD_ID -e json -o board.json
              </pre>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                disabled={isImporting}
                className="miro-import-file-input"
              />
              <button
                className="miro-import-button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
              >
                Choose JSON File
              </button>
            </div>
          )}

          {/* JSON Paste */}
          {importMethod === 'json-paste' && (
            <div className="miro-import-section">
              <p className="miro-import-help">
                Paste your Miro board JSON data below:
              </p>
              <textarea
                className="miro-import-textarea"
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                placeholder='[{"type":"sticky_note","id":"...","x":0,"y":0,...}]'
                disabled={isImporting}
                rows={10}
              />
              <button
                className="miro-import-button"
                onClick={handlePasteImport}
                disabled={isImporting || !jsonText.trim()}
              >
                Import
              </button>
            </div>
          )}

          {/* Progress */}
          {isImporting && (
            <div className="miro-import-progress">
              <div className="miro-import-progress-bar">
                <div
                  className="miro-import-progress-fill"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              <p className="miro-import-progress-text">{progress.stage}</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="miro-import-error">
              <strong>Error:</strong> {error}
            </div>
          )}

          {/* Result */}
          {result && (
            <div className={`miro-import-result ${result.success ? 'success' : 'failed'}`}>
              {result.success ? (
                <>
                  <p>Successfully imported {result.shapesCreated} shapes!</p>
                  {result.assetsUploaded > 0 && (
                    <p>Migrated {result.assetsUploaded} images to local storage.</p>
                  )}
                  {result.errors.length > 0 && (
                    <p className="miro-import-warnings">
                      Warnings: {result.errors.join(', ')}
                    </p>
                  )}
                  <button className="miro-import-button" onClick={handleClose}>
                    Done
                  </button>
                </>
              ) : (
                <>
                  <p>Import failed: {result.errors.join(', ')}</p>
                  <button className="miro-import-button" onClick={resetState}>
                    Try Again
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .miro-import-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
        }

        .miro-import-dialog {
          background: var(--color-panel, white);
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
          width: 90%;
          max-width: 500px;
          max-height: 90vh;
          overflow-y: auto;
        }

        .miro-import-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid var(--color-divider, #eee);
        }

        .miro-import-header h2 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
        }

        .miro-import-close {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: var(--color-text, #333);
          padding: 0;
          line-height: 1;
        }

        .miro-import-content {
          padding: 20px;
        }

        .miro-import-tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 20px;
        }

        .miro-import-tab {
          flex: 1;
          padding: 10px 16px;
          border: 1px solid var(--color-divider, #ddd);
          background: var(--color-background, #f5f5f5);
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s;
        }

        .miro-import-tab:hover:not(:disabled) {
          background: var(--color-muted-1, #e0e0e0);
        }

        .miro-import-tab.active {
          background: var(--color-primary, #2563eb);
          color: white;
          border-color: var(--color-primary, #2563eb);
        }

        .miro-import-tab:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .miro-import-section {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .miro-import-help {
          margin: 0;
          font-size: 14px;
          color: var(--color-text-1, #666);
          line-height: 1.5;
        }

        .miro-import-help a {
          color: var(--color-primary, #2563eb);
        }

        .miro-import-code {
          background: var(--color-background, #f5f5f5);
          padding: 12px;
          border-radius: 6px;
          font-family: monospace;
          font-size: 12px;
          overflow-x: auto;
          margin: 0;
        }

        .miro-import-file-input {
          display: none;
        }

        .miro-import-textarea {
          width: 100%;
          padding: 12px;
          border: 1px solid var(--color-divider, #ddd);
          border-radius: 8px;
          font-family: monospace;
          font-size: 12px;
          resize: vertical;
          background: var(--color-background, white);
          color: var(--color-text, #333);
        }

        .miro-import-textarea:focus {
          outline: none;
          border-color: var(--color-primary, #2563eb);
        }

        .miro-import-button {
          padding: 12px 24px;
          background: var(--color-primary, #2563eb);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s;
        }

        .miro-import-button:hover:not(:disabled) {
          background: var(--color-primary-dark, #1d4ed8);
        }

        .miro-import-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .miro-import-progress {
          margin-top: 20px;
        }

        .miro-import-progress-bar {
          height: 8px;
          background: var(--color-background, #f0f0f0);
          border-radius: 4px;
          overflow: hidden;
        }

        .miro-import-progress-fill {
          height: 100%;
          background: var(--color-primary, #2563eb);
          transition: width 0.3s ease;
        }

        .miro-import-progress-text {
          margin: 8px 0 0;
          font-size: 13px;
          color: var(--color-text-1, #666);
          text-align: center;
        }

        .miro-import-error {
          margin-top: 16px;
          padding: 12px;
          background: #fee2e2;
          color: #dc2626;
          border-radius: 8px;
          font-size: 14px;
        }

        .miro-import-result {
          margin-top: 20px;
          padding: 16px;
          border-radius: 8px;
          text-align: center;
        }

        .miro-import-result.success {
          background: #dcfce7;
          color: #16a34a;
        }

        .miro-import-result.failed {
          background: #fee2e2;
          color: #dc2626;
        }

        .miro-import-result p {
          margin: 0 0 12px;
        }

        .miro-import-warnings {
          font-size: 12px;
          opacity: 0.8;
        }
      `}</style>
    </div>
  )
}

export default MiroImportDialog
