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
  const isImage = attachment.mime_type.startsWith('image/')

  /* Só imagens usam lightbox. Vídeo fica só o player (evita <button> por cima dos controlos no mobile). */
  if (!isImage) {
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
        <img
          src={attachment.url}
          alt={attachment.original_name}
          className="max-h-[82vh] w-full rounded-xl object-contain"
        />
      </DialogContent>
    </Dialog>
  )
}
