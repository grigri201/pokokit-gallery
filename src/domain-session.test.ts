import { describe, expect, it, vi } from 'vitest';

import { createGalleryDomainSessionClient } from './domain-session';

describe('gallery domain session client', () => {
  it('restores a user from the shared domain session cookie', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ data: { user: { id: 'user-1' }, expiresAt: 1780000000 } }), { status: 200 }),
    );
    const client = createGalleryDomainSessionClient('https://scene-api.example.com', fetcher);

    await expect(client.getSession()).resolves.toEqual({
      user: { id: 'user-1', nickname: null, is_vip: false },
      expiresAt: 1780000000,
    });
    expect(fetcher).toHaveBeenCalledWith(new URL('https://scene-api.example.com/api/v1/auth/session'), {
      credentials: 'include',
    });
  });

  it('treats a missing domain session as signed out', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ data: { user: null } }), { status: 200 }),
    );
    const client = createGalleryDomainSessionClient('https://scene-api.example.com', fetcher);

    await expect(client.getSession()).resolves.toBeNull();
  });

  it('syncs a Supabase access token into the shared domain session cookie', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ data: { user: { id: 'user-1' } } }), { status: 200 }),
    );
    const client = createGalleryDomainSessionClient('https://scene-api.example.com', fetcher);

    await client.sync('supabase-token');

    expect(fetcher).toHaveBeenCalledWith(new URL('https://scene-api.example.com/api/v1/auth/session'), {
      method: 'POST',
      credentials: 'include',
      headers: {
        Authorization: 'Bearer supabase-token',
      },
    });
  });

  it('restores profile details with a Supabase bearer token', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ data: { user: { id: 'user-1', nickname: 'Pixel Panda', is_vip: true } } }), { status: 200 }),
    );
    const client = createGalleryDomainSessionClient('https://scene-api.example.com', fetcher);

    await expect(client.getProfile('supabase-token')).resolves.toEqual({
      user: { id: 'user-1', nickname: 'Pixel Panda', is_vip: true },
    });
    expect(fetcher).toHaveBeenCalledWith(new URL('https://scene-api.example.com/api/v1/auth/profile'), {
      headers: {
        Authorization: 'Bearer supabase-token',
      },
    });
  });

  it('updates profile nickname with the shared domain session cookie', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ data: { user: { id: 'user-1', nickname: 'New Panda' } } }), { status: 200 }),
    );
    const client = createGalleryDomainSessionClient('https://scene-api.example.com', fetcher);

    await expect(client.updateProfile('New Panda')).resolves.toEqual({
      user: { id: 'user-1', nickname: 'New Panda', is_vip: false },
    });
    expect(fetcher).toHaveBeenCalledWith(new URL('https://scene-api.example.com/api/v1/auth/profile'), {
      credentials: 'include',
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ nickname: 'New Panda' }),
    });
  });

  it('clears the shared domain session cookie', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ data: { signedOut: true } }), { status: 200 }),
    );
    const client = createGalleryDomainSessionClient('https://scene-api.example.com', fetcher);

    await client.clear();

    expect(fetcher).toHaveBeenCalledWith(new URL('https://scene-api.example.com/api/v1/auth/session'), {
      method: 'DELETE',
      credentials: 'include',
    });
  });
});
