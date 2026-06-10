export interface GalleryDomainSessionUser {
  id: string;
}

export interface GalleryDomainSession {
  user: GalleryDomainSessionUser;
  role?: string;
  expiresAt?: number;
}

export interface GalleryDomainSessionClient {
  getSession(): Promise<GalleryDomainSession | null>;
  sync(accessToken: string): Promise<void>;
  clear(): Promise<void>;
}

export function createGalleryDomainSessionClient(baseUrl: string, fetcher: typeof fetch = fetch): GalleryDomainSessionClient {
  const endpoint = new URL('/api/v1/auth/session', baseUrl);

  return {
    async getSession() {
      const response = await fetcher(endpoint, { credentials: 'include' });
      if (!response.ok) {
        throw new Error('Pokokit domain session restore failed.');
      }

      let body: unknown;
      try {
        body = await response.json();
      } catch {
        throw new Error('Pokokit domain session returned invalid JSON.');
      }

      const session = parseDomainSessionEnvelope(body);
      if (session === undefined) {
        throw new Error('Pokokit domain session returned an invalid payload.');
      }

      return session;
    },
    async sync(accessToken) {
      if (!accessToken) {
        throw new Error('Supabase access token is unavailable.');
      }

      const response = await fetcher(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (!response.ok) {
        throw new Error('Pokokit domain session sync failed.');
      }
    },
    async clear() {
      const response = await fetcher(endpoint, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Pokokit domain session clear failed.');
      }
    },
  };
}

function parseDomainSessionEnvelope(value: unknown): GalleryDomainSession | null | undefined {
  if (!isRecord(value) || !isRecord(value.data)) {
    return undefined;
  }

  const user = value.data.user;
  if (user === null) {
    return null;
  }
  if (!isRecord(user) || typeof user.id !== 'string') {
    return undefined;
  }

  const session: GalleryDomainSession = {
    user: {
      id: user.id,
    },
  };
  if (typeof value.data.role === 'string') {
    session.role = value.data.role;
  }
  if (typeof value.data.expiresAt === 'number') {
    session.expiresAt = value.data.expiresAt;
  }
  return session;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
