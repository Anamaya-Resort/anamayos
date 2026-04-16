import { NextResponse } from 'next/server';

/** Return a generic error to the client; log the real error server-side */
export function dbError(error: { message: string }, status = 400) {
  console.error('[DB Error]', error.message);
  return NextResponse.json(
    { error: 'Operation failed' },
    { status },
  );
}

/** Return a generic 500 for unexpected errors */
export function serverError(error: unknown) {
  console.error('[Server Error]', error instanceof Error ? error.message : error);
  return NextResponse.json(
    { error: 'Internal error' },
    { status: 500 },
  );
}

/** Return a Zod validation error (safe to show — it only describes field constraints) */
export function validationError(issues: { path: PropertyKey[]; message: string }[]) {
  const details = issues.map((i) => `${i.path.map(String).join('.')}: ${i.message}`);
  return NextResponse.json(
    { error: 'Validation failed', details },
    { status: 400 },
  );
}
