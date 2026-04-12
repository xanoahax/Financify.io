import { useCallback, useEffect, useRef, useState } from 'react'
import { openUrl } from '@tauri-apps/plugin-opener'
import packageJson from '../../package.json'
import { useCardRowStagger } from '../hooks/useCardRowStagger'
import { useGuardedBackdropClose } from '../hooks/useGuardedBackdropClose'
import { useAppContext } from '../state/useAppContext'
import type { AppBackup, EmploymentType, FixedPayInterval, IncomeEntry, ShiftJobConfig } from '../types/models'
import { addDays, compareDateStrings } from '../utils/date'
import { saveTextFileWithDialog } from '../utils/csv'
import { getCurrencySymbol } from '../utils/format'
import { tx } from '../utils/i18n'
import { calculateShiftIncome } from '../utils/shiftIncome'
const REPORT_ISSUE_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSfjM6Orz05tAydFMepZCVP6w2L88xFloDB6TVqfV5Q5Ph2yOw/viewform?usp=publish-editor'

interface JobDraftState {
  name: string
  employmentType: EmploymentType
  hourlyRate: string
  salaryAmount: string
  fixedPayInterval: FixedPayInterval
  salaryPaymentsPerYear: '12' | '13' | '14'
  startDate: string
}

type FixedJobChangeScope = 'retroactive' | 'from-date'
const AVATAR_CROP_SIZE = 320

function makeJobId(): string {
  return `job-${crypto.randomUUID()}`
}

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10)
}

function salaryPaymentsToFlags(value: JobDraftState['salaryPaymentsPerYear']): { has13thSalary: boolean; has14thSalary: boolean } {
  if (value === '14') {
    return { has13thSalary: true, has14thSalary: true }
  }
  if (value === '13') {
    return { has13thSalary: true, has14thSalary: false }
  }
  return { has13thSalary: false, has14thSalary: false }
}

function flagsToSalaryPayments(has13thSalary: boolean, has14thSalary: boolean): JobDraftState['salaryPaymentsPerYear'] {
  if (has14thSalary) {
    return '14'
  }
  if (has13thSalary) {
    return '13'
  }
  return '12'
}

function isDateString(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function resolveFixedSalaryRevisions(job: ShiftJobConfig): NonNullable<ShiftJobConfig['fixedSalaryRevisions']> {
  const revisions = Array.isArray(job.fixedSalaryRevisions)
    ? job.fixedSalaryRevisions
        .filter((revision) => isDateString(revision.startDate))
        .map((revision) => ({
          startDate: revision.startDate,
          endDate: isDateString(revision.endDate) ? revision.endDate : null,
          salaryAmount: Number(revision.salaryAmount),
          fixedPayInterval: revision.fixedPayInterval ?? 'monthly',
          has13thSalary: Boolean(revision.has13thSalary),
          has14thSalary: Boolean(revision.has14thSalary),
        }))
        .filter((revision) => Number.isFinite(revision.salaryAmount) && revision.salaryAmount > 0)
        .sort((left, right) => compareDateStrings(left.startDate, right.startDate))
    : []
  if (revisions.length > 0) {
    return revisions
  }
  const salaryAmount = Number(job.salaryAmount)
  if (!Number.isFinite(salaryAmount) || salaryAmount <= 0) {
    return []
  }
  return [
    {
      startDate: isDateString(job.startDate) ? job.startDate : todayDateString(),
      endDate: null,
      salaryAmount,
      fixedPayInterval: job.fixedPayInterval ?? 'monthly',
      has13thSalary: Boolean(job.has13thSalary),
      has14thSalary: Boolean(job.has14thSalary),
    },
  ]
}

function extractShiftTimeRange(notes: string): { startTime: string; endTime: string } | null {
  const match = notes.match(/(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/)
  if (!match) {
    return null
  }
  const startTime = match[1] ?? ''
  const endTime = match[2] ?? ''
  if (!startTime || !endTime) {
    return null
  }
  return { startTime, endTime }
}

function profileInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) {
    return 'U'
  }
  const first = parts[0]?.[0] ?? ''
  const second = parts.length > 1 ? parts[1]?.[0] ?? '' : ''
  return `${first}${second}`.toUpperCase()
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('read-failed'))
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('invalid-result'))
        return
      }
      resolve(reader.result)
    }
    reader.readAsDataURL(file)
  })
}

function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('image-load-failed'))
    image.src = dataUrl
  })
}

async function buildCroppedAvatarDataUrl(dataUrl: string, zoom: number, offsetX: number, offsetY: number): Promise<string> {
  const image = await loadImageFromDataUrl(dataUrl)
  const size = AVATAR_CROP_SIZE
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('canvas-not-supported')
  }

  const baseScale = Math.max(size / image.width, size / image.height)
  const appliedScale = baseScale * zoom
  const drawWidth = image.width * appliedScale
  const drawHeight = image.height * appliedScale
  const dx = (size - drawWidth) / 2 + offsetX
  const dy = (size - drawHeight) / 2 + offsetY

  ctx.clearRect(0, 0, size, size)
  ctx.drawImage(image, dx, dy, drawWidth, drawHeight)
  return canvas.toDataURL('image/png')
}

function getAvatarCropBounds(imageWidth: number, imageHeight: number, zoom: number): { maxOffsetX: number; maxOffsetY: number } {
  const baseScale = Math.max(AVATAR_CROP_SIZE / imageWidth, AVATAR_CROP_SIZE / imageHeight)
  const appliedScale = baseScale * zoom
  const drawWidth = imageWidth * appliedScale
  const drawHeight = imageHeight * appliedScale
  return {
    maxOffsetX: Math.max(0, (drawWidth - AVATAR_CROP_SIZE) / 2),
    maxOffsetY: Math.max(0, (drawHeight - AVATAR_CROP_SIZE) / 2),
  }
}

function clampAvatarOffsets(
  offsetX: number,
  offsetY: number,
  imageSize: { width: number; height: number } | null,
  zoom: number,
): { offsetX: number; offsetY: number } {
  if (!imageSize) {
    return { offsetX, offsetY }
  }
  const { maxOffsetX, maxOffsetY } = getAvatarCropBounds(imageSize.width, imageSize.height, zoom)
  return {
    offsetX: Math.min(maxOffsetX, Math.max(-maxOffsetX, offsetX)),
    offsetY: Math.min(maxOffsetY, Math.max(-maxOffsetY, offsetY)),
  }
}

