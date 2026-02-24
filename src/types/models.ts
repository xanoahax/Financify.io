export type ThemeMode = 'light' | 'dark' | 'glass' | 'system'
export type AppLanguage = 'de' | 'en'

export type SubscriptionInterval = 'monthly' | 'yearly' | 'four-weekly' | 'custom-months'

export type SubscriptionStatus = 'active' | 'paused' | 'cancelled'

export interface Subscription {
  id: string
  name: string
  provider: string
  category: string
  tags: string[]
  amount: number
  currency?: string
  interval: SubscriptionInterval
  customIntervalMonths?: number
  startDate: string
  nextPaymentOverride?: string
  noticePeriodDays: number
  notes: string
  link: string
  status: SubscriptionStatus
  endDate?: string
  createdAt: string
  updatedAt: string
}

export type IncomeRecurring = 'none' | 'weekly' | 'monthly' | 'custom'

export interface IncomeEntry {
  id: string
  amount: number
  date: string
  source: string
  tags: string[]
  notes: string
  recurring: IncomeRecurring
  recurringIntervalDays?: number
  createdAt: string
  updatedAt: string
}

export type Frequency = 'monthly' | 'yearly'
export type EmploymentType = 'casual' | 'fixed'
export type FixedPayInterval = 'monthly' | 'biweekly' | 'weekly'

export interface ShiftJobConfig {
  id: string
  name: string
  employmentType: EmploymentType
  hourlyRate?: number
  salaryAmount?: number
  fixedPayInterval?: FixedPayInterval
  has13thSalary?: boolean
  has14thSalary?: boolean
  startDate?: string
}

export interface InterestScenarioInput {
  name: string
  startCapital: number
  recurringContribution: number
  contributionFrequency: Frequency
  annualInterestRate: number
  durationMonths: number
  interestFrequency: Frequency
  advancedEnabled: boolean
  annualInflationRate: number
  gainsTaxRate: number
  annualContributionIncrease: number
}

export interface InterestScenario {
  id: string
  input: InterestScenarioInput
  createdAt: string
  updatedAt: string
}

export interface Settings {
  language: AppLanguage
  theme: ThemeMode
  accentColor: string
  gradientOverlayEnabled: boolean
  gradientColorA: string
  gradientColorB: string
  backgroundImageBlurEnabled: boolean
  backgroundImageBlurAmount: number
  reducedMotion: boolean
  currency: 'EUR' | 'USD'
  shiftJobs: ShiftJobConfig[]
  defaultShiftJobId: string
  dateFormat: 'DD.MM.YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD'
  startOfWeek: 'monday' | 'sunday'
  privacyHideAmounts: boolean
}

export interface UserProfile {
  id: string
  name: string
  avatarDataUrl: string | null
  createdAt: string
  updatedAt: string
  lastOpenedAt: string
  onboardingCompleted: boolean
  authMode: 'none' | 'pin' | 'password'
  authSecretHash: string
}

export interface UiState {
  sidebarCollapsed: boolean
  globalSearch: string
}

export interface InterestPoint {
  month: number
  date: string
  contribution: number
  interestEarned: number
  balance: number
  totalContribution: number
  totalInterest: number
  realBalance?: number
}

export interface ToastMessage {
  id: string
  tone: 'success' | 'warning' | 'error' | 'info'
  text: string
  actionLabel?: string
  action?: () => void
  expiresInMs?: number
}

export interface UpdatePrompt {
  currentVersion: string
  version: string
  body?: string
  date?: string
}

export interface ProfileBackupPayload {
  meta: Pick<UserProfile, 'id' | 'name' | 'avatarDataUrl' | 'createdAt' | 'updatedAt' | 'lastOpenedAt' | 'onboardingCompleted' | 'authMode' | 'authSecretHash'>
  settings: Settings
  uiState: UiState
  backgroundImageDataUrl: string | null
  subscriptions: Subscription[]
  incomeEntries: IncomeEntry[]
  interestScenarios: InterestScenario[]
}

export interface AppBackup {
  backupSchema?: number
  appVersion?: string
  exportedAt: string
  scope?: 'single-profile' | 'all-profiles'
  activeProfileId?: string
  profile?: ProfileBackupPayload
  profiles?: ProfileBackupPayload[]
  // Legacy single-profile fallback fields.
  settings?: Settings
  uiState?: UiState
  backgroundImageDataUrl?: string | null
  subscriptions?: Subscription[]
  incomeEntries?: IncomeEntry[]
  interestScenarios?: InterestScenario[]
}
