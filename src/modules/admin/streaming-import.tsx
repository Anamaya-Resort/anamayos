'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, CheckCircle, AlertCircle, Loader2, RefreshCw } from 'lucide-react';

interface StepProgress {
  step: string;
  status: string;
  count?: string;
  detail?: string;
}

interface StreamingImportProps {
  title: string;
  description: string;
  endpoint: string;
  buttonLabel: string;
  updateButtonLabel?: string;
  runningLabel: string;
  successLabel: string;
  failedLabel: string;
  errorsLabel: string;
  icon?: React.ReactNode;
  supportsIncremental?: boolean;
}

export function StreamingImport({
  title,
  description,
  endpoint,
  buttonLabel,
  updateButtonLabel,
  runningLabel,
  successLabel,
  failedLabel,
  errorsLabel,
  icon,
  supportsIncremental,
}: StreamingImportProps) {
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [runningMode, setRunningMode] = useState<'full' | 'incremental' | null>(null);
  const [steps, setSteps] = useState<StepProgress[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  async function runImport(mode?: 'full' | 'incremental') {
    setRunningMode(mode ?? null);
    setStatus('running');
    setSteps([]);
    setErrors([]);

    try {
      const url = mode ? `${endpoint}?mode=${mode}` : endpoint;
      const res = await fetch(url, { method: 'POST' });
      if (!res.ok || !res.body) {
        setStatus('error');
        setErrors([`HTTP ${res.status}`]);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const allSteps: StepProgress[] = [];

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
              const idx = prev.findIndex((s) => s.step === update.step && s.status !== 'done');
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = update;
                return next;
              }
              return [...prev, update];
            });
            allSteps.push(update);
            if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
          } catch { /* skip */ }
        }
      }

      const lastStep = allSteps[allSteps.length - 1];
      setStatus(lastStep?.status === 'error' ? 'error' : 'done');
    } catch {
      setStatus('error');
      setErrors((prev) => [...prev, 'Network error']);
    }
  }

  const activeStep = steps.filter((s) => s.status !== 'done' && s.status !== 'error').pop();
  const completedSteps = steps.filter((s) => s.status === 'done');
  const isDone = status === 'done' || steps.some((s) => s.step === 'complete');
  const hasErrors = errors.length > 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {icon ?? <Download className="h-5 w-5" />}
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{description}</p>
          <div className="flex gap-2">
            {supportsIncremental && (
              <Button onClick={() => runImport('incremental')} disabled={status === 'running'} className="gap-2">
                {status === 'running' && runningMode === 'incremental' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {activeStep
                      ? `${activeStep.step} ${activeStep.count ?? ''}`
                      : runningLabel}
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    {updateButtonLabel ?? 'Update'}
                  </>
                )}
              </Button>
            )}
            <Button onClick={() => runImport(supportsIncremental ? 'full' : undefined)} disabled={status === 'running'}
              variant={supportsIncremental ? 'outline' : 'default'} className="gap-2">
              {status === 'running' && (runningMode === 'full' || !supportsIncremental) ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {activeStep
                    ? `${activeStep.step} ${activeStep.count ?? ''}`
                    : runningLabel}
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  {buttonLabel}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {steps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {isDone ? (
                hasErrors ? <AlertCircle className="h-5 w-5 text-status-warning" /> : <CheckCircle className="h-5 w-5 text-status-success" />
              ) : (
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              )}
              {isDone ? successLabel : runningLabel}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div ref={logRef} className="max-h-96 overflow-y-auto rounded-md bg-muted p-3 space-y-1">
              {completedSteps.map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-sm font-mono">
                  <CheckCircle className="h-3 w-3 text-status-success flex-shrink-0" />
                  <span className="font-medium">{s.step}</span>
                  <span className="text-muted-foreground">{s.count ?? s.detail ?? ''}</span>
                </div>
              ))}
              {activeStep && (
                <div className="flex items-center gap-2 text-sm font-mono">
                  <Loader2 className="h-3 w-3 animate-spin text-primary flex-shrink-0" />
                  <span className="font-medium">{activeStep.step}</span>
                  <span className="text-muted-foreground">{activeStep.count ?? ''}</span>
                </div>
              )}
            </div>

            {errors.length > 0 && (
              <div className="mt-3">
                <p className="text-sm font-medium text-status-destructive mb-2">
                  {errors.length} {errorsLabel}
                </p>
                <div className="max-h-32 overflow-y-auto rounded-md bg-muted p-3">
                  <ul className="space-y-1 text-xs font-mono text-muted-foreground">
                    {errors.slice(0, 50).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                    {errors.length > 50 && <li>... and {errors.length - 50} more</li>}
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
