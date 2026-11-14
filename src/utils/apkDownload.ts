export interface DownloadedApkResult {
  url: string
  filename: string
}

export async function downloadStarterApkInChunks(
  onProgress: (percent: number) => void,
): Promise<DownloadedApkResult> {
  const metaRes = await fetch('/api/download/apk-meta')
  if (!metaRes.ok) {
    throw new Error('Starter APK metadata could not be loaded.')
  }
  const meta = (await metaRes.json()) as {
    available: boolean
    filename: string
    totalBytes: number
    totalChunks: number
    error?: string
  }
  if (!meta.available || !meta.totalChunks) {
    throw new Error(meta.error || 'Starter APK is unavailable.')
  }

  const buffers: ArrayBuffer[] = []
  let received = 0

  for (let i = 0; i < meta.totalChunks; i++) {
    const chunkRes = await fetch(`/api/download/apk-chunk/${i}`)
    if (!chunkRes.ok) {
      throw new Error(`Failed to download APK chunk ${i + 1}/${meta.totalChunks}`)
    }
    const buf = await chunkRes.arrayBuffer()
    buffers.push(buf)
    received += buf.byteLength
    onProgress(Math.min(100, Math.round((received / meta.totalBytes) * 100)))
  }

  const filename = meta.filename || 'charlok-starter.apk'
  const blob = new Blob(buffers, {
    type: 'application/vnd.android.package-archive',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  return { url, filename }
}
