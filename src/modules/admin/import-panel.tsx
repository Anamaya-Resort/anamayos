'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import type { TranslationKeys } from '@/i18n/en';

interface ImportPanelProps {
  dict: TranslationKeys;
}

interface StepProgress {
  step: string;
  status: string;
  count?: string;
  detail?: string;
}

const STEP_LABELS: Record<string, string> = {
  rooms: 'Rooms',
  lodgings: 'Lodging Types',
  teachers: 'Teachers',
  people: 'People',
  retreats: 'Retreats',
  room_blocks: 'Room Blocks',
  bookings: 'Bookings',
  leads: 'Leads',
  transactions: 'Transactions',
  complete: 'Complete',
  error: 'Error',
};

export function ImportPanel({ dict }: ImportPanelProps) {
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [steps, setSteps] = useState<StepProgress[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  async function runImport() {
    setStatus('running');
    setSteps([]);
    setErrors([]);

    try {
      const res = await fetch('/api/admin/import/retreat-guru', { method: 'POST' });

      if (!res.ok || !res.body) {
        setStatus('error');
        setErrors([`HTTP ${res.status}`]);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const update: StepProgress = JSON.parse(line);

            if (update.status === 'error' && update.detail) {
              setErrors((prev) => [...prev, `${update.step}: ${update.detail}`]);
            }

            setSteps((prev) => {
              // Replace existing step entry or add new one
              const idx = prev.findIndex(
                (s) => s.step === update.step && s.status !== 'done',
              );
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = update;
                return next;
              }
              return [...prev, update];
            });

            // Auto-scroll log
            if (logRef.current) {
              logRef.current.scrollTop = logRef.current.scrollHeight;
            }
          } catch {
            // Skip malformed lines
          }
        }
      }

      const lastStep = steps.length > 0 ? steps[steps.length - 1] : null;
      setStatus(lastStep?.step === 'error' ? 'error' : 'done');
    } catch {
      setStatus('error');
      setErrors((prev) => [...prev, 'Network error']);
    }
  }

  // Derive current active step
  const activeStep = steps.filter((s) => s.status !== 'done' && s.status !== 'error').pop();
  const completedSteps = steps.filter((s) => s.status === 'done');
  const isDone = status === 'done' || steps.some((s) => s.step === 'complete');
  const hasErrors = errors.length > 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            {dict.settings.importRG}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {dict.settings.importRGDesc}
          </p>

          <Button
            onClick={runImport}
            disabled={status === 'running'}
            className="gap-2"
          >
            {status === 'running' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {activeStep
                  ? `${STEP_LABELS[activeStep.step] ?? activeStep.step} ${activeStep.count ?? ''}`
                  : dict.settings.importRunning}
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                {dict.settings.importStart}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Live progress */}
      {steps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {isDone ? (
                hasErrors ? (
                  <AlertCircle className="h-5 w-5 text-status-warning" />
                ) : (
                  <CheckCircle className="h-5 w-5 text-status-success" />
                )
              ) : (
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              )}
              {isDone ? dict.settings.importSuccess : dict.settings.importRunning}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div ref={logRef} className="max-h-96 overflow-y-auto rounded-md bg-muted p-3 space-y-1">
              {completedSteps.map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-sm font-mono">
                  <CheckCircle className="h-3 w-3 text-status-success flex-shrink-0" />
                  <span className="font-medium">{STEP_LABELS[s.step] ?? s.step}</span>
                  <span className="text-muted-foreground">{s.count ?? s.detail ?? ''}</span>
                </div>
              ))}
              {activeStep && (
                <div className="flex items-center gap-2 text-sm font-mono">
                  <Loader2 className="h-3 w-3 animate-spin text-primary flex-shrink-0" />
                  <span className="font-medium">{STEP_LABELS[activeStep.step] ?? activeStep.step}</span>
                  <span className="text-muted-foreground">{activeStep.count ?? ''}</span>
                </div>
              )}
            </div>

            {errors.length > 0 && (
              <div className="mt-3">
                <p className="text-sm font-medium text-status-destructive mb-2">
                  {errors.length} {dict.settings.importErrors}
                </p>
                <div className="max-h-32 overflow-y-auto rounded-md bg-muted p-3">
                  <ul className="space-y-1 text-xs font-mono text-muted-foreground">
                    {errors.slice(0, 50).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                    {errors.length > 50 && (
                      <li>... and {errors.length - 50} more</li>
                    )}
                  </ul>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
