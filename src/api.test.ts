import { describe, expect, it, vi } from 'vitest';

import { createSceneApiClient, type SceneRecord } from './api';
import { buildEditorSceneUrl, loadGalleryConfig } from './config';
import { summarizeScenePse } from './scene-summary';

describe('gallery config', () => {
  it('uses production Pokokit service defaults when scene urls are not configured', () => {
    const config = loadGalleryConfig({} as ImportMetaEnv);

    expect(config.sceneApiUrl).toBe('https://scene-api.pokokit.com/');
    expect(config.sceneEditorUrl).toBe('https://scene-editor.pokokit.com/');
  });

  it('normalizes base urls and disables placeholder Supabase auth values', () => {
    const config = loadGalleryConfig({
      VITE_SCENE_API_URL: 'https://api.example.com',
      VITE_SCENE_EDITOR_URL: 'https://editor.example.com/editor',
      VITE_SUPABASE_URL: 'https://replace-with-project-ref.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'replace-with-supabase-publishable-key',
    } as unknown as ImportMetaEnv);

    expect(config.sceneApiUrl).toBe('https://api.example.com/');
    expect(config.sceneEditorUrl).toBe('https://editor.example.com/editor');
    expect(config.supabaseUrl).toBeNull();
    expect(config.supabasePublishableKey).toBeNull();
  });

  it('builds editor scene links with scene_id', () => {
    expect(buildEditorSceneUrl('https://editor.example.com/app', 'scene-1')).toBe('https://editor.example.com/app?scene_id=scene-1');
  });
});

describe('scene api client', () => {
  it('loads public scenes through the v1 public endpoint', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [sceneFixture('public-scene')],
          page: pageFixture(1),
        }),
        { status: 200 },
      ),
    );

    const client = createSceneApiClient('https://api.example.com', fetcher);
    const result = await client.listPublicScenes(0);

    expect(fetcher).toHaveBeenCalledWith(new URL('https://api.example.com/api/v1/scenes/public?offset=0&limit=12'), {});
    expect(result).toMatchObject({
      ok: true,
      data: {
        data: [
          {
            id: 'public-scene',
          },
        ],
      },
    });
  });

  it('sends public scene pokemon filters to the API', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [sceneFixture('filtered-scene')],
          page: pageFixture(1),
        }),
        { status: 200 },
      ),
    );

    const client = createSceneApiClient('https://api.example.com', fetcher);
    await client.listPublicScenes(12, { pokemon: 'combusken' });

    expect(fetcher).toHaveBeenCalledWith(new URL('https://api.example.com/api/v1/scenes/public?offset=12&limit=12&pokemon=combusken'), {});
  });

  it('loads my scenes with bearer auth', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [sceneFixture('owned-scene')],
          page: pageFixture(1),
        }),
        { status: 200 },
      ),
    );

    const client = createSceneApiClient('https://api.example.com', fetcher);
    await client.listMyScenes({ kind: 'bearer', token: 'user-token' }, 12);

    expect(fetcher).toHaveBeenCalledWith(new URL('https://api.example.com/api/v1/scenes?offset=12&limit=12'), {
      headers: {
        Authorization: 'Bearer user-token',
      },
    });
  });

  it('updates an owned scene visibility with bearer auth', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: sceneFixture('owned-scene', { visibility: 'public' }),
        }),
        { status: 200 },
      ),
    );

    const client = createSceneApiClient('https://api.example.com', fetcher);
    const result = await client.updateSceneVisibility({ kind: 'bearer', token: 'user-token' }, 'owned-scene', 'public');

    expect(fetcher).toHaveBeenCalledWith(new URL('https://api.example.com/api/v1/scenes/owned-scene'), {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer user-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ visibility: 'public' }),
    });
    expect(result).toMatchObject({
      ok: true,
      data: {
        id: 'owned-scene',
        visibility: 'public',
      },
    });
  });

  it('loads my scenes with the domain session cookie', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [sceneFixture('owned-cookie-scene')],
          page: pageFixture(1),
        }),
        { status: 200 },
      ),
    );

    const client = createSceneApiClient('https://api.example.com', fetcher);
    await client.listMyScenes({ kind: 'domain-session' }, 0);

    expect(fetcher).toHaveBeenCalledWith(new URL('https://api.example.com/api/v1/scenes?offset=0&limit=12'), {
      credentials: 'include',
      headers: {},
    });
  });

  it('updates an owned scene visibility with the domain session cookie', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: sceneFixture('owned-cookie-scene', { visibility: 'private' }),
        }),
        { status: 200 },
      ),
    );

    const client = createSceneApiClient('https://api.example.com', fetcher);
    await client.updateSceneVisibility({ kind: 'domain-session' }, 'owned-cookie-scene', 'private');

    expect(fetcher).toHaveBeenCalledWith(new URL('https://api.example.com/api/v1/scenes/owned-cookie-scene'), {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ visibility: 'private' }),
    });
  });

  it('returns API errors from the scene envelope', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'auth_missing_token', message: 'Missing token.' } }), { status: 401 }),
    );

    const client = createSceneApiClient('https://api.example.com', fetcher);
    const result = await client.listMyScenes({ kind: 'bearer', token: 'bad-token' }, 1);

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'auth_missing_token',
        message: 'Missing token.',
      },
    });
  });
});

describe('scene summary', () => {
  it('summarizes PSE2 full canvas length, width, and building height', () => {
    expect(summarizeScenePse('PSE2~E.C.1~Name.0.0._._~0.1%E5%B1%82;1.2%E5%B1%82;2.3%E5%B1%82~_~_')).toEqual({
      length: 16,
      width: 14,
      height: 3,
    });
  });

  it('summarizes legacy PSE1 scenes as 7x7 full canvas with encoded building levels', () => {
    expect(summarizeScenePse('PSE1~Legacy.0.0._._~0.1%E5%B1%82;1.2%E5%B1%82~_~_')).toEqual({
      length: 7,
      width: 7,
      height: 2,
    });
  });

  it('returns null for malformed scene strings', () => {
    expect(summarizeScenePse('PSE2-test')).toBeNull();
  });
});

function sceneFixture(id: string, overrides: Partial<SceneRecord> = {}): SceneRecord {
  return {
    id,
    owner_user_id: 'user-1',
    name: 'Test scene',
    pse: 'PSE2-test',
    pokemon: 'pikachu',
    visibility: 'public',
    author: null,
    author_nickname: 'pixelpanda',
    created_at: '2026-06-08T00:00:00.000Z',
    updated_at: '2026-06-08T00:00:00.000Z',
    ...overrides,
  };
}

function pageFixture(page: number) {
  const pageSize = 12;
  const offset = (page - 1) * pageSize;
  return {
    page,
    pageSize,
    total: 1,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
    offset,
    limit: pageSize,
    nextOffset: null,
    previousOffset: null,
  };
}
