import { isTauriRuntime } from './runtime'

export function triggerDownload(fileName: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export async function saveTextFileWithDialog(fileName: string, content: string, mimeType: string): Promise<'saved' | 'cancelled'> {
  if (!isTauriRuntime()) {
    triggerDownload(fileName, content, mimeType)
    return 'saved'
  }

  try {
    const [{ save }, { writeTextFile }] = await Promise.all([import('@tauri-apps/plugin-dialog'), import('@tauri-apps/plugin-fs')])
    const extension = fileName.includes('.') ? fileName.split('.').pop() ?? 'txt' : 'txt'
    const selectedPath = await save({
      defaultPath: fileName,
      filters: [{ name: extension.toUpperCase(), extensions: [extension] }],
    })

    if (typeof selectedPath !== 'string' || selectedPath.trim().length === 0) {
      return 'cancelled'
    }

    await writeTextFile(selectedPath, content)
    return 'saved'
  } catch {
    triggerDownload(fileName, content, mimeType)
    return 'saved'
  }
}
