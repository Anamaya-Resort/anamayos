import { SSOCallbackHandler } from '@/modules/auth/sso-callback';

export const metadata = { title: 'Signing in...' };

export default function CallbackPage() {
  return <SSOCallbackHandler />;
}
