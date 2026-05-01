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

  const enlargedVideo = (
    <video
      src={attachment.url}
      controls
      playsInline
      className="max-h-[min(92vh,48rem)] w-full rounded-xl bg-black object-contain sm:max-h-[85vh]"
      preload="metadata"
    />
  )

  /* Vídeo não pode ficar dentro de <button> (trigger em volta de tudo): quebra controles nativos no mobile. */
  if (attachment.mime_type.startsWith('video/')) {
    return (
      <Dialog>
        <div className="relative w-full max-w-full">
          {children}
          <DialogTrigger
            render={
              <button
                type="button"
                className="absolute right-2 top-2 z-10 rounded-md border border-white/25 bg-black/75 px-2 py-1.5 text-[11px] font-medium text-white shadow-md backdrop-blur-sm hover:bg-black/90 sm:text-xs"
                aria-label={`Ampliar vídeo ${attachment.original_name}`}
              />
            }
          >
            Ampliar
          </DialogTrigger>
        </div>
        <DialogContent
          className="max-w-[min(96vw,64rem)] gap-3 bg-background/95 p-3 sm:p-4"
          showCloseButton
        >
          <DialogTitle className="sr-only">Visualizacao do anexo</DialogTitle>
          <DialogDescription className="sr-only">Preview ampliado de {attachment.original_name}.</DialogDescription>
          {enlargedVideo}
        </DialogContent>
      </Dialog>
    )
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
