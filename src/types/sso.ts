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
  /** The person's editable full name (persons.full_name), preferred
   *  over the frozen SSO display_name for display. */
  displayName: string;
  /** Display name of the highest-access-level active role. */
  topRole: string;
  accessLevel: number;
  roleSlugs: string[];
  locale: string;
  expiresAt: number;
}
