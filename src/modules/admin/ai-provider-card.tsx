'use client';

import { useCallback, useState } from 'react';
import { ChevronDown, ChevronRight, Loader2, Play, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface AiModel {
  id: string;
  name: string;
  type: 'llm' | 'image' | 'video';
  endpoint: string;
  active: boolean;
  added_at: string;
}

export interface AiProvider {
  id: string;
  display_name: string;
  models: AiModel[];
  is_connected: boolean;
  has_key: boolean;
  last_tested_at: string | null;
}

interface AiProviderCardProps {
  provider: AiProvider;
  onModelsUpdated: (providerId: string, models: AiModel[]) => void;
  onReload: () => void;
}

export function AiProviderCard({ provider, onModelsUpdated, onReload }: AiProviderCardProps) {
  const [open, setOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState(() => {
    const llms = provider.models.filter((m) => m.type === 'llm' && m.active);
    return llms[0]?.endpoint ?? '';
  });
  const [prompt, setPrompt] = useState('');
  const [output, setOutput] = useState('');
  const [testing, setTesting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);

  const llms = provider.models.filter((m) => m.type === 'llm');
  const imageModels = provider.models.filter((m) => m.type === 'image');
  const videoModels = provider.models.filter((m) => m.type === 'video');

  const handleTest = useCallback(async () => {
    if (!selectedModel || !prompt.trim()) return;
    setTesting(true);
    setOutput('');
    try {
      const res = await fetch('/api/admin/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: provider.id, model: selectedModel, prompt: prompt.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setOutput(data.result);
      } else {
        setOutput(`Error: ${data.error}`);
      }
    } catch (err) {
      setOutput(`Error: ${err instanceof Error ? err.message : 'Request failed'}`);
    } finally {
      setTesting(false);
    }
  }, [provider.id, selectedModel, prompt]);

  const handleScan = useCallback(async () => {
    setScanning(true);
    setScanResult(null);
    try {
      const res = await fetch('/api/admin/ai/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: provider.id }),
      });
      const data = await res.json();
      if (res.ok) {
        const newModels = data.newModels as AiModel[];
        if (newModels.length > 0) {
          setScanResult(`Found ${newModels.length} new model(s): ${newModels.map((m) => m.name).join(', ')}`);
          // Scan API already saved merged models to DB — reload to pick them up
          onReload();
        } else {
          setScanResult('No new models found. Registry is up to date.');
        }
      } else {
        setScanResult(`Scan failed: ${data.error}`);
      }
    } catch (err) {
      setScanResult(`Scan error: ${err instanceof Error ? err.message : 'Request failed'}`);
    } finally {
      setScanning(false);
    }
  }, [provider.id, onReload]);

  const handleRemoveModel = useCallback((modelId: string) => {
    const updated = provider.models.filter((m) => m.id !== modelId);
    onModelsUpdated(provider.id, updated);
  }, [provider.id, provider.models, onModelsUpdated]);

  const connected = provider.has_key;

  return (
    <div className="border rounded-lg bg-card">
      {/* Header — click to expand/collapse */}
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/50 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-3">
          {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          <span className="font-semibold text-sm">{provider.display_name}</span>
        </div>
        <div className="flex items-center gap-3">
          {provider.last_tested_at && (
            <span className="text-[10px] text-muted-foreground">
              Tested {new Date(provider.last_tested_at).toLocaleDateString()}
            </span>
          )}
          <span className={`inline-block h-2.5 w-2.5 rounded-full ${connected ? 'bg-green-500' : 'bg-red-400'}`} />
          <span className="text-xs text-muted-foreground">{connected ? 'Connected' : 'No API Key'}</span>
        </div>
      </button>

      {open && (
        <div className="border-t px-4 pb-4 pt-3 space-y-4">
          {/* Model lists by type */}
          {llms.length > 0 && (
            <ModelGroup label="LLMs" models={llms} onRemove={handleRemoveModel} />
          )}
          {imageModels.length > 0 && (
            <ModelGroup label="Image" models={imageModels} onRemove={handleRemoveModel} />
          )}
          {videoModels.length > 0 && (
            <ModelGroup label="Video" models={videoModels} onRemove={handleRemoveModel} />
          )}

          {/* Test prompt */}
          {connected && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Test Prompt</label>
              <div className="flex gap-2">
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="rounded border bg-background px-2 py-1.5 text-xs min-w-[160px] outline-none focus:ring-1 focus:ring-primary/50"
                >
                  {llms.filter((m) => m.active).map((m) => (
                    <option key={m.id} value={m.endpoint}>{m.name}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleTest(); }}
                  placeholder="Enter a test prompt..."
                  className="flex-1 rounded border bg-background px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary/50"
                />
                <Button size="sm" onClick={handleTest} disabled={testing || !prompt.trim()}>
                  {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                </Button>
              </div>
              {output && (
                <div className="rounded border bg-muted/50 px-3 py-2 text-xs whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {output}
                </div>
              )}
            </div>
          )}

          {/* Scan for updates */}
          {connected && (
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={handleScan} disabled={scanning}>
                {scanning ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
                Scan for Updates
              </Button>
              {scanResult && (
                <span className="text-xs text-muted-foreground">{scanResult}</span>
              )}
            </div>
          )}

          {!connected && (
            <p className="text-xs text-muted-foreground italic">
              Add the API key to environment variables to enable testing and scanning.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** A labelled group of models with remove buttons */
function ModelGroup({ label, models, onRemove }: { label: string; models: AiModel[]; onRemove: (id: string) => void }) {
  return (
    <div>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {models.map((m) => (
          <span key={m.id} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${m.active ? 'bg-background text-foreground' : 'bg-muted text-muted-foreground line-through'}`}>
            {m.name}
            <button onClick={() => onRemove(m.id)} className="text-muted-foreground hover:text-destructive transition-colors" title="Remove model">
              <Trash2 className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
