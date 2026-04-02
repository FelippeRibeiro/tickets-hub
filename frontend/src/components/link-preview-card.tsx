import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, Link2 } from 'lucide-react'
import { ApiError, getLinkPreview, type LinkPreview } from '@/lib/api'

type LinkPreviewCardProps = {
  url: string
}

export function LinkPreviewCard({ url }: LinkPreviewCardProps) {
  const [preview, setPreview] = useState<LinkPreview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const hostname = useMemo(() => {
    try {
      return new URL(url).hostname
    } catch {
      return url
    }
  }, [url])

  useEffect(() => {
    let cancelled = false

    setLoading(true)
    setError(null)

    void getLinkPreview(url)
      .then((data) => {
        if (!cancelled) {
          setPreview(data)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setPreview(null)
          setError(err instanceof ApiError ? err.message : 'Preview indisponível')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [url])

  return (
    <a
      href={preview?.url ?? url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-4 block rounded-xl border border-border/70 bg-muted/20 p-4 transition-colors hover:bg-muted/35"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-lg bg-background/80 p-2 text-muted-foreground">
          <Link2 className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="truncate">{preview?.host || hostname}</span>
            <ExternalLink className="size-3.5 shrink-0" />
          </div>
          {loading ? (
            <p className="mt-2 text-sm text-muted-foreground">Carregando preview do link...</p>
          ) : error ? (
            <>
              <p className="mt-2 text-sm font-medium">{hostname}</p>
              <p className="mt-1 text-xs text-muted-foreground">{error}</p>
            </>
          ) : (
            <>
              <p className="mt-2 line-clamp-2 text-sm font-semibold text-foreground">{preview?.title || hostname}</p>
              {preview?.description ? (
                <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{preview.description}</p>
              ) : null}
            </>
          )}
        </div>
      </div>
    </a>
  )
}
