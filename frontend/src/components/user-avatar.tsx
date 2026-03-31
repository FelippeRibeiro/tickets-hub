import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { cn, initialsFromName } from '@/lib/utils'
import { userAvatarUrl } from '@/lib/api'

type UserAvatarProps = {
  userId: number
  name: string
  hasAvatar: boolean
  size?: 'sm' | 'default' | 'lg'
  className?: string
}

export function UserAvatar({
  userId,
  name,
  hasAvatar,
  size = 'default',
  className,
}: UserAvatarProps) {
  const avatarUrl = userAvatarUrl(userId)

  const avatarNode = (
    <Avatar size={size} className={cn('shrink-0 select-none', className)}>
      {hasAvatar ? <AvatarImage src={avatarUrl} alt={name} /> : null}
      <AvatarFallback>{initialsFromName(name)}</AvatarFallback>
    </Avatar>
  )

  if (!hasAvatar) {
    return avatarNode
  }

  return (
    <Dialog>
      <DialogTrigger
        render={
          <button
            type="button"
            className="cursor-zoom-in rounded-full transition-opacity hover:opacity-90"
            aria-label={`Ver foto de perfil de ${name}`}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
          />
        }
      >
        {avatarNode}
      </DialogTrigger>
      <DialogContent
        className="max-w-[min(92vw,42rem)] gap-3 bg-background/95 p-3 sm:p-4"
        showCloseButton
      >
        <DialogTitle className="sr-only">Foto de perfil</DialogTitle>
        <DialogDescription className="sr-only">
          Visualizacao ampliada da foto de perfil de {name}.
        </DialogDescription>
        <img
          src={avatarUrl}
          alt={`Foto de perfil de ${name}`}
          className="max-h-[80vh] w-full rounded-xl object-contain"
        />
      </DialogContent>
    </Dialog>
  )
}
