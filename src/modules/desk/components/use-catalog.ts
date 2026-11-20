'use client';

import { useCallback, useRef } from 'react';
import type { DeskCatalog } from '../types';
import { deskApi } from './api';

/** Catalog per date (prices follow scheduled changes), fetched once per day. */
export function useCatalogCache() {
  const cache = useRef(new Map<string, Promise<DeskCatalog>>());
  return useCallback((date: string) => {
    let p = cache.current.get(date);
    if (!p) {
      p = deskApi.catalog(date);
      p.catch(() => cache.current.delete(date));
      cache.current.set(date, p);
    }
    return p;
  }, []);
}