export function SettingsPage(): JSX.Element {
  const {
    settings,
    incomeEntries,
    setSettings,
    exportBackup,
    importBackup,
    clearAllData,
    updatesSupported,
    isCheckingForUpdates,
    isInstallingUpdate,
    checkForUpdates,
    skippedUpdateVersion,
    updateCheckError,
    profiles,
    activeProfile,
    renameProfile,
    updateProfileAvatar,
    deleteProfile,
    updateProfileProtection,
    updateIncomeEntry,
  } = useAppContext()
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('replace')
  const [importError, setImportError] = useState('')
  const [importSuccessMessage, setImportSuccessMessage] = useState('')
  const [confirmClearAllData, setConfirmClearAllData] = useState(false)
  const [confirmDeleteProfile, setConfirmDeleteProfile] = useState(false)
  const [renameProfileName, setRenameProfileName] = useState(activeProfile?.name ?? '')
  const [editProfileOpen, setEditProfileOpen] = useState(false)
  const [editAuthMode, setEditAuthMode] = useState<'none' | 'pin' | 'password'>('none')
  const [editAuthSecret, setEditAuthSecret] = useState('')
  const [editAuthSecretConfirm, setEditAuthSecretConfirm] = useState('')
  const [editProfileError, setEditProfileError] = useState('')
  const [savingProfileEdit, setSavingProfileEdit] = useState(false)
  const [avatarEditorOpen, setAvatarEditorOpen] = useState(false)
  const [avatarSourceDataUrl, setAvatarSourceDataUrl] = useState('')
  const [avatarImageSize, setAvatarImageSize] = useState<{ width: number; height: number } | null>(null)
  const [avatarZoom, setAvatarZoom] = useState(1.15)
  const [avatarOffsetX, setAvatarOffsetX] = useState(0)
  const [avatarOffsetY, setAvatarOffsetY] = useState(0)
  const [avatarEditorError, setAvatarEditorError] = useState('')
  const [avatarEditorSaving, setAvatarEditorSaving] = useState(false)
  const [avatarDragging, setAvatarDragging] = useState(false)
  const [avatarPreviewSize, setAvatarPreviewSize] = useState(AVATAR_CROP_SIZE)
  const pageRef = useRef<HTMLElement | null>(null)
  const avatarDragPointerIdRef = useRef<number | null>(null)
  const avatarDragStartRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null)
  const avatarPreviewRef = useRef<HTMLDivElement | null>(null)
  const [jobModalOpen, setJobModalOpen] = useState(false)
  const [jobModalMode, setJobModalMode] = useState<'create' | 'edit'>('create')
  const [editingJobId, setEditingJobId] = useState<string | null>(null)
  const [jobChangeScopeModalOpen, setJobChangeScopeModalOpen] = useState(false)
  const [jobDraft, setJobDraft] = useState<JobDraftState>({
    name: '',
    employmentType: 'casual',
    hourlyRate: '',
    salaryAmount: '',
    fixedPayInterval: 'monthly',
    salaryPaymentsPerYear: '12',
    startDate: todayDateString(),
  })
  const [jobModalError, setJobModalError] = useState('')
  const t = (de: string, en: string) => tx(settings.language, de, en)
  const currencySymbol = getCurrencySymbol(settings.currency)
  const casualJobs = settings.shiftJobs.filter((job) => job.employmentType === 'casual')
  const canDeleteProfile = profiles.length > 1
  const closeEditProfile = useCallback(() => setEditProfileOpen(false), [])
  const closeDeleteProfileConfirm = useCallback(() => setConfirmDeleteProfile(false), [])
  const closeClearAllDataConfirm = useCallback(() => setConfirmClearAllData(false), [])
  const closeImportSuccess = useCallback(() => setImportSuccessMessage(''), [])
  const closeJobModal = useCallback(() => {
    setJobModalOpen(false)
    setJobChangeScopeModalOpen(false)
    setJobModalError('')
    setEditingJobId(null)
  }, [])
  const closeJobChangeScopeModal = useCallback(() => setJobChangeScopeModalOpen(false), [])
  const closeAvatarEditor = useCallback(() => {
    setAvatarEditorOpen(false)
    setAvatarEditorError('')
    setAvatarEditorSaving(false)
    setAvatarDragging(false)
    avatarDragPointerIdRef.current = null
    avatarDragStartRef.current = null
  }, [])
  const editProfileBackdropCloseGuard = useGuardedBackdropClose(closeEditProfile)
  const deleteProfileBackdropCloseGuard = useGuardedBackdropClose(closeDeleteProfileConfirm)
  const clearAllDataBackdropCloseGuard = useGuardedBackdropClose(closeClearAllDataConfirm)
  const importSuccessBackdropCloseGuard = useGuardedBackdropClose(closeImportSuccess)
  const jobModalBackdropCloseGuard = useGuardedBackdropClose(closeJobModal)
  const jobChangeScopeBackdropCloseGuard = useGuardedBackdropClose(closeJobChangeScopeModal)
  const avatarEditorBackdropCloseGuard = useGuardedBackdropClose(closeAvatarEditor)

  useEffect(() => {
    if (!avatarEditorOpen) {
      return
    }
    const element = avatarPreviewRef.current
    if (!element) {
      return
    }
    const updatePreviewSize = (): void => {
      setAvatarPreviewSize(element.clientWidth || AVATAR_CROP_SIZE)
    }
    updatePreviewSize()
    if (typeof ResizeObserver === 'undefined') {
      return
    }
    const observer = new ResizeObserver(() => updatePreviewSize())
    observer.observe(element)
    return () => observer.disconnect()
  }, [avatarEditorOpen])

  useEffect(() => {
    const clamped = clampAvatarOffsets(avatarOffsetX, avatarOffsetY, avatarImageSize, avatarZoom)
    if (clamped.offsetX !== avatarOffsetX) {
      setAvatarOffsetX(clamped.offsetX)
    }
    if (clamped.offsetY !== avatarOffsetY) {
      setAvatarOffsetY(clamped.offsetY)
    }
  }, [avatarImageSize, avatarOffsetX, avatarOffsetY, avatarZoom])

  function handleAvatarDragStart(event: React.PointerEvent<HTMLDivElement>): void {
    if (!avatarSourceDataUrl) {
      return
    }
    avatarDragPointerIdRef.current = event.pointerId
    avatarDragStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      offsetX: avatarOffsetX,
      offsetY: avatarOffsetY,
    }
    setAvatarDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handleAvatarDragMove(event: React.PointerEvent<HTMLDivElement>): void {
    if (avatarDragPointerIdRef.current !== event.pointerId || !avatarDragStartRef.current) {
      return
    }
    const previewScale = (avatarPreviewRef.current?.clientWidth || avatarPreviewSize || AVATAR_CROP_SIZE) / AVATAR_CROP_SIZE
    const deltaX = event.clientX - avatarDragStartRef.current.x
    const deltaY = event.clientY - avatarDragStartRef.current.y
    const clamped = clampAvatarOffsets(
      avatarDragStartRef.current.offsetX + deltaX / previewScale,
      avatarDragStartRef.current.offsetY + deltaY / previewScale,
      avatarImageSize,
      avatarZoom,
    )
    setAvatarOffsetX(clamped.offsetX)
    setAvatarOffsetY(clamped.offsetY)
  }

  function handleAvatarDragEnd(event: React.PointerEvent<HTMLDivElement>): void {
    if (avatarDragPointerIdRef.current !== event.pointerId) {
      return
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    avatarDragPointerIdRef.current = null
    avatarDragStartRef.current = null
    setAvatarDragging(false)
  }

  async function exportJson(): Promise<void> {
    const payload = exportBackup()
    const slug = (activeProfile?.name ?? 'profile')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'profile'
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-')
    await saveTextFileWithDialog(
      `financify-backup-${slug}-${timestamp}-v${packageJson.version}-schema2.json`,
      JSON.stringify(payload, null, 2),
      'application/json',
    )
  }

  async function checkUpdatesNow(): Promise<void> {
    await checkForUpdates({ manual: true })
  }

  function updateShiftJobs(nextJobs: ShiftJobConfig[], nextDefaultId?: string): void {
    const nextCasualJobs = nextJobs.filter((job) => job.employmentType === 'casual')
    const resolvedDefaultId =
      nextCasualJobs.length === 0
        ? ''
        : nextDefaultId && nextCasualJobs.some((job) => job.id === nextDefaultId)
          ? nextDefaultId
          : nextCasualJobs[0].id
    setSettings({ shiftJobs: nextJobs, defaultShiftJobId: resolvedDefaultId })
  }

  function openCreateJobModal(): void {
    setJobModalMode('create')
    setEditingJobId(null)
    setJobChangeScopeModalOpen(false)
    setJobDraft({
      name: '',
      employmentType: 'casual',
      hourlyRate: '',
      salaryAmount: '',
      fixedPayInterval: 'monthly',
      salaryPaymentsPerYear: '12',
      startDate: todayDateString(),
    })
    setJobModalError('')
    setJobModalOpen(true)
  }

  function openEditJobModal(job: ShiftJobConfig): void {
    setJobModalMode('edit')
    setEditingJobId(job.id)
    setJobChangeScopeModalOpen(false)
    const latestFixedRevision = job.employmentType === 'fixed' ? resolveFixedSalaryRevisions(job).at(-1) ?? null : null
    setJobDraft({
      name: job.name,
      employmentType: job.employmentType,
      hourlyRate: String(job.hourlyRate ?? 18),
      salaryAmount: String(latestFixedRevision?.salaryAmount ?? job.salaryAmount ?? 3000),
      fixedPayInterval: latestFixedRevision?.fixedPayInterval ?? job.fixedPayInterval ?? 'monthly',
      salaryPaymentsPerYear: flagsToSalaryPayments(
        Boolean(latestFixedRevision?.has13thSalary ?? job.has13thSalary),
        Boolean(latestFixedRevision?.has14thSalary ?? job.has14thSalary),
      ),
      // For edits, this acts as effective date for fixed salary changes.
      startDate: todayDateString(),
    })
    setJobModalError('')
    setJobModalOpen(true)
  }

  async function saveJobFromModal(fixedChangeScope: FixedJobChangeScope | null = null): Promise<void> {
    const normalizedName = jobDraft.name.trim()
    if (!normalizedName) {
      setJobModalError(t('Bitte gib einen Jobnamen ein.', 'Please enter a job name.'))
      return
    }

    const existingJob = jobModalMode === 'edit' && editingJobId ? settings.shiftJobs.find((job) => job.id === editingJobId) ?? null : null
    const effectiveFromDate = isDateString(jobDraft.startDate) ? jobDraft.startDate : todayDateString()
    let shouldApplyCasualShiftUpdate = false
    let casualHourlyRateChanged = false

    let nextJob: ShiftJobConfig
    if (jobDraft.employmentType === 'casual') {
      const hourlyRate = Number(jobDraft.hourlyRate)
      if (!Number.isFinite(hourlyRate) || hourlyRate <= 0) {
        setJobModalError(t('Bitte gib einen gültigen Stundensatz ein.', 'Please enter a valid hourly rate.'))
        return
      }
      if (existingJob?.employmentType === 'casual') {
        const existingHourlyRate = Number(existingJob.hourlyRate ?? 18)
        const casualConfigChanged = existingJob.name !== normalizedName || existingHourlyRate !== hourlyRate
        if (casualConfigChanged && fixedChangeScope === null) {
          setJobModalError('')
          setJobChangeScopeModalOpen(true)
          return
        }
        shouldApplyCasualShiftUpdate = casualConfigChanged
        casualHourlyRateChanged = existingHourlyRate !== hourlyRate
      }
      nextJob = {
        id: editingJobId ?? makeJobId(),
        name: normalizedName,
        employmentType: 'casual',
        hourlyRate,
      }
    } else {
      const salaryAmount = Number(jobDraft.salaryAmount)
      if (!Number.isFinite(salaryAmount) || salaryAmount <= 0) {
        setJobModalError(t('Bitte gib ein gültiges Gehalt ein.', 'Please enter a valid salary amount.'))
        return
      }
      const salaryFlags = salaryPaymentsToFlags(jobDraft.salaryPaymentsPerYear)
      const newFixedRevision = {
        startDate: effectiveFromDate,
        endDate: null as string | null,
        salaryAmount,
        fixedPayInterval: jobDraft.fixedPayInterval,
        has13thSalary: salaryFlags.has13thSalary,
        has14thSalary: salaryFlags.has14thSalary,
      }
      let nextRevisions: NonNullable<ShiftJobConfig['fixedSalaryRevisions']> = [newFixedRevision]
      if (existingJob?.employmentType === 'fixed') {
        const currentRevisions = resolveFixedSalaryRevisions(existingJob)
        const latestRevision = currentRevisions.at(-1) ?? null
        if (latestRevision) {
          const fixedConfigChanged =
            latestRevision.salaryAmount !== salaryAmount ||
            latestRevision.fixedPayInterval !== jobDraft.fixedPayInterval ||
            latestRevision.has13thSalary !== salaryFlags.has13thSalary ||
            latestRevision.has14thSalary !== salaryFlags.has14thSalary
          if (!fixedConfigChanged) {
            nextRevisions = currentRevisions
          } else {
            if (fixedChangeScope === null) {
              setJobModalError('')
              setJobChangeScopeModalOpen(true)
              return
            }
            if (fixedChangeScope === 'retroactive') {
              const unchangedHistory = currentRevisions.slice(0, -1)
              nextRevisions = [
                ...unchangedHistory,
                {
                  ...latestRevision,
                  salaryAmount,
                  fixedPayInterval: jobDraft.fixedPayInterval,
                  has13thSalary: salaryFlags.has13thSalary,
                  has14thSalary: salaryFlags.has14thSalary,
                },
              ]
            } else {
              if (compareDateStrings(effectiveFromDate, latestRevision.startDate) <= 0) {
                setJobModalError(
                  t(
                    'Für "Ab Datum" muss das Datum nach dem letzten Änderungsdatum liegen. Sonst bitte "Rückwirkend" wählen.',
                    'For "From date", the date must be after the last change date. Otherwise use "Retroactive".',
                  ),
                )
                return
              }
              const unchangedHistory = currentRevisions.slice(0, -1)
              const previousRevision = {
                ...latestRevision,
                endDate: addDays(effectiveFromDate, -1),
              }
              nextRevisions = [
                ...unchangedHistory,
                previousRevision,
                newFixedRevision,
              ]
            }
          }
        }
      }
      const latestNextRevision = nextRevisions.at(-1) ?? newFixedRevision
      nextJob = {
        id: editingJobId ?? makeJobId(),
        name: normalizedName,
        employmentType: 'fixed',
        salaryAmount: latestNextRevision.salaryAmount,
        fixedPayInterval: latestNextRevision.fixedPayInterval,
        has13thSalary: latestNextRevision.has13thSalary,
        has14thSalary: latestNextRevision.has14thSalary,
        startDate: latestNextRevision.startDate,
        fixedSalaryRevisions: nextRevisions,
      }
    }

    const nextJobs =
      jobModalMode === 'edit' && editingJobId
        ? settings.shiftJobs.map((job) => (job.id === editingJobId ? nextJob : job))
        : [...settings.shiftJobs, nextJob]
    if (shouldApplyCasualShiftUpdate && existingJob?.employmentType === 'casual' && nextJob.employmentType === 'casual') {
      try {
        const oldName = existingJob.name.trim()
        const oldNameLower = oldName.toLowerCase()
        const nextHourlyRate = Number(nextJob.hourlyRate ?? 18)
        const shouldRename = oldName !== normalizedName
        const shouldApplyFromDate = fixedChangeScope === 'from-date'
        const entriesToUpdate = incomeEntries.filter((entry) => {
          const tagsLower = entry.tags.map((tag) => tag.trim().toLowerCase())
          const isShiftEntry = tagsLower.includes('dienst') || tagsLower.includes('shift')
          const belongsToJob = entry.source.trim() === oldName || tagsLower.includes(oldNameLower)
          if (!isShiftEntry || !belongsToJob) {
            return false
          }
          if (shouldApplyFromDate && compareDateStrings(entry.date, effectiveFromDate) < 0) {
            return false
          }
          return true
        })
        for (const entry of entriesToUpdate) {
          const nextPayload: Partial<IncomeEntry> = {}
          if (shouldRename) {
            nextPayload.source = normalizedName
            nextPayload.tags = entry.tags.map((tag) => (tag.trim().toLowerCase() === oldNameLower ? normalizedName : tag))
          }
          if (casualHourlyRateChanged) {
            const range = extractShiftTimeRange(entry.notes)
            if (range) {
              try {
                const recalculated = calculateShiftIncome({
                  date: entry.date,
                  startTime: range.startTime,
                  endTime: range.endTime,
                  hourlyRate: nextHourlyRate,
                  language: settings.language,
                })
                nextPayload.amount = recalculated.amount
              } catch {
                // Keep existing amount when parsing fails.
              }
            }
          }
          if (Object.keys(nextPayload).length > 0) {
            await updateIncomeEntry(entry.id, nextPayload)
          }
        }
      } catch (error) {
        setJobModalError(error instanceof Error ? error.message : t('Job konnte nicht gespeichert werden.', 'Job could not be saved.'))
        return
      }
    }
    updateShiftJobs(nextJobs, settings.defaultShiftJobId)
    setJobChangeScopeModalOpen(false)
    closeJobModal()
  }

  function deleteJob(id: string): void {
    const remaining = settings.shiftJobs.filter((job) => job.id !== id)
    const nextDefaultId = settings.defaultShiftJobId === id ? remaining[0]?.id : settings.defaultShiftJobId
    updateShiftJobs(remaining, nextDefaultId)
  }

  async function onImport(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }
    try {
      setImportError('')
      setImportSuccessMessage('')
      const text = await file.text()
      const parsed = JSON.parse(text) as AppBackup
      await importBackup(parsed, importMode)
      setImportSuccessMessage(
        importMode === 'replace'
          ? t('JSON-Import erfolgreich (Ersetzen).', 'JSON import successful (replace).')
          : t('JSON-Import erfolgreich (Zusammenfuehren).', 'JSON import successful (merge).'),
      )
      event.target.value = ''
    } catch (error) {
      setImportSuccessMessage('')
      setImportError(error instanceof Error ? error.message : t('Import fehlgeschlagen. Bitte JSON-Format prüfen.', 'Import failed. Please verify JSON format.'))
    }
  }

  async function handleClearAllDataConfirmed(): Promise<void> {
    try {
      setImportError('')
      await clearAllData()
      setConfirmClearAllData(false)
    } catch (error) {
      setConfirmClearAllData(false)
      setImportError(error instanceof Error ? error.message : t('Profildaten konnten nicht gelöscht werden.', 'Could not delete profile data.'))
    }
  }

  async function onAvatarImageSelected(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0]
    if (!file || !activeProfile) {
      return
    }
    try {
      setImportError('')
      setAvatarEditorError('')
      const dataUrl = await readFileAsDataUrl(file)
      if (!dataUrl.startsWith('data:image/')) {
        throw new Error('invalid-image')
      }
      const image = await loadImageFromDataUrl(dataUrl)
      setAvatarSourceDataUrl(dataUrl)
      setAvatarImageSize({ width: image.naturalWidth || image.width, height: image.naturalHeight || image.height })
      setAvatarZoom(1.15)
      setAvatarOffsetX(0)
      setAvatarOffsetY(0)
      setAvatarEditorOpen(true)
      event.target.value = ''
    } catch {
      setAvatarEditorError(t('Profilbild konnte nicht geladen werden.', 'Could not load profile image.'))
    }
  }

  async function saveAvatarCrop(): Promise<void> {
    if (!activeProfile || !avatarSourceDataUrl) {
      return
    }
    try {
      setAvatarEditorSaving(true)
      setAvatarEditorError('')
      const croppedDataUrl = await buildCroppedAvatarDataUrl(avatarSourceDataUrl, avatarZoom, avatarOffsetX, avatarOffsetY)
      await updateProfileAvatar(activeProfile.id, croppedDataUrl)
      closeAvatarEditor()
    } catch {
      setAvatarEditorError(t('Profilbild konnte nicht gespeichert werden.', 'Could not save profile image.'))
    } finally {
      setAvatarEditorSaving(false)
    }
  }

  async function removeActiveProfileAvatar(): Promise<void> {
    if (!activeProfile) {
      return
    }
    try {
      await updateProfileAvatar(activeProfile.id, null)
    } catch (error) {
      setImportError(error instanceof Error ? error.message : t('Profilbild konnte nicht entfernt werden.', 'Could not remove profile image.'))
    }
  }

  async function handleDeleteActiveProfile(): Promise<void> {
    if (!activeProfile) {
      return
    }
    try {
      await deleteProfile(activeProfile.id)
      setConfirmDeleteProfile(false)
    } catch (error) {
      setImportError(error instanceof Error ? error.message : t('Profil konnte nicht gelöscht werden.', 'Profile could not be deleted.'))
      setConfirmDeleteProfile(false)
    }
  }

  function openEditProfile(): void {
    if (!activeProfile) {
      return
    }
    setRenameProfileName(activeProfile.name)
    setEditAuthMode(activeProfile.authMode)
    setEditAuthSecret('')
    setEditAuthSecretConfirm('')
    setEditProfileError('')
    setEditProfileOpen(true)
  }

  async function handleSaveEditProfile(): Promise<void> {
    if (!activeProfile) {
      return
    }
    if (!renameProfileName.trim()) {
      setEditProfileError(t('Bitte gib einen Profilnamen ein.', 'Please enter a profile name.'))
      return
    }
    if (editAuthMode !== 'none' && editAuthSecret !== editAuthSecretConfirm) {
      setEditProfileError(t('PIN/Passwort stimmt nicht überein.', 'PIN/password does not match.'))
      return
    }
    try {
      setSavingProfileEdit(true)
      setEditProfileError('')
      renameProfile(activeProfile.id, renameProfileName)
      setRenameProfileName(renameProfileName.trim())
      await updateProfileProtection(activeProfile.id, editAuthMode, editAuthMode === 'none' ? undefined : editAuthSecret)
      setEditProfileOpen(false)
    } catch (error) {
      setEditProfileError(error instanceof Error ? error.message : t('Profilschutz konnte nicht gespeichert werden.', 'Could not save profile protection.'))
    } finally {
      setSavingProfileEdit(false)
    }
  }

  const avatarPreviewScale = avatarPreviewSize / AVATAR_CROP_SIZE

  useCardRowStagger(pageRef)

  const openIssueReport = useCallback(async (): Promise<void> => {
    try {
      await openUrl(REPORT_ISSUE_URL)
    } catch {
      window.open(REPORT_ISSUE_URL, '_blank', 'noopener,noreferrer')
    }
  }, [])

  return (
    <section ref={pageRef} className="page">
      <header className="page-header">
        <div className="settings-header-copy">
          <h1>{t('Einstellungen', 'Settings')}</h1>
          <p className="muted">{t('Oberfläche, Präferenzen und lokales Backup-Verhalten anpassen.', 'Adjust interface, preferences and local backup behavior.')}</p>
        </div>
        <div className="app-version-row">
          <p className="muted app-version">{t('Version', 'Version')} {packageJson.version}</p>
          <button
            type="button"
            className={`icon-button update-check-icon ${isCheckingForUpdates ? 'is-checking' : ''}`}
            onClick={() => void checkUpdatesNow()}
            disabled={!updatesSupported || isCheckingForUpdates || isInstallingUpdate}
            aria-label={t('Jetzt nach Updates suchen', 'Check for updates now')}
            title={t('Jetzt nach Updates suchen', 'Check for updates now')}
          >
            {'\u21BB'}
          </button>
        </div>
      </header>

      <section className="dashboard-grid">
        <article className="card dashboard-card dashboard-card-fit">
          <header className="section-header">
            <h2>{t('Profile', 'Profile')}</h2>
          </header>
          <div className="setting-list">
            <section className="settings-group profile-settings-group">
              <p className="settings-group-title">{t('Profilbild', 'Profile image')}</p>
              <div className="profile-avatar-row">
                <div className="profile-avatar profile-avatar-large" aria-hidden="true">
                  {activeProfile?.avatarDataUrl ? (
                    <img src={activeProfile.avatarDataUrl} alt="" />
                  ) : (
                    <span>{profileInitials(activeProfile?.name ?? 'User')}</span>
                  )}
                </div>
                <div className="inline-controls">
                  <label className="button button-secondary file-picker">
                    {t('Bild wählen', 'Choose image')}
                    <input type="file" accept="image/*" onChange={(event) => void onAvatarImageSelected(event)} />
                  </label>
                  <button type="button" className="button button-tertiary" onClick={() => void removeActiveProfileAvatar()} disabled={!activeProfile?.avatarDataUrl}>
                    {t('Bild entfernen', 'Remove image')}
                  </button>
                </div>
              </div>
            </section>

            <section className="settings-group profile-settings-group">
              <p className="settings-group-title">{t('Profilverwaltung', 'Profile management')}</p>
              <div className="profile-actions-row">
                <button type="button" className="button button-secondary" onClick={openEditProfile} disabled={!activeProfile}>
                  {t('Profil bearbeiten', 'Edit profile')}
                </button>
                <button
                  type="button"
                  className="button button-danger"
                  onClick={() => setConfirmDeleteProfile(true)}
                  disabled={!activeProfile || !canDeleteProfile}
                >
                  {t('Profil löschen', 'Delete profile')}
                </button>
              </div>
            </section>
          </div>
        </article>

        <article className="card dashboard-card dashboard-card-fit">
          <header className="section-header">
            <h2>{t('Präferenzen', 'Preferences')}</h2>
          </header>
          <div className="setting-list">
            <label>
              {t('Sprache', 'Language')}
              <select value={settings.language} onChange={(event) => setSettings({ language: event.target.value as typeof settings.language })}>
                <option value="de">Deutsch</option>
                <option value="en">English</option>
              </select>
            </label>
            <label>
              {t('Währung', 'Currency')}
              <select value={settings.currency} onChange={(event) => setSettings({ currency: event.target.value as 'EUR' | 'USD' })}>
                <option value="EUR">EUR (€)</option>
                <option value="USD">USD ($)</option>
              </select>
            </label>
            <label>
              {t('Datumsformat', 'Date format')}
              <select value={settings.dateFormat} onChange={(event) => setSettings({ dateFormat: event.target.value as typeof settings.dateFormat })}>
                <option value="DD.MM.YYYY">DD.MM.YYYY</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              </select>
            </label>
            <label>
              {t('Wochenstart', 'Week starts on')}
              <select value={settings.startOfWeek} onChange={(event) => setSettings({ startOfWeek: event.target.value as typeof settings.startOfWeek })}>
                <option value="monday">{t('Montag', 'Monday')}</option>
                <option value="sunday">{t('Sonntag', 'Sunday')}</option>
              </select>
            </label>
            <label className="switch">
              <input
                type="checkbox"
                checked={settings.privacyHideAmounts}
                onChange={(event) => setSettings({ privacyHideAmounts: event.target.checked })}
              />
              <span>{t('Beträge ausblenden (Privatsphäre-Modus)', 'Hide amounts (privacy mode)')}</span>
            </label>
          </div>
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="card dashboard-card dashboard-card-fit">
          <header className="section-header">
            <h2>{t('Jobs', 'Jobs')}</h2>
            <button type="button" className="button button-secondary" onClick={openCreateJobModal}>
              {t('Job hinzufügen', 'Add job')}
            </button>
          </header>
          <p className="muted">
            {t(
              'Lege Jobs als fallweise oder fixe Anstellung an. Fallweise Jobs können als Dienste geloggt werden, fixe Jobs werden automatisch als wiederkehrendes Einkommen berücksichtigt.',
              'Configure jobs as casual or fixed employment. Casual jobs can be logged as shifts, fixed jobs are counted automatically as recurring income.',
            )}
          </p>
          <div className="setting-list">
            {settings.shiftJobs.length === 0 ? (
              <p className="empty-inline">{t('Noch keine Jobs angelegt.', 'No jobs configured yet.')}</p>
            ) : null}
            {settings.shiftJobs.map((job) => (
              <div className="job-row" key={job.id}>
                <div>
                  <strong>{job.name}</strong>
                  <p className="muted">
                    {job.employmentType === 'casual'
                      ? `${t('Fallweise', 'Casual')} · ${job.hourlyRate ?? 18} ${currencySymbol}/h`
                      : `${t('Fixanstellung', 'Fixed employment')} · ${job.salaryAmount ?? 0} ${currencySymbol} · ${
                          job.fixedPayInterval === 'weekly'
                            ? t('Wöchentlich', 'Weekly')
                            : job.fixedPayInterval === 'biweekly'
                              ? t('Zweiwöchentlich', 'Biweekly')
                              : t('Monatlich', 'Monthly')
                        }`}
                  </p>
                  {job.employmentType === 'fixed' ? (
                    <p className="hint">
                      {t('Start', 'Start')}: {job.startDate ?? todayDateString()} · {t('Extras', 'Extras')}:{' '}
                      {job.has13thSalary || job.has14thSalary
                        ? [job.has13thSalary ? '13' : null, job.has14thSalary ? '14' : null].filter(Boolean).join(' + ')
                        : t('Keine', 'None')}
                    </p>
                  ) : null}
                </div>
                <div className="inline-controls">
                  {job.employmentType === 'casual' ? (
                    <button
                      type="button"
                      className={`button ${settings.defaultShiftJobId === job.id ? 'button-primary' : 'button-secondary'}`}
                      onClick={() => setSettings({ defaultShiftJobId: job.id })}
                    >
                      {settings.defaultShiftJobId === job.id ? t('Standard für Dienste', 'Default for shifts') : t('Als Dienst-Standard setzen', 'Set as shift default')}
                    </button>
                  ) : null}
                  <button type="button" className="button button-secondary" onClick={() => openEditJobModal(job)}>
                    {t('Bearbeiten', 'Edit')}
                  </button>
                  <button
                    type="button"
                    className="button button-danger"
                    onClick={() => deleteJob(job.id)}
                  >
                    {t('Löschen', 'Delete')}
                  </button>
                </div>
              </div>
            ))}
            {casualJobs.length === 0 ? (
              <p className="hint">{t('Hinweis: Für Dienst-Logging brauchst du mindestens einen fallweisen Job.', 'Note: You need at least one casual job for shift logging.')}</p>
            ) : null}
          </div>
        </article>

        <article className="card dashboard-card dashboard-card-fit">
          <header className="section-header">
            <h2>{t('Datenverwaltung', 'Data management')}</h2>
          </header>
          <div className="setting-list">
            {isCheckingForUpdates ? <p className="muted">{t('Suche nach Updates...','Checking for updates...')}</p> : null}
            {skippedUpdateVersion ? (
              <p className="muted">
                {t(`Übersprungene Version: ${skippedUpdateVersion}`, `Skipped version: ${skippedUpdateVersion}`)}
              </p>
            ) : null}
            {updateCheckError ? <p className="error-text">{updateCheckError}</p> : null}
          </div>
          {importError ? <p className="error-text">{importError}</p> : null}
          <div className="inline-controls">
            <button type="button" className="button button-secondary" onClick={() => void exportJson()}>
              {t('JSON-Backup exportieren', 'Export JSON backup')}
            </button>
            <select value={importMode} onChange={(event) => setImportMode(event.target.value as 'replace' | 'merge')}>
              <option value="replace">{t('Importmodus: Ersetzen', 'Import mode: Replace')}</option>
              <option value="merge">{t('Importmodus: Zusammenführen', 'Import mode: Merge')}</option>
            </select>
            <label className="button button-primary file-picker">
              {t('JSON importieren', 'Import JSON')}
              <input type="file" accept="application/json" onChange={(event) => void onImport(event)} />
            </label>
          </div>
          <div className="danger-zone">
            <p className="danger-zone-title">{t('Gefahrenbereich', 'Danger Zone')}</p>
            <p className="muted">
              {t(
                'Löscht alle lokalen Daten des aktiven Profils: Abos, Einkommen, Ausgaben, Einstellungen und Hintergrundbild.',
                'Deletes all local data of the active profile: subscriptions, income, expenses, settings and background image.',
              )}
            </p>
            <button type="button" className="button button-danger" onClick={() => setConfirmClearAllData(true)}>
              {t('Alle Profildaten löschen', 'Delete profile data')}
            </button>
          </div>
        </article>
      </section>
      <div className="settings-footer-link-row">
        <button type="button" className="button button-tertiary settings-footer-link" onClick={() => void openIssueReport()}>
          {t('Problem melden', 'Report issue')}
        </button>
      </div>

      {jobModalOpen ? (
        <div
          className="form-modal-backdrop"
          onMouseDown={jobModalBackdropCloseGuard.onBackdropMouseDown}
          onClick={jobModalBackdropCloseGuard.onBackdropClick}
          role="presentation"
        >
          <article className="card form-modal confirm-modal" onMouseDownCapture={jobModalBackdropCloseGuard.onModalMouseDownCapture} onClick={(event) => event.stopPropagation()}>
            <header className="section-header">
              <h2>{jobModalMode === 'create' ? t('Job hinzufügen', 'Add job') : t('Job bearbeiten', 'Edit job')}</h2>
              <button type="button" className="icon-button" onClick={closeJobModal} aria-label={t('Popup schließen', 'Close popup')}>
                ×
              </button>
            </header>
            <div className="setting-list">
              <label>
                {t('Anstellung', 'Employment')}
                <select
                  value={jobDraft.employmentType}
                  onChange={(event) =>
                    setJobDraft((current) => ({
                      ...current,
                      employmentType: event.target.value as EmploymentType,
                    }))
                  }
                >
                  <option value="casual">{t('Fallweise', 'Casual')}</option>
                  <option value="fixed">{t('Fixanstellung', 'Fixed employment')}</option>
                </select>
              </label>
              <label>
                {t('Firma', 'Company')}
                <input
                  value={jobDraft.name}
                  onChange={(event) => setJobDraft((current) => ({ ...current, name: event.target.value }))}
                  placeholder={t('Firmenname', 'Company name')}
                />
              </label>
              {jobDraft.employmentType === 'casual' ? (
                <label>
                  {`${t('Stundensatz (netto)', 'Hourly rate (net)')} (${currencySymbol}/h)`}
                  <input
                    type="number"
                    min={0.01}
                    step="0.01"
                    value={jobDraft.hourlyRate}
                    onChange={(event) => setJobDraft((current) => ({ ...current, hourlyRate: event.target.value }))}
                    placeholder={t(`Betrag in ${settings.currency}`, `Amount in ${settings.currency}`)}
                  />
                </label>
              ) : (
                <>
                  <label>
                    {`${t('Gehalt pro Auszahlung (netto)', 'Salary per payout (net)')} (${currencySymbol})`}
                    <input
                      type="number"
                      min={0.01}
                      step="0.01"
                      value={jobDraft.salaryAmount}
                      onChange={(event) => setJobDraft((current) => ({ ...current, salaryAmount: event.target.value }))}
                      placeholder={t(`Betrag in ${settings.currency}`, `Amount in ${settings.currency}`)}
                    />
                  </label>
                  <label>
                    {t('Auszahlungsintervall', 'Payout interval')}
                    <select
                      value={jobDraft.fixedPayInterval}
                      onChange={(event) => setJobDraft((current) => ({ ...current, fixedPayInterval: event.target.value as FixedPayInterval }))}
                    >
                      <option value="monthly">{t('Monatlich', 'Monthly')}</option>
                      <option value="biweekly">{t('Zweiwöchentlich', 'Biweekly')}</option>
                      <option value="weekly">{t('Wöchentlich', 'Weekly')}</option>
                    </select>
                  </label>
                  <label>
                    {jobModalMode === 'edit' ? t('Änderung wirksam ab', 'Change effective from') : t('Startdatum', 'Start date')}
                    <input
                      type="date"
                      value={jobDraft.startDate}
                      onChange={(event) => setJobDraft((current) => ({ ...current, startDate: event.target.value }))}
                    />
                  </label>
                  <label>
                    {t('Gehälter pro Jahr', 'Salary payouts per year')}
                    <select
                      value={jobDraft.salaryPaymentsPerYear}
                      onChange={(event) =>
                        setJobDraft((current) => ({
                          ...current,
                          salaryPaymentsPerYear: event.target.value as JobDraftState['salaryPaymentsPerYear'],
                        }))
                      }
                    >
                      <option value="12">12</option>
                      <option value="13">13</option>
                      <option value="14">14</option>
                    </select>
                  </label>
                </>
              )}
              {jobModalError ? <p className="error-text">{jobModalError}</p> : null}
            </div>
            <div className="form-actions">
              <button type="button" className="button button-primary" onClick={() => void saveJobFromModal()}>
                {jobModalMode === 'create' ? t('Job speichern', 'Save job') : t('Änderungen speichern', 'Save changes')}
              </button>
              <button type="button" className="button button-secondary" onClick={closeJobModal}>
                {t('Abbrechen', 'Cancel')}
              </button>
            </div>
          </article>
        </div>
      ) : null}

      {jobChangeScopeModalOpen ? (
        <div
          className="form-modal-backdrop"
          onMouseDown={jobChangeScopeBackdropCloseGuard.onBackdropMouseDown}
          onClick={jobChangeScopeBackdropCloseGuard.onBackdropClick}
          role="presentation"
        >
          <article className="card form-modal confirm-modal" onMouseDownCapture={jobChangeScopeBackdropCloseGuard.onModalMouseDownCapture} onClick={(event) => event.stopPropagation()}>
            <header className="section-header">
              <h2>{t('Änderung anwenden', 'Apply change')}</h2>
              <button type="button" className="icon-button" onClick={closeJobChangeScopeModal} aria-label={t('Popup schließen', 'Close popup')}>
                ×
              </button>
            </header>
            <div className="setting-list">
              <p className="muted">
                {t(
                  'Soll die Änderung rückwirkend gelten oder erst ab einem bestimmten Datum?',
                  'Should this change apply retroactively or only from a specific date?',
                )}
              </p>
              <label>
                {t('Ab Datum', 'From date')}
                <input
                  type="date"
                  value={jobDraft.startDate}
                  onChange={(event) => setJobDraft((current) => ({ ...current, startDate: event.target.value }))}
                />
              </label>
              {jobModalError ? <p className="error-text">{jobModalError}</p> : null}
            </div>
            <div className="form-actions">
              <button type="button" className="button button-primary" onClick={() => void saveJobFromModal('retroactive')}>
                {t('Rückwirkend', 'Retroactive')}
              </button>
              <button type="button" className="button button-secondary" onClick={() => void saveJobFromModal('from-date')}>
                {t('Ab Datum übernehmen', 'Apply from date')}
              </button>
              <button type="button" className="button button-secondary" onClick={closeJobChangeScopeModal}>
                {t('Abbrechen', 'Cancel')}
              </button>
            </div>
          </article>
        </div>
      ) : null}

      {avatarEditorOpen ? (
        <div
          className="form-modal-backdrop"
          onMouseDown={avatarEditorBackdropCloseGuard.onBackdropMouseDown}
          onClick={avatarEditorBackdropCloseGuard.onBackdropClick}
          role="presentation"
        >
          <article className="card form-modal confirm-modal" onMouseDownCapture={avatarEditorBackdropCloseGuard.onModalMouseDownCapture} onClick={(event) => event.stopPropagation()}>
            <header className="section-header">
              <h2>{t('Profilbild zuschneiden', 'Crop profile image')}</h2>
              <button type="button" className="icon-button" onClick={closeAvatarEditor} aria-label={t('Popup schließen', 'Close popup')}>
                ×
              </button>
            </header>
            <div className="setting-list">
              <div
                ref={avatarPreviewRef}
                className={`avatar-crop-preview ${avatarDragging ? 'dragging' : ''}`}
                onDragStart={(event) => event.preventDefault()}
                onPointerDown={handleAvatarDragStart}
                onPointerMove={handleAvatarDragMove}
                onPointerUp={handleAvatarDragEnd}
                onPointerCancel={handleAvatarDragEnd}
              >
                {avatarSourceDataUrl ? (
                  <img
                    src={avatarSourceDataUrl}
                    alt=""
                    draggable={false}
                    style={{ transform: `translate(${avatarOffsetX * avatarPreviewScale}px, ${avatarOffsetY * avatarPreviewScale}px) scale(${avatarZoom})` }}
                  />
                ) : null}
              </div>
              <label>
                {t('Zoom', 'Zoom')}
                <input type="range" min={1} max={3} step={0.01} value={avatarZoom} onChange={(event) => setAvatarZoom(Number(event.target.value))} />
              </label>
              <p className="muted">{t('Bild im Kreis ziehen, um den Ausschnitt zu wählen.', 'Drag the image inside the circle to position the crop.')}</p>
              {avatarEditorError ? <p className="error-text">{avatarEditorError}</p> : null}
            </div>
            <div className="form-actions">
              <button type="button" className="button button-primary" onClick={() => void saveAvatarCrop()} disabled={avatarEditorSaving}>
                {avatarEditorSaving ? t('Speichert...', 'Saving...') : t('Speichern', 'Save')}
              </button>
              <button type="button" className="button button-secondary" onClick={closeAvatarEditor} disabled={avatarEditorSaving}>
                {t('Abbrechen', 'Cancel')}
              </button>
            </div>
          </article>
        </div>
      ) : null}

      {editProfileOpen ? (
        <div
          className="form-modal-backdrop"
          onMouseDown={editProfileBackdropCloseGuard.onBackdropMouseDown}
          onClick={editProfileBackdropCloseGuard.onBackdropClick}
          role="presentation"
        >
          <article className="card form-modal confirm-modal" onMouseDownCapture={editProfileBackdropCloseGuard.onModalMouseDownCapture} onClick={(event) => event.stopPropagation()}>
            <header className="section-header">
              <h2>{t('Profil bearbeiten', 'Edit profile')}</h2>
              <button type="button" className="icon-button" onClick={closeEditProfile} aria-label={t('Popup schließen', 'Close popup')}>
                ×
              </button>
            </header>
            <div className="setting-list">
              <label>
                {t('Profilname', 'Profile name')}
                <input
                  value={renameProfileName}
                  onChange={(event) => setRenameProfileName(event.target.value)}
                  placeholder={t('Profilname', 'Profile name')}
                />
              </label>
              <label>
                {t('Schutzmodus', 'Protection mode')}
                <select value={editAuthMode} onChange={(event) => setEditAuthMode(event.target.value as 'none' | 'pin' | 'password')}>
                  <option value="none">{t('Kein Schutz', 'No protection')}</option>
                  <option value="pin">{t('PIN', 'PIN')}</option>
                  <option value="password">{t('Passwort', 'Password')}</option>
                </select>
              </label>
              {editAuthMode !== 'none' ? (
                <>
                  <label>
                    {editAuthMode === 'pin' ? t('Neue PIN', 'New PIN') : t('Neues Passwort', 'New password')}
                    <input
                      type="password"
                      inputMode={editAuthMode === 'pin' ? 'numeric' : 'text'}
                      value={editAuthSecret}
                      onChange={(event) => setEditAuthSecret(event.target.value)}
                      placeholder={
                        editAuthMode === 'pin'
                          ? t('4-8 Ziffern (leer = unverändert)', '4-8 digits (empty = unchanged)')
                          : t('mind. 6 Zeichen (leer = unverändert)', 'min. 6 chars (empty = unchanged)')
                      }
                    />
                  </label>
                  <label>
                    {t('Bestätigen', 'Confirm')}
                    <input
                      type="password"
                      inputMode={editAuthMode === 'pin' ? 'numeric' : 'text'}
                      value={editAuthSecretConfirm}
                      onChange={(event) => setEditAuthSecretConfirm(event.target.value)}
                      placeholder={t('Erneut eingeben', 'Enter again')}
                    />
                  </label>
                </>
              ) : null}
              {editProfileError ? <p className="error-text">{editProfileError}</p> : null}
            </div>
            <div className="form-actions">
              <button type="button" className="button button-primary" onClick={() => void handleSaveEditProfile()} disabled={savingProfileEdit}>
                {savingProfileEdit ? t('Speichert...', 'Saving...') : t('Speichern', 'Save')}
              </button>
              <button type="button" className="button button-secondary" onClick={closeEditProfile} disabled={savingProfileEdit}>
                {t('Abbrechen', 'Cancel')}
              </button>
            </div>
          </article>
        </div>
      ) : null}

      {confirmDeleteProfile ? (
        <div
          className="form-modal-backdrop"
          onMouseDown={deleteProfileBackdropCloseGuard.onBackdropMouseDown}
          onClick={deleteProfileBackdropCloseGuard.onBackdropClick}
          role="presentation"
        >
          <article className="card form-modal confirm-modal" onMouseDownCapture={deleteProfileBackdropCloseGuard.onModalMouseDownCapture} onClick={(event) => event.stopPropagation()}>
            <header className="section-header">
              <h2>{t('Profil wirklich löschen?', 'Delete profile permanently?')}</h2>
              <button type="button" className="icon-button" onClick={closeDeleteProfileConfirm} aria-label={t('Popup schließen', 'Close popup')}>
                ×
              </button>
            </header>
            <p>
              {t(
                'Das aktive Profil und alle zugehörigen Daten werden dauerhaft entfernt.',
                'The active profile and all its data will be permanently removed.',
              )}
            </p>
            <div className="form-actions">
              <button type="button" className="button button-danger" onClick={() => void handleDeleteActiveProfile()}>
                {t('Profil löschen', 'Delete profile')}
              </button>
              <button type="button" className="button button-secondary" onClick={closeDeleteProfileConfirm}>
                {t('Abbrechen', 'Cancel')}
              </button>
            </div>
          </article>
        </div>
      ) : null}

      {confirmClearAllData ? (
        <div
          className="form-modal-backdrop"
          onMouseDown={clearAllDataBackdropCloseGuard.onBackdropMouseDown}
          onClick={clearAllDataBackdropCloseGuard.onBackdropClick}
          role="presentation"
        >
          <article className="card form-modal confirm-modal" onMouseDownCapture={clearAllDataBackdropCloseGuard.onModalMouseDownCapture} onClick={(event) => event.stopPropagation()}>
            <header className="section-header">
              <h2>{t('Alle Daten dieses Profils löschen?', 'Delete all data for this profile?')}</h2>
              <button type="button" className="icon-button" onClick={closeClearAllDataConfirm} aria-label={t('Popup schließen', 'Close popup')}>
                ×
              </button>
            </header>
            <p>
              {t(
                'Diese Aktion betrifft nur das aktive Profil und kann nicht rückgängig gemacht werden. Bitte vorher ein JSON-Backup exportieren.',
                'This action affects only the active profile and cannot be undone. Please export a JSON backup first.',
              )}
            </p>
            <div className="form-actions">
              <button type="button" className="button button-danger" onClick={() => void handleClearAllDataConfirmed()}>
                {t('Endgültig löschen', 'Delete permanently')}
              </button>
              <button type="button" className="button button-secondary" onClick={closeClearAllDataConfirm}>
                {t('Abbrechen', 'Cancel')}
              </button>
            </div>
          </article>
        </div>
      ) : null}

      {importSuccessMessage ? (
        <div
          className="form-modal-backdrop"
          onMouseDown={importSuccessBackdropCloseGuard.onBackdropMouseDown}
          onClick={importSuccessBackdropCloseGuard.onBackdropClick}
          role="presentation"
        >
          <article className="card form-modal confirm-modal" onMouseDownCapture={importSuccessBackdropCloseGuard.onModalMouseDownCapture} onClick={(event) => event.stopPropagation()}>
            <header className="section-header">
              <h2>{t('Import erfolgreich', 'Import successful')}</h2>
              <button type="button" className="icon-button" onClick={closeImportSuccess} aria-label={t('Popup schließen', 'Close popup')}>
                ×
              </button>
            </header>
            <p>{importSuccessMessage}</p>
            <div className="form-actions">
              <button type="button" className="button button-primary" onClick={closeImportSuccess}>
                {t('OK', 'OK')}
              </button>
            </div>
          </article>
        </div>
      ) : null}
    </section>
  )
}




