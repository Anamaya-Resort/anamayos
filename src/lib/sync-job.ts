import { SupabaseClient } from '@supabase/supabase-js';

interface StepData {
  step: string;
  status: string;
  detail?: string;
  count?: string;
}

/**
 * Manages a sync job row in the DB for persistent import tracking.
 * Writes progress to the DB so the UI can poll even after navigating away.
 */
export class SyncJob {
  private jobId: string | null = null;
  private steps: StepData[] = [];
  private errors: string[] = [];
  private supabase: SupabaseClient;
  private source: string;
  private mode: string;
  private updateTimer: ReturnType<typeof setTimeout> | null = null;
  private dirty = false;

  constructor(supabase: SupabaseClient, source: string, mode: string) {
    this.supabase = supabase;
    this.source = source;
    this.mode = mode;
  }

  /** Create the job row. Must be called before send/sendError. */
  async create(): Promise<string> {
    const { data } = await this.supabase
      .from('sync_jobs')
      .insert({ source: this.source, mode: this.mode, status: 'running', steps: [], errors: [] })
      .select('id')
      .single();
    this.jobId = data?.id ?? null;

    // Batch DB writes every 2 seconds to avoid hammering
    this.updateTimer = setInterval(() => this.flush(), 2000);

    return this.jobId!;
  }

  /** Record a step update. */
  send(data: StepData) {
    // Update existing step or add new one
    const idx = this.steps.findIndex((s) => s.step === data.step && s.status !== 'done');
    if (idx >= 0) {
      this.steps[idx] = data;
    } else {
      this.steps.push(data);
    }
    this.dirty = true;
  }

  /** Record an error. */
  sendError(step: string, msg: string) {
    if (this.errors.length < 200) {
      this.errors.push(`${step}: ${msg}`);
    }
    this.send({ step, status: 'error', detail: msg });
  }

  /** Flush current state to DB. */
  private async flush() {
    if (!this.jobId || !this.dirty) return;
    this.dirty = false;
    await this.supabase
      .from('sync_jobs')
      .update({ steps: this.steps, errors: this.errors })
      .eq('id', this.jobId);
  }

  /** Mark job as complete. Flushes final state. */
  async complete() {
    if (this.updateTimer) clearInterval(this.updateTimer);
    if (!this.jobId) return;
    await this.supabase
      .from('sync_jobs')
      .update({
        status: 'done',
        steps: this.steps,
        errors: this.errors,
        completed_at: new Date().toISOString(),
      })
      .eq('id', this.jobId);
  }

  /** Mark job as errored. Flushes final state. */
  async fail(detail: string) {
    if (this.updateTimer) clearInterval(this.updateTimer);
    this.send({ step: 'error', status: 'error', detail });
    if (!this.jobId) return;
    await this.supabase
      .from('sync_jobs')
      .update({
        status: 'error',
        steps: this.steps,
        errors: this.errors,
        completed_at: new Date().toISOString(),
      })
      .eq('id', this.jobId);
  }
}
