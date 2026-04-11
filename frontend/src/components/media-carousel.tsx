import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { TicketAttachment } from '@/lib/api'
import { AttachmentPreview } from '@/components/attachment-preview'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Props = {
  attachments: TicketAttachment[]
  /** default: full width detail; compact: feed / comment strip */
  variant?: 'default' | 'compact'
  className?: string
}

function isVisual(a: TicketAttachment) {
  return a.mime_type.startsWith('image/') || a.mime_type.startsWith('video/')
}

export function MediaCarousel({ attachments, variant = 'default', className }: Props) {
  const visual = useMemo(() => attachments.filter(isVisual), [attachments])
  const other = useMemo(() => attachments.filter((a) => !isVisual(a)), [attachments])
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)

  const n = visual.length
  const compact = variant === 'compact'

  const scrollToIndex = useCallback(
    (i: number) => {
      const el = scrollerRef.current
      if (!el || n === 0) return
      const next = Math.max(0, Math.min(i, n - 1))
      const child = el.children[next] as HTMLElement | undefined
      if (child) {
        child.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
      }
      setIndex(next)
    },
    [n],
  )

  useEffect(() => {
    const el = scrollerRef.current
    if (!el || n === 0) return
    const onScroll = () => {
      const w = el.clientWidth
      if (w <= 0) return
      const slideW = el.scrollWidth / n
      if (slideW <= 0) return
      const i = Math.round(el.scrollLeft / slideW)
      setIndex(Math.max(0, Math.min(i, n - 1)))
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [n])

  useEffect(() => {
    setIndex(0)
  }, [attachments])

  if (n === 0 && other.length === 0) {
    return null
  }

  const slideClass = compact
    ? 'min-w-[88%] snap-center sm:min-w-[70%]'
    : 'w-full min-w-full snap-center shrink-0'

  return (
    <div className={cn('w-full', className)}>
      {n > 0 ? (
        <div className="relative">
          {n > 1 ? (
            <>
              <Button
                type="button"
                variant="secondary"
                size="icon-sm"
                className={cn(
                  'absolute top-1/2 z-10 -translate-y-1/2 rounded-full shadow-md',
                  compact ? 'left-0.5 size-7' : 'left-1 size-9',
                )}
                aria-label="Anterior"
                onClick={() => scrollToIndex(index - 1)}
                disabled={index <= 0}
              >
                <ChevronLeft className={compact ? 'size-4' : 'size-5'} />
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="icon-sm"
                className={cn(
                  'absolute top-1/2 z-10 -translate-y-1/2 rounded-full shadow-md',
                  compact ? 'right-0.5 size-7' : 'right-1 size-9',
                )}
                aria-label="Próximo"
                onClick={() => scrollToIndex(index + 1)}
                disabled={index >= n - 1}
              >
                <ChevronRight className={compact ? 'size-4' : 'size-5'} />
              </Button>
            </>
          ) : null}
          <div
            ref={scrollerRef}
            className={cn(
              'flex overflow-x-auto scroll-smooth scrollbar-x-hover',
              compact ? 'gap-2 pb-1 pt-0.5' : 'gap-0',
              'snap-x snap-mandatory',
            )}
          >
            {visual.map((a) => (
              <div key={a.id} className={cn(slideClass, 'flex-shrink-0')}>
                {a.mime_type.startsWith('image/') ? (
                  <AttachmentPreview attachment={a}>
                    <img
                      src={a.url}
                      alt={a.original_name}
                      className={cn(
                        'w-full rounded-lg border border-border/60 object-cover',
                        compact ? 'aspect-video max-h-40' : 'max-h-[min(70vh,28rem)] min-h-[12rem] bg-muted/20',
                      )}
                      loading="lazy"
                    />
                  </AttachmentPreview>
                ) : (
                  <AttachmentPreview attachment={a}>
                    <div
                      className={cn(
                        'overflow-hidden rounded-lg border border-border/60 bg-black/50',
                        compact ? 'aspect-video max-h-40' : 'max-h-[min(70vh,28rem)] min-h-[12rem]',
                      )}
                    >
                      <video
                        src={a.url}
                        controls
                        className="h-full w-full object-contain"
                        preload="metadata"
                        playsInline
                      />
                    </div>
                  </AttachmentPreview>
                )}
              </div>
            ))}
          </div>
          {n > 1 ? (
            <p className="mt-1.5 text-center text-xs tabular-nums text-muted-foreground">
              {index + 1} / {n}
            </p>
          ) : null}
        </div>
      ) : null}
      {other.length > 0 ? (
        <ul className={cn('mt-2 space-y-1', compact && 'text-xs')}>
          {other.map((a) => (
            <li key={a.id}>
              <a href={a.url} className="text-primary underline" target="_blank" rel="noreferrer">
                {a.original_name}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
