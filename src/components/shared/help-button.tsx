'use client';

import { useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

/**
 * The circled "?" that carries a panel's explanation.
 *
 * The rule this exists to serve: a screen holds numbers and controls,
 * never paragraphs of grey prose explaining them. Anything that would
 * have been a description line or a footnote goes in here instead, where
 * it is available to anyone who wants it and invisible to everyone who
 * does not.
 *
 * A modal rather than a hover tooltip, deliberately. The explanations are
 * several sentences long and often matter (what a metric excludes, why a
 * panel is empty, which window it covers); a floating tooltip that
 * vanishes on mouse-out cannot hold that, cannot be read on a phone, and
 * cannot be re-read while looking at the chart. Hover text is for a word,
 * a modal is for a paragraph.
 *
 * Body text is one string with blank lines between paragraphs, so every
 * entry lives as a single translatable value in the dictionary.
 */
export function HelpButton({
  title, body, ariaLabel, className,
}: {
  /** The modal heading. Normally the panel's own title. */
  title: string;
  /** Paragraphs, separated by a blank line. */
  body: string;
  /** Spoken name of the button. Falls back to "About <title>". */
  ariaLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const paragraphs = body.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={ariaLabel ?? `About ${title}`}
        className={cn(
          'inline-flex size-5 shrink-0 items-center justify-center rounded-full',
          'border border-border bg-card text-xs font-semibold leading-none',
          'text-muted-foreground transition-colors',
          'hover:border-primary hover:bg-muted hover:text-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          className,
        )}
      >
        ?
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="pr-8 text-base leading-snug">{title}</DialogTitle>
            <DialogDescription
              render={<div />}
              className="space-y-3 text-sm leading-relaxed text-muted-foreground"
            >
              {paragraphs.map((text, i) => (
                <p key={i}>{text}</p>
              ))}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  );
}
