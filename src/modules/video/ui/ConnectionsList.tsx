import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { CircleCheck, CircleAlert, Plus } from 'lucide-react';
import type { DriveConnection } from '@/modules/video/drive/connections';
import type { TranslationKeys } from '@/i18n/en';
import { formatDate } from '@/lib/format-date';
import type { Locale } from '@/config/app';
import { AddFolderButton } from './AddFolderButton';

type Props = {
  connections: DriveConnection[];
  dict: TranslationKeys;
  locale: Locale;
  oauthState?: string;
  oauthMsg?: string;
};

export function ConnectionsList({ connections, dict, locale, oauthState, oauthMsg }: Props) {
  const banner = oauthState ? renderBanner(oauthState, oauthMsg, dict) : null;

  return (
    <div className="space-y-4">
      {banner}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{dict.video.connections.title}</h2>
          <p className="text-sm text-muted-foreground">{dict.video.connections.subtitle}</p>
        </div>
        <Link href="/api/video/oauth/google/start">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            {dict.video.connections.connectGoogle}
          </Button>
        </Link>
      </div>

      {connections.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-sm text-muted-foreground">{dict.video.connections.empty}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {connections.map((c) => (
            <Card key={c.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base">
                  <span>{c.google_account_email}</span>
                  <StatusBadge status={c.status} dict={dict} />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <div>
                  {dict.video.connections.addedAt}: {formatDate(c.created_at, locale)}
                </div>
                {c.last_error && (
                  <div className="text-destructive">{c.last_error}</div>
                )}
                {c.status === 'active' && (
                  <div className="flex justify-end">
                    <AddFolderButton connectionId={c.id} accountEmail={c.google_account_email} />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status, dict }: { status: string; dict: TranslationKeys }) {
  if (status === 'active') {
    return (
      <Badge className="bg-success/15 text-success">
        <CircleCheck className="mr-1 h-3 w-3" />
        {dict.video.connections.statusActive}
      </Badge>
    );
  }
  return (
    <Badge variant="destructive">
      <CircleAlert className="mr-1 h-3 w-3" />
      {status}
    </Badge>
  );
}

function renderBanner(state: string, msg: string | undefined, dict: TranslationKeys) {
  const variants: Record<string, { tone: string; text: string }> = {
    connected: { tone: 'bg-success/10 text-success border-success/30', text: dict.video.connections.bannerConnected },
    denied: { tone: 'bg-warning/10 text-warning border-warning/30', text: dict.video.connections.bannerDenied },
    error: { tone: 'bg-destructive/10 text-destructive border-destructive/30', text: msg ?? dict.video.connections.bannerError },
  };
  const v = variants[state];
  if (!v) return null;
  return (
    <div className={`rounded-md border px-4 py-2 text-sm ${v.tone}`}>{v.text}</div>
  );
}
