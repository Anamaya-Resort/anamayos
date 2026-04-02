/** Auth route group — no sidebar, no auth provider needed */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
