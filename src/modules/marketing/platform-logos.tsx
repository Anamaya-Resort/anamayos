/**
 * Third-party brand marks for the platform tabs.
 *
 * These are the only hard-coded colours in this module, and deliberately
 * so: they are other companies' trademarks, not our theme. Everything
 * else in the dashboard reads from the design tokens in globals.css.
 */

const SIZE = 'h-4 w-4 shrink-0';

function Instagram() {
  const id = 'onix-ig-gradient';
  return (
    <svg viewBox="0 0 24 24" className={SIZE} aria-hidden="true">
      <defs>
        <radialGradient id={id} cx="30%" cy="107%" r="150%">
          <stop offset="0%" stopColor="#FDF497" />
          <stop offset="25%" stopColor="#FD5949" />
          <stop offset="60%" stopColor="#D6249F" />
          <stop offset="100%" stopColor="#285AEB" />
        </radialGradient>
      </defs>
      <rect x="2" y="2" width="20" height="20" rx="6" fill={`url(#${id})`} />
      <rect x="6" y="6" width="12" height="12" rx="4" fill="none" stroke="#fff" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="3" fill="none" stroke="#fff" strokeWidth="1.6" />
      <circle cx="17" cy="7" r="1.1" fill="#fff" />
    </svg>
  );
}

function Facebook() {
  return (
    <svg viewBox="0 0 24 24" className={SIZE} aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#1877F2" />
      <path
        d="M15.1 12.5h-2v6.4h-2.7v-6.4H9V10.2h1.4V8.8c0-1.9 1-2.9 3-2.9h2v2.3h-1.3c-.6 0-.9.3-.9.9v1.1h2.2l-.3 2.3Z"
        fill="#fff"
      />
    </svg>
  );
}

function TikTok() {
  return (
    <svg viewBox="0 0 24 24" className={SIZE} aria-hidden="true">
      <path d="M16.6 2h-2.8v13.1a2.5 2.5 0 1 1-2.1-2.5v-2.8a5.3 5.3 0 1 0 4.9 5.3V8.6a6.4 6.4 0 0 0 3.6 1.1V6.9a3.6 3.6 0 0 1-3.6-3.6V2Z" fill="#25F4EE" transform="translate(-1.1 .9)" />
      <path d="M16.6 2h-2.8v13.1a2.5 2.5 0 1 1-2.1-2.5v-2.8a5.3 5.3 0 1 0 4.9 5.3V8.6a6.4 6.4 0 0 0 3.6 1.1V6.9a3.6 3.6 0 0 1-3.6-3.6V2Z" fill="#FE2C55" transform="translate(.6 -.4)" />
      <path d="M16.6 2h-2.8v13.1a2.5 2.5 0 1 1-2.1-2.5v-2.8a5.3 5.3 0 1 0 4.9 5.3V8.6a6.4 6.4 0 0 0 3.6 1.1V6.9a3.6 3.6 0 0 1-3.6-3.6V2Z" fill="#111" />
    </svg>
  );
}

function GoogleAds() {
  return (
    <svg viewBox="0 0 24 24" className={SIZE} aria-hidden="true">
      <path d="M2.9 16.4 9.1 5.7a3 3 0 0 1 5.2 3L8.1 19.4a3 3 0 0 1-5.2-3Z" fill="#FBBC04" />
      <path d="M21.1 16.4 14.9 5.7a3 3 0 0 0-5.2 3l6.2 10.7a3 3 0 0 0 5.2-3Z" fill="#4285F4" />
      <circle cx="5.5" cy="17.9" r="3" fill="#34A853" />
    </svg>
  );
}

const MAP: Record<string, () => React.ReactElement> = {
  instagram: Instagram,
  facebook: Facebook,
  tiktok: TikTok,
  google: GoogleAds,
};

export function PlatformLogo({ slug }: { slug: string | null }) {
  const Mark = slug ? MAP[slug] : undefined;
  if (!Mark) return <span className={`${SIZE} rounded-full bg-muted`} aria-hidden="true" />;
  return <Mark />;
}
