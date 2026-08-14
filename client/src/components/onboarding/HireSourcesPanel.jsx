import React, { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  AlertTriangle,
  Mail,
  Phone,
} from 'lucide-react';
import { toast } from 'sonner';
import { onboardingStrings } from './strings';
import {
  ACADEMIC_PROGRAMS,
  HIRE_SOURCES_CATALOG,
  RECRUITMENT_CONTACTS,
  RECRUITMENT_TIMELINE,
} from './hireSourcesCatalog';
import {
  isTimelineWhenActive,
  sortHireSourcesCatalog,
} from './sortHireSourcesCatalog';

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(onboardingStrings.hireSourcesCopied);
  } catch {
    toast.error('Could not copy');
  }
}

function SourceCard({ source, defaultOpen, isActiveNow }) {
  const [open, setOpen] = useState(!!defaultOpen);
  const needsDetail = source.status === 'needs_detail';

  return (
    <div
      className={`border rounded-lg bg-white overflow-hidden ${
        needsDetail ? 'border-amber-300' : isActiveNow ? 'border-[#C84B31]/40 ring-1 ring-[#C84B31]/20' : 'border-orange-100'
      }`}
    >
      <button
        type="button"
        className="w-full flex items-start gap-2 p-4 text-left hover:bg-orange-50/50 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? (
          <ChevronDown className="h-4 w-4 mt-1 shrink-0 text-[#C84B31]" />
        ) : (
          <ChevronRight className="h-4 w-4 mt-1 shrink-0 text-[#C84B31]" />
        )}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-[#C84B31]">{source.label}</span>
            {isActiveNow && (
              <Badge className="text-[10px] bg-[#C84B31] hover:bg-[#C84B31]">
                {onboardingStrings.hireSourcesActiveNow}
              </Badge>
            )}
            {needsDetail && (
              <Badge
                variant="outline"
                className="text-[10px] border-amber-400 text-amber-800 bg-amber-50"
              >
                <AlertTriangle className="h-3 w-3 mr-1" />
                {onboardingStrings.hireSourcesNeedsDetail}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{source.summary}</p>
          {source.bestFor?.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {source.bestFor.map((t) => (
                <Badge key={t} variant="secondary" className="text-[10px]">
                  {t}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 pl-10 space-y-4 border-t border-orange-50 pt-3">
          {source.howTo?.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                {onboardingStrings.hireSourcesHowTo}
              </h4>
              <ul className="list-disc pl-4 space-y-1 text-sm">
                {source.howTo.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
            </div>
          )}

          {source.events?.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                {onboardingStrings.hireSourcesEvents}
              </h4>
              <div className="space-y-2">
                {source.events.map((ev) => (
                  <div
                    key={ev.title}
                    className="rounded-md border border-orange-100 bg-orange-50/40 p-3 text-sm"
                  >
                    <p className="font-medium">{ev.title}</p>
                    <p className="text-muted-foreground">
                      {ev.date}
                      {ev.time ? ` · ${ev.time}` : ''}
                    </p>
                    <p className="text-muted-foreground">{ev.location}</p>
                    <p className="text-xs mt-1">{ev.focus}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {source.links?.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                {onboardingStrings.hireSourcesLinks}
              </h4>
              <ul className="space-y-1">
                {source.links.map((link) => (
                  <li key={link.url}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-[#C84B31] hover:underline"
                    >
                      {link.label}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {source.contacts?.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                {onboardingStrings.hireSourcesContacts}
              </h4>
              <div className="space-y-2">
                {source.contacts.map((c) => (
                  <div key={c.name} className="text-sm">
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.role}</p>
                    <div className="flex flex-wrap gap-3 mt-1">
                      {c.email && (
                        <a
                          href={`mailto:${c.email}`}
                          className="inline-flex items-center gap-1 text-[#C84B31] hover:underline text-xs"
                        >
                          <Mail className="h-3 w-3" />
                          {c.email}
                        </a>
                      )}
                      {c.phone && (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {c.phone}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {source.copyHints?.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                {onboardingStrings.hireSourcesCopy}
              </h4>
              <div className="space-y-2">
                {source.copyHints.map((hint, i) => (
                  <div
                    key={i}
                    className="rounded-md border bg-slate-50 p-3 text-sm whitespace-pre-wrap"
                  >
                    <p className="mb-2">{hint}</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 border-[#C84B31]/30 text-[#C84B31] hover:bg-orange-50"
                      onClick={() => copyText(hint)}
                    >
                      <Copy className="h-3.5 w-3.5 mr-1" />
                      {onboardingStrings.hireSourcesCopyBtn}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {source.notes?.length > 0 && (
            <ul className="space-y-1">
              {source.notes.map((n) => (
                <li
                  key={n}
                  className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded px-2 py-1.5"
                >
                  {n}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default function HireSourcesPanel() {
  const now = useMemo(() => new Date(), []);
  const { sorted, topActive } = useMemo(
    () => sortHireSourcesCatalog(HIRE_SOURCES_CATALOG, now),
    [now]
  );

  const recommendedHint =
    topActive != null
      ? onboardingStrings.hireSourcesRecommended.replace(
          '{source}',
          topActive.label
        )
      : null;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-lg font-semibold text-[#C84B31]">
          {onboardingStrings.hireSourcesTitle}
        </h2>
        <p className="text-sm text-muted-foreground">
          {recommendedHint ?? onboardingStrings.hireSourcesSubtitle}
        </p>
      </div>

      <div className="space-y-3">
        {sorted.map((source, idx) => (
          <SourceCard
            key={source.label}
            source={source}
            isActiveNow={source._relevance.score > 0}
            defaultOpen={idx === 0 && source._relevance.score > 0}
          />
        ))}
      </div>

      <Card className="border-orange-100">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-[#C84B31]">
            {onboardingStrings.hireSourcesTimeline}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b">
                  <th className="py-2 pr-4 font-medium">When</th>
                  <th className="py-2 pr-4 font-medium">Activity</th>
                  <th className="py-2 font-medium">Primary contact</th>
                </tr>
              </thead>
              <tbody>
                {RECRUITMENT_TIMELINE.map((row) => {
                  const isCurrent = isTimelineWhenActive(now, row.when);
                  return (
                    <tr
                      key={row.when}
                      className={`border-b border-orange-50 ${
                        isCurrent ? 'bg-orange-50/80' : ''
                      }`}
                    >
                      <td className="py-2 pr-4 font-medium whitespace-nowrap">
                        <span className="inline-flex items-center gap-2">
                          {row.when}
                          {isCurrent && (
                            <Badge
                              variant="outline"
                              className="text-[10px] border-[#C84B31]/40 text-[#C84B31]"
                            >
                              {onboardingStrings.hireSourcesActiveNow}
                            </Badge>
                          )}
                        </span>
                      </td>
                      <td className="py-2 pr-4">{row.activity}</td>
                      <td className="py-2 text-muted-foreground">{row.contact}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="border-orange-100">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-[#C84B31]">
            {onboardingStrings.hireSourcesPrograms}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {ACADEMIC_PROGRAMS.map((p) => (
            <div key={p.code} className="text-sm">
              <p className="font-medium">
                {p.code} — {p.name}
              </p>
              <p className="text-muted-foreground">{p.hours}</p>
              <p className="text-xs mt-0.5">{p.notes}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-orange-100">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-[#C84B31]">
            {onboardingStrings.hireSourcesAllContacts}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {RECRUITMENT_CONTACTS.map((c) => (
            <div key={c.name} className="text-sm">
              <p className="font-medium">{c.name}</p>
              <p className="text-xs text-muted-foreground">{c.role}</p>
              <div className="flex flex-wrap gap-3 mt-1">
                {c.email && (
                  <a
                    href={`mailto:${c.email}`}
                    className="inline-flex items-center gap-1 text-[#C84B31] hover:underline text-xs"
                  >
                    <Mail className="h-3 w-3" />
                    {c.email}
                  </a>
                )}
                {c.phone && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    {c.phone}
                  </span>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
