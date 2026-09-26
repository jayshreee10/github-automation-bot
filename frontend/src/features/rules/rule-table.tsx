import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Chip } from '@/components/chip'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { shortAge } from '@/lib/time'
import { actionChips, anyEventText, conditionSentence, ruleEventKeys, shortRepoName } from './rule-sentence'
import type { Rule } from './schemas'

interface Props {
  rules: Rule[]
  repoNames: Map<string, string>
  search: string
  onToggle: (rule: Rule, enabled: boolean) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

function firedText(rule: Rule): string {
  if (!rule.enabled) return 'Disabled'
  return rule.lastFiredAt ? `${shortAge(rule.lastFiredAt)} ago` : 'Never'
}

export function RuleTable({ rules, repoNames, search, onToggle, onDelete }: Props) {
  async function toggle(rule: Rule, enabled: boolean) {
    try {
      await onToggle(rule, enabled)
      toast.success(`${rule.name} ${enabled ? 'enabled' : 'disabled'}`)
    } catch {
      toast.error(`Could not update ${rule.name}`)
    }
  }

  return (
    <div className="panel rules-table">
      <Table className="data-table">
        <TableHeader>
          <TableRow>
            <TableHead className="col-switch">On</TableHead>
            <TableHead>Rule</TableHead>
            <TableHead>When</TableHead>
            <TableHead>If</TableHead>
            <TableHead>Then</TableHead>
            <TableHead>Fired</TableHead>
            <TableHead className="col-menu">
              <span className="visually-hidden">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rules.map((rule) => {
            const sentence = conditionSentence(rule.event, rule.conditions)
            const repo = repoNames.get(rule.repositoryId)
            return (
              <TableRow key={rule.id} data-disabled={!rule.enabled || undefined} className="rule-row">
                <TableCell>
                  <Switch
                    checked={rule.enabled}
                    onCheckedChange={(on) => toggle(rule, on)}
                    aria-label={`${rule.enabled ? 'Disable' : 'Enable'} ${rule.name}`}
                  />
                </TableCell>
                <TableCell>
                  <span className="rule-cell">
                    <Link className="rule-name" to={{ pathname: `/rules/${rule.id}`, search }}>
                      {rule.name}
                    </Link>
                    <span className="rule-repo" title={repo}>
                      {repo ? shortRepoName(repo) : ''}
                    </span>
                  </span>
                </TableCell>
                <TableCell>
                  <span className="rule-keys">
                    {ruleEventKeys(rule.event, rule.conditions).map((k) => (
                      <span key={k} className="mono">
                        {k}
                      </span>
                    ))}
                  </span>
                </TableCell>
                <TableCell className="rule-if" data-empty={!sentence || undefined}>
                  {sentence || anyEventText(rule.event)}
                </TableCell>
                <TableCell>
                  <span className="chip-row">
                    {actionChips(rule.actions).map((c) => (
                      <Chip key={c}>{c}</Chip>
                    ))}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="rule-fired">
                    <span>{rule.firedCount}</span>
                    <span className="rule-fired-when">{firedText(rule)}</span>
                  </span>
                </TableCell>
                <TableCell>
                  <RuleMenu rule={rule} search={search} onDelete={onDelete} />
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

// Row menu; the confirm dialog is controlled so it can open after the menu closes.
function RuleMenu({ rule, search, onDelete }: { rule: Rule; search: string; onDelete: (id: string) => Promise<void> }) {
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)

  async function remove() {
    try {
      await onDelete(rule.id)
      toast.success(`${rule.name} deleted`)
    } catch {
      toast.error(`Could not delete ${rule.name}`)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`More actions for ${rule.name}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => navigate({ pathname: `/rules/${rule.id}`, search })}>
            <Pencil />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirming(true)}>
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{rule.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              The bot stops acting on this rule. Its action history is removed with it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={remove}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
