import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { ApiError, createTicket, type Topic } from '@/lib/api'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

type Props = {
  topics: Topic[]
  onCreated: () => void
}

export function ComposeTicketDialog({ topics, onCreated }: Props) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [topicId, setTopicId] = useState<string>('')
  const [files, setFiles] = useState<File[]>([])
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const selectedTopic = topics.find((t) => String(t.id) === topicId)

  useEffect(() => {
    if (!open) {
      return
    }
    setError(null)
  }, [open])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const id = Number(topicId)
    if (!id) {
      setError('Escolha um tópico')
      return
    }
    setError(null)
    setPending(true)
    try {
      await createTicket({
        title,
        description,
        topic_id: id,
        is_anonymous: isAnonymous,
        files: files.length > 0 ? files : undefined,
      })
      setTitle('')
      setDescription('')
      setTopicId('')
      setFiles([])
      setIsAnonymous(false)
      setOpen(false)
      onCreated()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao criar ticket')
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        className="gap-1.5"
        onClick={() => setOpen(true)}
      >
        <Plus className="size-4" />
        Novo ticket
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[calc(100svh-2rem)] max-w-md flex-col overflow-hidden p-0 sm:max-w-md">
        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle className="px-4 pt-4">Novo ticket</DialogTitle>
            <DialogDescription className="px-4">
              Escolha o tópico e descreva o que está acontecendo.
            </DialogDescription>
          </DialogHeader>
          <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-4 py-2">
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="ticket-title">Título</Label>
              <Input
                id="ticket-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Resumo curto"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Tópico</Label>
              <Select
                value={topicId || undefined}
                onValueChange={(v) => setTopicId(v ?? '')}
              >
                <SelectTrigger className="w-full min-w-0">
                  <SelectValue placeholder="Selecione um tópico">
                    {selectedTopic?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {topics.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.name || `Tópico #${t.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ticket-body">Descrição</Label>
              <Textarea
                id="ticket-body"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalhes, passos para reproduzir, etc."
                rows={5}
                required
                className="min-h-32 resize-y"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ticket-files">Anexos (opcional)</Label>
              <p className="text-xs text-muted-foreground">
                Imagens e vídeos no envio; até 1 GB por arquivo.
              </p>
              <Input
                id="ticket-files"
                type="file"
                accept="image/*,video/*"
                multiple
                className="cursor-pointer"
                onChange={(e) => {
                  const list = e.target.files
                  setFiles(list ? Array.from(list) : [])
                }}
              />
              {files.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {files.length}{' '}
                  {files.length === 1 ? 'arquivo selecionado' : 'arquivos selecionados'}
                </p>
              ) : null}
            </div>
            <label
              htmlFor="ticket-anonymous"
              className="flex items-start gap-3 rounded-lg border border-border/70 bg-muted/20 p-3"
            >
              <Input
                id="ticket-anonymous"
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-border px-0 py-0"
              />
              <div className="space-y-1">
                <span className="block text-sm font-medium">
                  Publicar anonimamente
                </span>
                <span className="block text-xs text-muted-foreground">
                  Seu nome e foto de perfil nao serao exibidos neste ticket.
                </span>
              </div>
            </label>
          </div>
          <DialogFooter className="mt-2 sm:justify-end">
            <Button type="submit" disabled={pending} className="w-full sm:w-auto">
              {pending ? 'Publicando…' : 'Publicar'}
            </Button>
          </DialogFooter>
        </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
