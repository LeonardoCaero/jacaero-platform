import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { api } from '../lib/axios'

// Photos live behind authenticated endpoints, so they're fetched as blobs rather than plain <img src>.
function usePhotoUrl(url: string) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let objectUrl: string | null = null
    let cancelled = false
    api.get(url, { responseType: 'blob' }).then((res) => {
      if (cancelled) return
      objectUrl = URL.createObjectURL(res.data)
      setSrc(objectUrl)
    })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [url])

  return src
}

export function PhotoThumbnail({ url, onDelete }: { url: string; onDelete: () => void }) {
  const src = usePhotoUrl(url)

  return (
    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-line dark:border-line-dark">
      {src && <img src={src} alt="" className="h-full w-full object-cover" />}
      <button
        type="button"
        onClick={onDelete}
        className="absolute top-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-ink/70 text-cream"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}

export function FullPhoto({ url }: { url: string }) {
  const src = usePhotoUrl(url)

  return (
    <div className="overflow-hidden rounded-xl border border-line dark:border-line-dark">
      {src ? (
        <img src={src} alt="" className="w-full object-contain" />
      ) : (
        <div className="h-40 animate-pulse bg-paper dark:bg-paper-dark" />
      )}
    </div>
  )
}

export function PendingPhotoThumbnail({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  return (
    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-line dark:border-line-dark">
      {src && <img src={src} alt="" className="h-full w-full object-cover" />}
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-ink/70 text-cream"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}
