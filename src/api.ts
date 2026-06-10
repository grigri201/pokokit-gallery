export type SceneVisibility = 'public' | 'private';

export interface SceneRecord {
  id: string;
  owner_user_id: string;
  name: string;
  pse: string;
  pokemon: string;
  visibility: SceneVisibility;
  author?: string | null;
  author_nickname?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PageInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  offset: number;
  limit: number;
  nextOffset: number | null;
  previousOffset: number | null;
}

export interface SceneListResult {
  data: SceneRecord[];
  page: PageInfo;
}

export interface PublicSceneFilters {
  pokemon?: string;
}

export interface ApiError {
  code: string;
  message: string;
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };
export type SceneApiAuth = { kind: 'bearer'; token: string } | { kind: 'domain-session' };

export interface SceneApiClient {
  listPublicScenes(offset: number, filters?: PublicSceneFilters): Promise<ApiResult<SceneListResult>>;
  listMyScenes(auth: SceneApiAuth, offset: number): Promise<ApiResult<SceneListResult>>;
  updateSceneVisibility(auth: SceneApiAuth, sceneId: string, visibility: SceneVisibility): Promise<ApiResult<SceneRecord>>;
}

const galleryPageSize = 12;

export function createSceneApiClient(baseUrl: string, fetcher: typeof fetch = fetch): SceneApiClient {
  return {
    listPublicScenes(offset: number, filters: PublicSceneFilters = {}) {
      const url = new URL('/api/v1/scenes/public', baseUrl);
      url.searchParams.set('offset', String(offset));
      url.searchParams.set('limit', String(galleryPageSize));
      const pokemon = filters.pokemon?.trim();
      if (pokemon) {
        url.searchParams.set('pokemon', pokemon);
      }
      return fetchSceneList(fetcher, url);
    },
    listMyScenes(auth: SceneApiAuth, offset: number) {
      return fetchSceneList(fetcher, new URL(`/api/v1/scenes?offset=${offset}&limit=${galleryPageSize}`, baseUrl), auth);
    },
    updateSceneVisibility(auth: SceneApiAuth, sceneId: string, visibility: SceneVisibility) {
      return updateSceneRecord(fetcher, new URL(`/api/v1/scenes/${encodeURIComponent(sceneId)}`, baseUrl), auth, {
        visibility,
      });
    },
  };
}

async function fetchSceneList(fetcher: typeof fetch, url: URL, auth?: SceneApiAuth): Promise<ApiResult<SceneListResult>> {
  let response: Response;
  try {
    const init: RequestInit = auth ? createAuthRequestInit(auth) : {};
    response = await fetcher(url, init);
  } catch {
    return {
      ok: false,
      error: {
        code: 'network_error',
        message: 'Scene API is unavailable.',
      },
    };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return {
      ok: false,
      error: {
        code: 'invalid_response',
        message: 'Scene API returned invalid JSON.',
      },
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      error: readApiError(body),
    };
  }

  const page = parseSceneList(body);
  if (!page) {
    return {
      ok: false,
      error: {
        code: 'invalid_response',
        message: 'Scene API returned an invalid scene list.',
      },
    };
  }

  return {
    ok: true,
    data: page,
  };
}

async function updateSceneRecord(
  fetcher: typeof fetch,
  url: URL,
  auth: SceneApiAuth,
  body: Partial<Pick<SceneRecord, 'visibility'>>,
): Promise<ApiResult<SceneRecord>> {
  let response: Response;
  try {
    response = await fetcher(url, {
      method: 'PUT',
      ...createAuthRequestInit(auth, { 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    });
  } catch {
    return {
      ok: false,
      error: {
        code: 'network_error',
        message: 'Scene API is unavailable.',
      },
    };
  }

  let parsedBody: unknown;
  try {
    parsedBody = await response.json();
  } catch {
    return {
      ok: false,
      error: {
        code: 'invalid_response',
        message: 'Scene API returned invalid JSON.',
      },
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      error: readApiError(parsedBody),
    };
  }

  const record = parseSceneRecordEnvelope(parsedBody);
  if (!record) {
    return {
      ok: false,
      error: {
        code: 'invalid_response',
        message: 'Scene API returned an invalid scene record.',
      },
    };
  }

  return {
    ok: true,
    data: record,
  };
}

function createAuthRequestInit(auth: SceneApiAuth, headers: Record<string, string> = {}): RequestInit {
  if (auth.kind === 'bearer') {
    return {
      headers: {
        ...headers,
        Authorization: `Bearer ${auth.token}`,
      },
    };
  }

  return {
    credentials: 'include',
    headers,
  };
}

function parseSceneList(value: unknown): SceneListResult | null {
  if (!isRecord(value) || !Array.isArray(value.data)) {
    return null;
  }
  if (!value.data.every(isSceneRecord)) {
    return null;
  }
  const page = parsePageInfo(value.page);
  if (!page) {
    return null;
  }
  return {
    data: value.data,
    page,
  };
}

function parseSceneRecordEnvelope(value: unknown): SceneRecord | null {
  if (!isRecord(value) || !isSceneRecord(value.data)) {
    return null;
  }
  return value.data;
}

function isSceneRecord(value: unknown): value is SceneRecord {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.id === 'string' &&
    typeof value.owner_user_id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.pse === 'string' &&
    typeof value.pokemon === 'string' &&
    (value.visibility === 'public' || value.visibility === 'private') &&
    (value.author === undefined || value.author === null || typeof value.author === 'string') &&
    (value.author_nickname === undefined || value.author_nickname === null || typeof value.author_nickname === 'string') &&
    typeof value.created_at === 'string' &&
    typeof value.updated_at === 'string'
  );
}

function parsePageInfo(value: unknown): PageInfo | null {
  if (!isRecord(value)) {
    return null;
  }
  if (
    typeof value.page !== 'number' ||
    typeof value.pageSize !== 'number' ||
    typeof value.total !== 'number' ||
    typeof value.totalPages !== 'number' ||
    typeof value.hasNextPage !== 'boolean' ||
    typeof value.hasPreviousPage !== 'boolean'
  ) {
    return null;
  }
  const offset = typeof value.offset === 'number' ? value.offset : Math.max(0, (value.page - 1) * value.pageSize);
  const limit = typeof value.limit === 'number' ? value.limit : value.pageSize;
  return {
    page: value.page,
    pageSize: value.pageSize,
    total: value.total,
    totalPages: value.totalPages,
    hasNextPage: value.hasNextPage,
    hasPreviousPage: value.hasPreviousPage,
    offset,
    limit,
    nextOffset: typeof value.nextOffset === 'number' ? value.nextOffset : value.hasNextPage ? offset + limit : null,
    previousOffset: typeof value.previousOffset === 'number' ? value.previousOffset : value.hasPreviousPage ? Math.max(0, offset - limit) : null,
  };
}

function readApiError(value: unknown): ApiError {
  if (isRecord(value) && isRecord(value.error) && typeof value.error.code === 'string' && typeof value.error.message === 'string') {
    return {
      code: value.error.code,
      message: value.error.message,
    };
  }
  return {
    code: 'api_error',
    message: 'Scene API request failed.',
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
