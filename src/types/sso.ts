/** User profile returned by the LightningWorks SSO /api/verify endpoint */
export interface SSOUser {
  id: string;
  email: string;
  username: string;
  display_name: string;
  role: 'user' | 'admin' | 'superadmin';
  avatar_url: string | null;
  created_at: string;
  last_sign_in: string;
}

/** SSO verify success response */
export interface SSOVerifySuccess {
  valid: true;
  user: SSOUser;
}

/** SSO verify error response */
export interface SSOVerifyError {
  error: string;
}

export type SSOVerifyResponse = SSOVerifySuccess | SSOVerifyError;

/** Session data stored in the cookie */
export interface SessionData {
  user: SSOUser;
  personId: string;
  accessLevel: number;
  roleSlugs: string[];
  expiresAt: number;
}
