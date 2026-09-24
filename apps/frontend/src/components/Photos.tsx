import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
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

function GalleryTile({ url, onOpen }: { url: string; onOpen: () => void }) {
  const src = usePhotoUrl(url)

  return (
    <button
      type="button"
      onClick={onOpen}
      className="aspect-square overflow-hidden rounded-lg border border-line dark:border-line-dark"
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="h-full w-full animate-pulse bg-paper dark:bg-paper-dark" />
      )}
    </button>
  )
}

function Lightbox({ urls, index, onChange, onClose }: { urls: string[]; index: number; onChange: (i: number) => void; onClose: () => void }) {
  const src = usePhotoUrl(urls[index])
  const go = (step: number) => onChange((index + step + urls.length) % urls.length)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const navClass = 'absolute top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-ink/60 text-cream'

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/90 p-4"
      onClick={(e) => {
        e.stopPropagation()
        onClose()
      }}
    >
      {src && <img src={src} alt="" className="max-h-full max-w-full object-contain" onClick={(e) => e.stopPropagation()} />}
      <button type="button" onClick={onClose} className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-ink/60 text-cream">
        <X className="h-5 w-5" />
      </button>
      {urls.length > 1 && (
        <>
          <button type="button" onClick={(e) => { e.stopPropagation(); go(-1) }} className={`${navClass} left-4`}>
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button type="button" onClick={(e) => { e.stopPropagation(); go(1) }} className={`${navClass} right-4`}>
            <ChevronRight className="h-6 w-6" />
          </button>
          <p className="absolute bottom-4 text-sm text-cream">
            {index + 1} / {urls.length}
          </p>
        </>
      )}
    </div>
  )
}

export function PhotoGallery({ urls }: { urls: string[] }) {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {urls.map((url, i) => (
          <GalleryTile key={url} url={url} onOpen={() => setOpen(i)} />
        ))}
      </div>
      {open !== null && <Lightbox urls={urls} index={open} onChange={setOpen} onClose={() => setOpen(null)} />}
    </>
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
