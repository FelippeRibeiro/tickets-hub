import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError, registerUser } from '@/lib/api'
import { useAuth } from '@/contexts/auth-context'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export function RegisterPage() {
  const navigate = useNavigate()
  const { refresh } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    try {
      await registerUser({ name, email, password })
      await refresh()
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível registrar')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="relative flex min-h-svh items-center justify-center bg-linear-to-b from-background via-background to-muted/30 p-4">
      <Card className="w-full max-w-md border-border/70 bg-card/80 shadow-xl backdrop-blur">
        <CardHeader>
          <CardTitle className="text-2xl">Criar conta</CardTitle>
          <CardDescription>
            Cadastre-se para abrir tickets e acompanhar a comunidade.
          </CardDescription>
        </CardHeader>
        <form onSubmit={onSubmit}>
          <CardContent className="space-y-4">
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3 border-t border-border/70 bg-muted/20 sm:flex-row sm:justify-between">
            <Button type="submit" disabled={pending} className="w-full sm:w-auto">
              {pending ? 'Registrando…' : 'Registrar'}
            </Button>
            <Link
              to="/login"
              className={cn(
                buttonVariants({ variant: 'ghost' }),
                'w-full sm:w-auto'
              )}
            >
              Já tenho conta
            </Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
