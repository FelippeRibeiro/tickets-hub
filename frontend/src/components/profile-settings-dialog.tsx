import {
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactElement,
} from 'react'
import { Camera, LoaderCircle, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { UserAvatar } from '@/components/user-avatar'
import { useAuth } from '@/contexts/auth-context'
import * as api from '@/lib/api'

type ProfileSettingsDialogProps = {
  trigger: ReactElement
}

export function ProfileSettingsDialog({
  trigger,
}: ProfileSettingsDialogProps) {
  const { user, refresh } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(user?.name ?? '')
  const [savingName, setSavingName] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!user) return null
  const currentUser = user

  async function onPickAvatar(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null)
    setUploadingAvatar(true)
    try {
      await api.uploadProfileAvatar(file)
      await refresh()
    } catch (err) {
      setError(
        err instanceof api.ApiError
          ? err.message
          : 'Nao foi possivel atualizar a foto.'
      )
    } finally {
      setUploadingAvatar(false)
    }
  }

  async function onRemoveAvatar() {
    if (!currentUser.has_avatar) return
    setError(null)
    setUploadingAvatar(true)
    try {
      await api.deleteProfileAvatar()
      await refresh()
    } catch (err) {
      setError(
        err instanceof api.ApiError
          ? err.message
          : 'Nao foi possivel remover a foto.'
      )
    } finally {
      setUploadingAvatar(false)
    }
  }

  async function onSaveName(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || trimmed === currentUser.name || savingName) return
    setError(null)
    setSavingName(true)
    try {
      await api.changeProfileName(trimmed)
      await refresh()
      setOpen(false)
    } catch (err) {
      setError(
        err instanceof api.ApiError
          ? err.message
          : 'Nao foi possivel atualizar o nome.'
      )
    } finally {
      setSavingName(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        setError(null)
        setName(currentUser.name)
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent className="max-w-[calc(100%-1rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Perfil</DialogTitle>
          <DialogDescription>
            Atualize sua foto e o nome exibido na plataforma.
          </DialogDescription>
        </DialogHeader>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="sr-only"
          onChange={(e) => void onPickAvatar(e)}
        />

        <div className="flex flex-col items-center gap-3 rounded-xl border border-border/70 bg-muted/20 p-4 text-center sm:flex-row sm:text-left">
          <UserAvatar
            userId={currentUser.id}
            name={currentUser.name}
            hasAvatar={Boolean(currentUser.has_avatar)}
            size="lg"
            className="size-16"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{currentUser.name}</p>
            <p className="truncate text-sm text-muted-foreground">
              {currentUser.email}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="secondary"
            className="flex-1"
            disabled={uploadingAvatar || savingName}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploadingAvatar ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Camera className="size-4" />
            )}
            Alterar foto
          </Button>
          {currentUser.has_avatar ? (
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              disabled={uploadingAvatar || savingName}
              onClick={() => void onRemoveAvatar()}
            >
              <Trash2 className="size-4" />
              Remover foto
            </Button>
          ) : null}
        </div>

        <form className="space-y-3" onSubmit={onSaveName}>
          <div className="space-y-2">
            <Label htmlFor="profile-name">Nome</Label>
            <Input
              id="profile-name"
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu nome"
            />
          </div>
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}
          <DialogFooter>
            <Button
              type="submit"
              disabled={
                savingName ||
                uploadingAvatar ||
                !name.trim() ||
                name.trim() === currentUser.name
              }
            >
              {savingName ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Pencil className="size-4" />
              )}
              Salvar nome
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
