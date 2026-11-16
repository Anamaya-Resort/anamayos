// Server-only entry point (the barrel in index.ts is safe for the browser).
export { search, searchSchema, getConfig, crToday, SEARCH_CACHE_SECONDS } from './search';
export { BlockedError } from './zenith';
