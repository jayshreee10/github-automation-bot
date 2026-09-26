import { useRef, useState } from 'react'
import { ChevronDown, FolderGit2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import type { Repository } from '@/features/repositories/schemas'
import { useRepoFilter } from './use-repo-filter'

const ALL = 'all'

// "owner/name" -> "name"; the owner is the same for every repo in the list.
const repoName = (r: Repository) => r.fullName.split('/').pop() ?? r.fullName

export function RepoFilter({ repositories }: { repositories: Repository[] }) {
  const { repoId, setRepoId } = useRepoFilter()
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const selected = repositories.find((r) => r.id === repoId)
  const q = query.trim().toLowerCase()
  const matches = q ? repositories.filter((r) => repoName(r).toLowerCase().includes(q)) : repositories

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        setQuery('')
        // Radix focuses the menu on open; move focus to search right after.
        if (open) requestAnimationFrame(() => searchRef.current?.focus())
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="repo-filter" aria-label="Repository filter">
          <FolderGit2 />
          <span className="repo-filter-label">{selected ? repoName(selected) : 'All repositories'}</span>
          <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      {/* Set inline (not in CSS) so they override the menu's own utility classes. Fixed width: long names truncate. */}
      <DropdownMenuContent align="end" className="flex w-80 flex-col overflow-hidden">
        <DropdownMenuLabel>Repository</DropdownMenuLabel>
        <div className="repo-filter-search">
          <Search />
          <Input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            // Keep typing out of the menu's typeahead; Escape still closes it.
            onKeyDown={(e) => e.key !== 'Escape' && e.stopPropagation()}
            placeholder="Search repositories"
            aria-label="Search repositories"
            className="pl-8"
          />
        </div>
        <DropdownMenuSeparator />
        <div className="repo-filter-list">
          <DropdownMenuRadioGroup value={repoId ?? ALL} onValueChange={(v) => setRepoId(v === ALL ? null : v)}>
            {!q && <DropdownMenuRadioItem value={ALL}>All repositories</DropdownMenuRadioItem>}
            {matches.map((r) => (
              <DropdownMenuRadioItem key={r.id} value={r.id} title={r.fullName}>
                <span className="truncate">{repoName(r)}</span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          {matches.length === 0 && <p className="repo-filter-empty">No repositories match</p>}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
