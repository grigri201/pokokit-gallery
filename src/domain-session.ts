export interface GalleryDomainSessionUser {
  id: string;
  nickname?: string | null;
  is_vip: boolean;
}

export interface GalleryDomainSession {
  user: GalleryDomainSessionUser;
  role?: string;
  expiresAt?: number;
}

export interface GalleryDomainSessionClient {
  getSession(): Promise<GalleryDomainSession | null>;
  getProfile(accessToken?: string | null): Promise<GalleryDomainSession>;
  sync(accessToken: string): Promise<void>;
  updateProfile(nickname: string, accessToken?: string | null): Promise<GalleryDomainSession>;
  clear(): Promise<void>;
}

export function createGalleryDomainSessionClient(baseUrl: string, fetcher: typeof fetch = fetch): GalleryDomainSessionClient {
  const endpoint = new URL('/api/v1/auth/session', baseUrl);
  const profileEndpoint = new URL('/api/v1/auth/profile', baseUrl);

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
    async getProfile(accessToken) {
      const response = await fetcher(profileEndpoint, createProfileRequestInit(accessToken));
      if (!response.ok) {
        throw new Error('Pokokit profile restore failed.');
      }

      let body: unknown;
      try {
        body = await response.json();
      } catch {
        throw new Error('Pokokit profile returned invalid JSON.');
      }

      const profile = parseDomainSessionEnvelope(body);
      if (!profile) {
        throw new Error('Pokokit profile returned an invalid payload.');
      }

      return profile;
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
    async updateProfile(nickname, accessToken) {
      const response = await fetcher(profileEndpoint, {
        ...createProfileRequestInit(accessToken),
        method: 'PATCH',
        headers: {
          ...createProfileRequestHeaders(accessToken),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ nickname }),
      });
      if (!response.ok) {
        throw new Error('Pokokit profile update failed.');
      }

      let body: unknown;
      try {
        body = await response.json();
      } catch {
        throw new Error('Pokokit profile returned invalid JSON.');
      }

      const profile = parseDomainSessionEnvelope(body);
      if (!profile) {
        throw new Error('Pokokit profile returned an invalid payload.');
      }

      return profile;
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

function createProfileRequestInit(accessToken: string | null | undefined): RequestInit {
  return accessToken
    ? { headers: createProfileRequestHeaders(accessToken) }
    : { credentials: 'include' };
}

function createProfileRequestHeaders(accessToken: string | null | undefined): Record<string, string> {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
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
      nickname: typeof user.nickname === 'string' ? user.nickname : null,
      is_vip: typeof user.is_vip === 'boolean' ? user.is_vip : false,
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
