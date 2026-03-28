import { useCallback, useEffect, useState } from 'react'
import { ApiError, createTopic, deleteTopic, getTopics, getUsers, type User, type Topic } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export function AdminPage() {
  const [users, setUsers] = useState<User[]>([])
  const [topicName, setTopicName] = useState('')
  const [topics, setTopics] = useState<Topic[]>([])
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [loadingTopics, setLoadingTopics] = useState(true)
  const [pendingTopic, setPendingTopic] = useState(false)
  const [deletingTopicID, setDeletingTopicID] = useState<number | null>(null)

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true)
    setErr(null)
    try {
      const list = await getUsers()
      setUsers(list)
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Erro ao listar usuários')
    } finally {
      setLoadingUsers(false)
    }
  }, [])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  const loadTopics = useCallback(async () => {
    setLoadingTopics(true)
    try {
      const list = await getTopics()
      setTopics(list)
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Erro ao listar tópicos')
    } finally {
      setLoadingTopics(false)
    }
  }, [])

  useEffect(() => {
    void loadTopics()
  }, [loadTopics])

  async function onCreateTopic(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    setErr(null)
    setPendingTopic(true)
    try {
      await createTopic(topicName.trim())
      setTopicName('')
      setMsg('Tópico criado.')
      await loadTopics()
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Erro ao criar tópico')
    } finally {
      setPendingTopic(false)
    }
  }

  async function onDeleteTopic(topic: Topic) {
    if (deletingTopicID !== null) {
      return
    }
    const hasTickets = (topic.tickets_count ?? 0) > 0
    const firstConfirm = window.confirm(
      hasTickets
        ? `O tópico "${topic.name}" possui ${topic.tickets_count} ticket(s) atrelado(s). Deseja continuar?`
        : `Deseja apagar o tópico "${topic.name}"?`
    )
    if (!firstConfirm) {
      return
    }
    setDeletingTopicID(topic.id)
    setErr(null)
    setMsg(null)
    try {
      await deleteTopic(topic.id)
      setMsg('Tópico removido.')
      await loadTopics()
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        const forceConfirm = window.confirm(
          `Esse tópico tem tickets vinculados e eles serão perdidos. Confirmar exclusão definitiva de "${topic.name}"?`
        )
        if (!forceConfirm) {
          return
        }
        await deleteTopic(topic.id, true)
        setMsg('Tópico removido com tickets atrelados.')
        await loadTopics()
      } else {
        setErr(e instanceof ApiError ? e.message : 'Erro ao apagar tópico')
      }
    } finally {
      setDeletingTopicID(null)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-5 md:p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Painel admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Rotas <code className="text-xs">GET /api/users</code> e{' '}
          <code className="text-xs">POST /api/topics</code>
        </p>
      </div>

      <Card className="border-border/70 bg-card/60 shadow-sm">
        <CardHeader>
          <CardTitle>Novo tópico</CardTitle>
          <CardDescription>
            Categorias usadas nos tickets. Qualquer usuário autenticado pode criar tópicos (POST /api/topics).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onCreateTopic} className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="topic-name">Nome</Label>
              <Input
                id="topic-name"
                value={topicName}
                onChange={(e) => setTopicName(e.target.value)}
                placeholder="Ex.: Financeiro"
                required
              />
            </div>
            <Button type="submit" disabled={pendingTopic}>
              {pendingTopic ? 'Salvando…' : 'Criar'}
            </Button>
          </form>
          {msg ? <p className="mt-3 text-sm text-primary">{msg}</p> : null}
          {err ? <p className="mt-3 text-sm text-destructive">{err}</p> : null}
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/60 shadow-sm">
        <CardHeader>
          <CardTitle>Tópicos</CardTitle>
          <CardDescription>GET /api/topics e DELETE /api/topics/{'{id}'}</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[min(20rem,45vh)] rounded-lg border border-border/70 bg-background/30">
            {loadingTopics ? (
              <p className="p-4 text-sm text-muted-foreground">Carregando tópicos…</p>
            ) : topics.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Nenhum tópico criado.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tickets</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topics.map((topic) => (
                    <TableRow key={topic.id}>
                      <TableCell>{topic.id}</TableCell>
                      <TableCell>{topic.name}</TableCell>
                      <TableCell>{topic.tickets_count ?? 0}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={deletingTopicID === topic.id}
                          onClick={() => void onDeleteTopic(topic)}
                        >
                          {deletingTopicID === topic.id ? 'Apagando…' : 'Apagar'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/60 shadow-sm">
        <CardHeader>
          <CardTitle>Usuários</CardTitle>
          <CardDescription>GET /api/users</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[min(24rem,50vh)] rounded-lg border border-border/70 bg-background/30">
            {loadingUsers ? (
              <p className="p-4 text-sm text-muted-foreground">Carregando…</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Admin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>{u.id}</TableCell>
                      <TableCell>{u.name}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>{u.is_admin ? 'Sim' : 'Não'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      <Separator />
      <p className="text-center text-xs text-muted-foreground">
        Health check: <code>/health</code> (use para monitoramento).
      </p>
    </div>
  )
}
