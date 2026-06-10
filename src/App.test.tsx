import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Session } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SceneApiAuth, SceneListResult, SceneRecord } from './api';
import { App } from './App';
import type { GalleryDomainSession } from './domain-session';

const mocks = vi.hoisted(() => ({
  apiClient: {
    listPublicScenes: vi.fn(),
    listMyScenes: vi.fn(),
    updateSceneVisibility: vi.fn(),
  },
  authClient: {
    getSession: vi.fn(),
    onSessionChange: vi.fn(),
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  },
  domainSessionClient: {
    getSession: vi.fn(),
    getProfile: vi.fn(),
    sync: vi.fn(),
    updateProfile: vi.fn(),
    clear: vi.fn(),
  },
}));

vi.mock('./api', () => ({
  createSceneApiClient: () => mocks.apiClient,
}));

vi.mock('./auth', () => ({
  createGalleryAuthClient: () => mocks.authClient,
}));

vi.mock('./config', () => ({
  buildEditorSceneUrl: (sceneEditorUrl: string, sceneId: string) => `${sceneEditorUrl}?scene_id=${encodeURIComponent(sceneId)}`,
  loadGalleryConfig: () => ({
    sceneApiUrl: 'https://scene-api.example.com',
    sceneEditorUrl: 'https://editor.example.com',
    supabaseUrl: 'https://supabase.example.com',
    supabasePublishableKey: 'sb_publishable_test',
  }),
}));

vi.mock('./domain-session', () => ({
  createGalleryDomainSessionClient: () => mocks.domainSessionClient,
}));

