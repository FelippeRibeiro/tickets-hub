import type { ReactElement } from 'react'
import type { TicketAttachment } from '@/lib/api'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

type AttachmentPreviewProps = {
  attachment: TicketAttachment
  children: ReactElement
}

export function AttachmentPreview({
  attachment,
  children,
}: AttachmentPreviewProps) {
  const isVisualMedia =
    attachment.mime_type.startsWith('image/') ||
    attachment.mime_type.startsWith('video/')

  if (!isVisualMedia) {
    return children
  }

  return (
    <Dialog>
      <DialogTrigger
        render={
          <button
            type="button"
            className="block cursor-zoom-in rounded-lg transition-opacity hover:opacity-95"
            aria-label={`Ver anexo ${attachment.original_name}`}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
          />
        }
      >
        {children}
      </DialogTrigger>
      <DialogContent
        className="max-w-[min(96vw,64rem)] gap-3 bg-background/95 p-3 sm:p-4"
        showCloseButton
      >
        <DialogTitle className="sr-only">
          Visualizacao do anexo
        </DialogTitle>
        <DialogDescription className="sr-only">
          Preview ampliado de {attachment.original_name}.
        </DialogDescription>
        {attachment.mime_type.startsWith('image/') ? (
          <img
            src={attachment.url}
            alt={attachment.original_name}
            className="max-h-[82vh] w-full rounded-xl object-contain"
          />
        ) : (
          <video
            src={attachment.url}
            controls
            autoPlay
            className="max-h-[82vh] w-full rounded-xl bg-black/40 object-contain"
            preload="metadata"
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
