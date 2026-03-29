import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
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
  return (
    <Avatar size={size} className={cn('shrink-0 select-none', className)}>
      {hasAvatar ? (
        <AvatarImage src={userAvatarUrl(userId)} alt="" />
      ) : null}
      <AvatarFallback>{initialsFromName(name)}</AvatarFallback>
    </Avatar>
  )
}
