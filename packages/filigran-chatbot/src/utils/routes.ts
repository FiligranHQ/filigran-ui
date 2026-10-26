import type { ApiEndpoints, BackendType } from '../types';

/** The routes of `ApiEndpoints` given as a path. */
type RouteKey = { [K in keyof ApiEndpoints]-?: NonNullable<ApiEndpoints[K]> extends string ? K : never }[keyof ApiEndpoints];

/**
 * The URL of a route the host opted into (`apiEndpoints[key]`, which has no
 * default path), or null: the host names none, or the backend has no per-path
 * routing (`singleEndpoint`, or a backend other than REST).
 */
export function optInRoute(apiBaseUrl: string, apiEndpoints: ApiEndpoints | undefined, backendType: BackendType, key: RouteKey): string | null {
  const path = apiEndpoints?.[key];
  if (backendType !== 'rest' || apiEndpoints?.singleEndpoint || typeof path !== 'string' || !path) return null;
  return `${apiBaseUrl}${path}`;
}
