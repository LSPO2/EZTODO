import { getRepositories } from './repositories'

const AI_SETTINGS_KEY = 'ai.provider.config.v1'

export interface AIProviderSettings {
  providerName: string
  apiBase: string
  model: string
}

export const DEFAULT_AI_SETTINGS: AIProviderSettings = {
  providerName: 'DeepSeek',
  apiBase: 'https://api.deepseek.com',
  model: 'deepseek-chat',
}

let sessionApiKey = ''

export function setSessionApiKey(apiKey: string): void {
  sessionApiKey = apiKey.trim()
}

export function getSessionApiKey(): string {
  return sessionApiKey
}

export function clearSessionApiKey(): void {
  sessionApiKey = ''
}

export function validateAISettings(settings: AIProviderSettings): string | null {
  if (!settings.providerName.trim()) return '请填写服务商名称'
  if (!settings.model.trim()) return '请填写模型名称'

  try {
    const url = new URL(settings.apiBase)
    const isLocalHttp = url.protocol === 'http:' && ['localhost', '127.0.0.1', '::1'].includes(url.hostname)
    if (url.protocol !== 'https:' && !isLocalHttp) {
      return 'API Base 必须使用 HTTPS；仅本机地址允许 HTTP'
    }
  } catch {
    return 'API Base 不是有效网址'
  }

  return null
}

export function normalizeAISettings(settings: AIProviderSettings): AIProviderSettings {
  return {
    providerName: settings.providerName.trim(),
    apiBase: settings.apiBase.trim().replace(/\/+$/, ''),
    model: settings.model.trim(),
  }
}

export async function loadAISettings(): Promise<AIProviderSettings> {
  const repositories = await getRepositories()
  const raw = await repositories.settings.get(AI_SETTINGS_KEY)
  if (!raw) return DEFAULT_AI_SETTINGS

  try {
    const parsed = JSON.parse(raw) as Partial<AIProviderSettings>
    return normalizeAISettings({
      providerName: parsed.providerName || DEFAULT_AI_SETTINGS.providerName,
      apiBase: parsed.apiBase || DEFAULT_AI_SETTINGS.apiBase,
      model: parsed.model || DEFAULT_AI_SETTINGS.model,
    })
  } catch {
    return DEFAULT_AI_SETTINGS
  }
}

export async function saveAISettings(settings: AIProviderSettings): Promise<AIProviderSettings> {
  const normalized = normalizeAISettings(settings)
  const validationError = validateAISettings(normalized)
  if (validationError) throw new Error(validationError)

  const repositories = await getRepositories()
  await repositories.settings.set(AI_SETTINGS_KEY, JSON.stringify(normalized))
  return normalized
}
