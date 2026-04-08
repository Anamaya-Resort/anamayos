'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import type { TranslationKeys } from '@/i18n/en';

interface ImportPanelProps {
  dict: TranslationKeys;
}

interface ImportResult {
  success: boolean;
  log: string[];
  errors: string[];
  errorCount: number;
  error?: string;
}

export function ImportPanel({ dict }: ImportPanelProps) {
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<ImportResult | null>(null);

  async function runImport() {
    setStatus('running');
    setResult(null);

    try {
      const res = await fetch('/api/admin/import/retreat-guru', { method: 'POST' });
      const data: ImportResult = await res.json();
      setResult(data);
      setStatus(data.success ? 'done' : 'error');
    } catch {
      setResult({ success: false, log: [], errors: ['Network error'], errorCount: 1 });
      setStatus('error');
    }
  }

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
                {dict.settings.importRunning}
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                {dict.settings.importStart}
              </>
            )}
          </Button>

          {status === 'running' && (
            <p className="text-sm text-muted-foreground">
              {dict.settings.importRunningDesc}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {result.success ? (
                <CheckCircle className="h-5 w-5 text-status-success" />
              ) : (
                <AlertCircle className="h-5 w-5 text-status-destructive" />
              )}
              {result.success ? dict.settings.importSuccess : dict.settings.importFailed}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Log */}
            <div className="rounded-md bg-muted p-3">
              <ul className="space-y-1 text-sm font-mono">
                {result.log.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>

            {/* Errors */}
            {result.errorCount > 0 && (
              <div>
                <p className="text-sm font-medium text-status-destructive mb-2">
                  {result.errorCount} {dict.settings.importErrors}
                </p>
                <div className="max-h-48 overflow-y-auto rounded-md bg-muted p-3">
                  <ul className="space-y-1 text-xs font-mono text-muted-foreground">
                    {result.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
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
