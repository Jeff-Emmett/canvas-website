type Settings = {
  apiKey: string
  provider: 'anthropic' | 'openai'
}

class MakeRealSettings {
  private settings: Settings = {
    apiKey: '',
    provider: 'anthropic',
  }

  get() {
    return this.settings
  }

  set(settings: Partial<Settings>) {
    this.settings = { ...this.settings, ...settings }
    localStorage.setItem('makereal_settings_2', JSON.stringify(this.settings))
  }
}

export const makeRealSettings = new MakeRealSettings() 
export const Provider = makeRealSettings.get().provider