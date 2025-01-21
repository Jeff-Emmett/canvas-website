import {
  TLUiDialogProps,
  TldrawUiButton,
  TldrawUiButtonLabel,
  TldrawUiDialogBody,
  TldrawUiDialogCloseButton,
  TldrawUiDialogFooter,
  TldrawUiDialogHeader,
  TldrawUiDialogTitle,
  TldrawUiIcon,
  TldrawUiInput,
  useReactor,
  useValue,
} from 'tldraw'
import { Provider, makeRealSettings } from '../makeRealSettings'

export function SettingsDialog({ onClose }: TLUiDialogProps) {
  // Get settings and set up local storage sync
  const settings = useValue('settings', () => makeRealSettings.get(), [])
  
  useReactor(
    'update settings local storage',
    () => {
      localStorage.setItem('makereal_settings_2', JSON.stringify(makeRealSettings.get()))
    },
    []
  )

  return (
    <>
      <TldrawUiDialogHeader>
        <TldrawUiDialogTitle>Settings</TldrawUiDialogTitle>
        <TldrawUiDialogCloseButton />
      </TldrawUiDialogHeader>
      
      <TldrawUiDialogBody
        style={{ maxWidth: 350, display: 'flex', flexDirection: 'column', gap: 8 }}
      >
        {/* Provider Selection */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'row', gap: 4 }}>
            <label style={{ flexGrow: 2 }}>Provider</label>
          </div>
          <select
            className="apikey_select"
            value={settings.provider}
            onChange={(e) => {
              makeRealSettings.set({ 
                ...settings, 
                provider: e.target.value as any 
              })
            }}
          >
            <option value="anthropic">Anthropic</option>
            <option value="openai">OpenAI</option>
          </select>
        </div>

        {/* API Keys Section */}
        <hr style={{ margin: '12px 0px' }} />
        {Provider.map((provider: any) => {
          if (provider.id === 'google') return null
          const value = settings.keys[provider.id]
          return (
            <ApiKeyInput
              key={provider.name + 'key'}
              provider={provider}
              value={value}
              warning={
                value === '' && 
                (settings.provider === provider.id || settings.provider === 'any')
              }
            />
          )
        })}

        {/* Save Button */}
        <TldrawUiDialogFooter className="tlui-dialog__footer__actions">
          <TldrawUiButton
            type="primary"
            onClick={async () => {
              onClose()
            }}
          >
            <TldrawUiButtonLabel>Save</TldrawUiButtonLabel>
          </TldrawUiButton>
        </TldrawUiDialogFooter>
      </TldrawUiDialogBody>
    </>
  )
}

// Helper component for API key inputs
function ApiKeyInput({
  provider,
  value,
  warning,
}: {
  provider: (typeof Provider)[number]
  value: string
  warning: boolean
}) {
  const isValid = value.length === 0 || provider.validate(value)
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', flexDirection: 'row', gap: 4, alignItems: 'center' }}>
        <label style={{ flexGrow: 2, color: warning ? 'red' : 'var(--color-text)' }}>
          {provider.name} API key
        </label>
        <a style={{ cursor: 'pointer', pointerEvents: 'all' }} target="_blank" href={provider.help}>
          <TldrawUiIcon
            className="apikey_help_icon"
            small
            icon={provider.validate(value) ? 'check' : 'question-mark-circle'}
          />
        </a>
      </div>
      <TldrawUiInput
        className={`apikey_input ${isValid ? '' : 'apikey_input__invalid'}`}
        value={value}
        placeholder="Enter API key"
        onValueChange={(value) => {
          makeRealSettings.update((s) => ({ 
            ...s, 
            keys: { ...s.keys, [provider.id]: value } 
          }))
        }}
      />
    </div>
  )
} 