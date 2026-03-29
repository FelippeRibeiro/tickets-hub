import { useRef } from 'react'
import type { TicketAttachment } from '@/lib/api'

const MAX_PREVIEW = 4

type Props = {
  attachments: TicketAttachment[]
}

function FeedThumb({ a }: { a: TicketAttachment }) {
  const videoRef = useRef<HTMLVideoElement>(null)

  if (a.mime_type.startsWith('image/')) {
    return (
      <img
        src={a.url}
        alt=""
        className="h-14 max-w-[120px] rounded-md border border-border/60 object-cover"
        loading="lazy"
      />
    )
  }

  if (a.mime_type.startsWith('video/')) {
    return (
      <div
        className="relative h-14 w-[104px] shrink-0 overflow-hidden rounded-md border border-border/60 bg-black/40"
        onMouseEnter={() => {
          void videoRef.current?.play()
        }}
        onMouseLeave={() => {
          const v = videoRef.current
          if (v) {
            v.pause()
            v.currentTime = 0
          }
        }}
      >
        <video
          ref={videoRef}
          src={a.url}
          muted
          playsInline
          loop
          preload="metadata"
          className="h-full w-full object-cover"
        />
      </div>
    )
  }

  return (
    <span className="flex h-14 max-w-[100px] items-center truncate rounded-md border border-border/60 bg-muted/30 px-1.5 text-[10px] text-muted-foreground">
      {a.original_name}
    </span>
  )
}

export function TicketFeedAttachments({ attachments }: Props) {
  if (!attachments?.length) {
    return null
  }
  const show = attachments.slice(0, MAX_PREVIEW)
  const rest = attachments.length - show.length

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {show.map((a) => (
        <FeedThumb key={a.id} a={a} />
      ))}
      {rest > 0 ? (
        <span className="flex h-14 min-w-9 items-center justify-center rounded-md border border-border/70 bg-muted/40 px-2 text-xs font-medium text-muted-foreground tabular-nums">
          +{rest}
        </span>
      ) : null}
    </div>
  )
}
