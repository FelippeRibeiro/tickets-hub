import { useEffect, useState } from 'react'
import { FolderPlus } from 'lucide-react'
import { ApiError, createTopic } from '@/lib/api'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Props = {
  onCreated: () => void
}

export function CreateTopicDialog({ onCreated }: Props) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!open) return
    setError(null)
  }, [open])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Informe um nome')
      return
    }
    setError(null)
    setPending(true)
    try {
      await createTopic(trimmed)
      setName('')
      setOpen(false)
      onCreated()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao criar tópico')
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="shrink-0 gap-1.5"
        onClick={() => setOpen(true)}
      >
        <FolderPlus className="size-4" />
        Novo tópico
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md sm:max-w-md">
          <form onSubmit={onSubmit}>
            <DialogHeader>
              <DialogTitle>Novo tópico</DialogTitle>
              <DialogDescription>
                Crie uma categoria para classificar tickets. O nome não pode repetir um tópico
                existente.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              {error ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="new-topic-name">Nome</Label>
                <Input
                  id="new-topic-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex.: Infraestrutura"
                  autoComplete="off"
                  required
                />
              </div>
            </div>
            <DialogFooter className="border-0 bg-transparent p-0 pt-2 sm:justify-end">
              <Button type="submit" disabled={pending}>
                {pending ? 'Criando…' : 'Criar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