describe('Gallery App domain session restore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    mocks.authClient.getSession.mockResolvedValue(null);
    mocks.authClient.onSessionChange.mockReturnValue(() => undefined);
    mocks.authClient.signIn.mockResolvedValue({ error: null, session: null });
    mocks.authClient.signUp.mockResolvedValue({ error: null, session: null });
    mocks.authClient.signOut.mockResolvedValue(undefined);
    mocks.domainSessionClient.getSession.mockResolvedValue(null);
    mocks.domainSessionClient.getProfile.mockResolvedValue(domainSession('profile-user'));
    mocks.domainSessionClient.sync.mockResolvedValue(undefined);
    mocks.domainSessionClient.updateProfile.mockResolvedValue(domainSession('profile-user'));
    mocks.domainSessionClient.clear.mockResolvedValue(undefined);
    mocks.apiClient.listPublicScenes.mockResolvedValue(okSceneList([sceneFixture('public-scene', 'Public scene')]));
    mocks.apiClient.listMyScenes.mockResolvedValue(okSceneList([sceneFixture('owned-scene', 'Owned scene')]));
  });

  afterEach(() => {
    cleanup();
  });

  it('restores a valid domain session and loads my scenes with cookie auth', async () => {
    mocks.domainSessionClient.getSession.mockResolvedValue(domainSession('domain-user'));

    render(<App />);

    await waitFor(() => {
      expect(mocks.domainSessionClient.getSession).toHaveBeenCalled();
      expect(mocks.apiClient.listMyScenes).toHaveBeenCalledWith({ kind: 'domain-session' } satisfies SceneApiAuth, 0);
    });
    expect(await screen.findByRole('button', { name: 'domain-user' })).toBeVisible();
    expect(screen.getByText('Owned scene')).toBeVisible();
    expect(screen.getByText('Public scene')).toBeVisible();
  });

  it('keeps public scenes usable and shows the sign-in entry when no domain session exists', async () => {
    render(<App />);

    expect(await screen.findByText('Sign in to view scenes saved to your account.')).toBeVisible();
    expect(screen.getByText('Public scene')).toBeVisible();
    expect(mocks.apiClient.listMyScenes).not.toHaveBeenCalled();
  });

  it('treats a cleared domain session as shared sign-out truth over a local Supabase session', async () => {
    mocks.authClient.getSession.mockResolvedValue(supabaseSession('local-user', 'local@example.com', 'local-token'));
    mocks.domainSessionClient.getSession.mockResolvedValue(null);

    render(<App />);

    expect(await screen.findByText('Sign in to view scenes saved to your account.')).toBeVisible();
    expect(mocks.authClient.signOut).toHaveBeenCalled();
    expect(mocks.apiClient.listMyScenes).not.toHaveBeenCalled();
  });

  it('keeps public scenes usable when domain session restore fails', async () => {
    mocks.domainSessionClient.getSession.mockRejectedValue(new Error('restore failed'));

    render(<App />);

    expect(await screen.findByText('Public scene')).toBeVisible();
    expect(mocks.apiClient.listMyScenes).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByText('Unable to restore session.')).toBeVisible();
  });

  it('syncs the domain session immediately after Gallery sign-in succeeds', async () => {
    const session = supabaseSession('signed-in-user', 'signed-in@example.com', 'signed-in-token');
    mocks.authClient.signIn.mockResolvedValue({ error: null, session });

    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: 'Sign in' }));
    const form = screen.getAllByRole('button', { name: 'Sign in' })
      .find(button => button.closest('form'))
      ?.closest('form');
    if (!form) {
      throw new Error('Expected sign-in form to be open.');
    }
    fireEvent.change(within(form).getByLabelText('Email'), { target: { value: 'signed-in@example.com' } });
    fireEvent.change(within(form).getByLabelText('Password'), { target: { value: 'password123' } });
    const submitButton = form.querySelector('button[type="submit"]');
    if (!submitButton) {
      throw new Error('Expected sign-in submit button.');
    }
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mocks.domainSessionClient.sync).toHaveBeenCalledWith('signed-in-token');
      expect(mocks.apiClient.listMyScenes).toHaveBeenCalledWith({ kind: 'bearer', token: 'signed-in-token' } satisfies SceneApiAuth, 0);
    });
    expect(await screen.findByRole('button', { name: 'signed-in@example.com' })).toBeVisible();
  });

  it('passes the entered nickname when Gallery sign-up is submitted', async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: 'Sign in' }));
    const form = screen.getAllByRole('button', { name: 'Sign in' })
      .find(button => button.closest('form'))
      ?.closest('form');
    if (!form) {
      throw new Error('Expected sign-in form to be open.');
    }

    fireEvent.click(within(form).getByRole('button', { name: 'Sign up' }));
    fireEvent.change(within(form).getByLabelText('Email'), { target: { value: 'new-user@example.com' } });
    fireEvent.change(within(form).getByLabelText('Nickname'), { target: { value: 'Pixel Panda' } });
    fireEvent.change(within(form).getByLabelText('Password'), { target: { value: 'password123' } });
    const submitButton = form.querySelector('button[type="submit"]');
    if (!submitButton) {
      throw new Error('Expected sign-up submit button.');
    }
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mocks.authClient.signUp).toHaveBeenCalledWith('new-user@example.com', 'password123', 'Pixel Panda');
    });
  });

  it('updates nickname from the signed-in account menu', async () => {
    mocks.authClient.getSession.mockResolvedValue(supabaseSession('local-user', 'local@example.com', 'local-token'));
    mocks.domainSessionClient.getSession.mockResolvedValue(domainSession('local-user'));
    mocks.domainSessionClient.getProfile.mockResolvedValue(domainSession('local-user', 'Old Panda'));
    mocks.domainSessionClient.updateProfile.mockResolvedValue(domainSession('local-user', 'New Panda'));

    render(<App />);

    const accountButton = await screen.findByRole('button', { name: 'Old Panda' });
    fireEvent.click(accountButton);
    const dialog = screen.getByRole('dialog', { name: 'Account' });

    expect(within(dialog).getByText('local@example.com')).toBeVisible();
    expect(within(dialog).getByLabelText('Nickname')).toHaveValue('Old Panda');

    fireEvent.change(within(dialog).getByLabelText('Nickname'), { target: { value: 'New Panda' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save nickname' }));

    await waitFor(() => {
      expect(mocks.domainSessionClient.updateProfile).toHaveBeenCalledWith('New Panda', 'local-token');
    });
    expect(await within(dialog).findByText('Nickname saved')).toBeVisible();
    expect(within(dialog).getByText('New Panda')).toBeVisible();
  });

  it('clears the domain session on sign-out from a restored domain identity', async () => {
    mocks.domainSessionClient.getSession.mockResolvedValue(domainSession('domain-user'));

    render(<App />);

    const accountButton = await screen.findByRole('button', { name: 'domain-user' });
    fireEvent.click(accountButton);
    fireEvent.click(screen.getByRole('button', { name: /Sign out/i }));

    await waitFor(() => {
      expect(mocks.domainSessionClient.clear).toHaveBeenCalled();
      expect(mocks.authClient.signOut).toHaveBeenCalled();
    });
    expect(await screen.findByText('Sign in to view scenes saved to your account.')).toBeVisible();
  });

  it('keeps the signed-in menu open with an error when shared sign-out clear fails', async () => {
    mocks.domainSessionClient.getSession.mockResolvedValue(domainSession('domain-user'));
    mocks.domainSessionClient.clear.mockRejectedValue(new Error('clear failed'));

    render(<App />);

    const accountButton = await screen.findByRole('button', { name: 'domain-user' });
    fireEvent.click(accountButton);
    fireEvent.click(screen.getByRole('button', { name: /Sign out/i }));

    await waitFor(() => {
      expect(screen.getByText('Unable to clear shared Pokokit session. Try signing out again.')).toBeVisible();
    });
    expect(mocks.authClient.signOut).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'domain-user' })).toBeVisible();
  });
});

function domainSession(userId: string, nickname: string | null = null): GalleryDomainSession {
  return {
    user: {
      id: userId,
      nickname,
    },
  };
}

function supabaseSession(userId: string, email: string, accessToken: string): Session {
  return {
    access_token: accessToken,
    refresh_token: 'refresh-token',
    expires_in: 3600,
    token_type: 'bearer',
    user: {
      id: userId,
      email,
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: '2026-06-10T00:00:00.000Z',
    },
  };
}

function okSceneList(scenes: SceneRecord[]) {
  return {
    ok: true,
    data: sceneList(scenes),
  };
}

function sceneList(scenes: SceneRecord[]): SceneListResult {
  return {
    data: scenes,
    page: {
      page: 1,
      pageSize: 12,
      total: scenes.length,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
      offset: 0,
      limit: 12,
      nextOffset: null,
      previousOffset: null,
    },
  };
}

function sceneFixture(id: string, name: string): SceneRecord {
  return {
    id,
    owner_user_id: 'owner-1',
    name,
    pse: 'PSE1~fixture',
    pokemon: 'pikachu',
    visibility: 'public',
    author: null,
    author_nickname: 'owner',
    created_at: '2026-06-10T00:00:00.000Z',
    updated_at: '2026-06-10T00:00:00.000Z',
  };
}
