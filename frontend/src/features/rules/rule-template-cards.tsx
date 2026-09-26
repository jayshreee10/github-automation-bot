import { ArrowRight, CircleDot, GitCommitHorizontal, GitPullRequest } from 'lucide-react'
import { Link } from 'react-router'
import { RULE_TEMPLATES, templateSearch } from './rule-templates'

const ICONS = { issues: CircleDot, pull_request: GitPullRequest, push: GitCommitHorizontal }

// One card per starter rule; each opens the editor prefilled, so the user reviews it before saving.
export function RuleTemplateCards({ repoId }: { repoId: string | null }) {
  return (
    <ul className="rule-templates">
      {RULE_TEMPLATES.map((t) => {
        const Icon = ICONS[t.event]
        return (
          <li key={t.id}>
            <Link
              className="rule-template"
              to={{ pathname: '/rules/new', search: templateSearch(t.id, repoId) }}
              aria-label={`Use template: ${t.name}`}
            >
              <span className="rule-template-icon" data-event={t.event}>
                <Icon />
              </span>
              <span className="rule-template-name">{t.name}</span>
              <span className="rule-template-text">{t.description}</span>
              <span className="rule-template-flow">
                <span className="rule-template-step">
                  <span className="rule-template-key">When</span>
                  <span className="chip" data-mono>
                    {t.when}
                  </span>
                </span>
                <span className="rule-template-step">
                  <span className="rule-template-key">Then</span>
                  {t.then.map((a) => (
                    <span key={a} className="chip">
                      {a}
                    </span>
                  ))}
                </span>
              </span>
              <span className="rule-template-cta">
                Use template
                <ArrowRight />
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
