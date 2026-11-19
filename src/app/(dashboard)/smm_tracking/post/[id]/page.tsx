import { redirect } from 'next/navigation';
import { getDictionary } from '@/i18n';
import { getSession, getSessionLocale } from '@/lib/session';
import { ACCESS_LEVELS } from '@/types';
import type { Locale } from '@/config/app';
import { DASH_PATH } from '@/modules/marketing';
import { PostDetailView, getPostDetail, socialLabels, tx } from '@/modules/social';

export const metadata = { title: 'Post detail — AO Platform' };
export const dynamic = 'force-dynamic';

/**
 * One post's own page.
 *
 * Guarded here as well as in middleware, like the dashboard it belongs
 * to: everything below reads through the service-role client, so this
 * must never render without a session even if the matcher is loosened.
 */
export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login?next=/smm_tracking');
  if ((session.accessLevel ?? 0) < ACCESS_LEVELS.manager) redirect('/dashboard');

  const { id } = await params;
  const locale = (await getSessionLocale()) as Locale;
  const dict = getDictionary(locale);
  const labels = socialLabels(dict);

  const post = await getPostDetail(id);
  const backHref = `${DASH_PATH}?view=content`;

  if (!post) {
    return (
      <div className="w-full space-y-4 pb-24">
        <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          {tx(labels.detail, 'notFound')}
        </div>
      </div>
    );
  }

  return (
    <PostDetailView post={post} labels={labels} locale={locale} backHref={backHref} />
  );
}
