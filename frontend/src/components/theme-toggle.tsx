import { Check, Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from '@/contexts/theme-context'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

type Props = {
  /** Se true, posiciona no canto (telas de login/cadastro). */
  floating?: boolean
}

export function ThemeToggle({ floating }: Props) {
  const { theme, resolvedTheme, setTheme } = useTheme()

  return (
    <div
      className={cn(floating && 'fixed right-4 top-4 z-50 md:right-6 md:top-6')}
    >
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              size="icon-sm"
              className="border-border bg-background/80 shadow-sm backdrop-blur"
              aria-label="Tema"
            />
          }
        >
          {resolvedTheme === 'dark' ? (
            <Moon className="size-4" />
          ) : (
            <Sun className="size-4" />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-40">
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            Aparência
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="flex items-center justify-between gap-2"
            onClick={() => setTheme('light')}
          >
            <span className="flex items-center gap-2">
              <Sun className="size-4" />
              Claro
            </span>
            {theme === 'light' ? <Check className="size-4 shrink-0" /> : null}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="flex items-center justify-between gap-2"
            onClick={() => setTheme('dark')}
          >
            <span className="flex items-center gap-2">
              <Moon className="size-4" />
              Escuro
            </span>
            {theme === 'dark' ? <Check className="size-4 shrink-0" /> : null}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="flex items-center justify-between gap-2"
            onClick={() => setTheme('system')}
          >
            <span className="flex items-center gap-2">
              <Monitor className="size-4" />
              Sistema
            </span>
            {theme === 'system' ? <Check className="size-4 shrink-0" /> : null}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
