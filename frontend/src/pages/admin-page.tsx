import { useCallback, useEffect, useState } from 'react'
import { ApiError, createTopic, getUsers, type User } from '@/lib/api'
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
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [pendingTopic, setPendingTopic] = useState(false)

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

  async function onCreateTopic(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    setErr(null)
    setPendingTopic(true)
    try {
      await createTopic(topicName.trim())
      setTopicName('')
      setMsg('Tópico criado.')
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Erro ao criar tópico')
    } finally {
      setPendingTopic(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Painel admin</h1>
        <p className="text-sm text-muted-foreground">
          Rotas <code className="text-xs">GET /api/users</code> e{' '}
          <code className="text-xs">POST /api/topics</code>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Novo tópico</CardTitle>
          <CardDescription>
            Categorias usadas nos tickets (POST /api/topics).
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

      <Card>
        <CardHeader>
          <CardTitle>Usuários</CardTitle>
          <CardDescription>GET /api/users</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[min(24rem,50vh)] rounded-md border border-border">
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
