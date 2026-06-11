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
    deleteScene: vi.fn(),
  },
  authClient: {
    getSession: vi.fn(),
    onSessionChange: vi.fn(),
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  },
  createGalleryAuthClient: vi.fn(),
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
  createGalleryAuthClient: mocks.createGalleryAuthClient,
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
    mocks.createGalleryAuthClient.mockReturnValue(mocks.authClient);
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
    mocks.apiClient.deleteScene.mockResolvedValue({ ok: true, data: { deleted: true } });
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

  it('waits for shared session restore before showing missing auth config', async () => {
    mocks.createGalleryAuthClient.mockReturnValue(null);
    mocks.domainSessionClient.getSession.mockResolvedValue(domainSession('domain-user'));

    render(<App />);

    expect(screen.getByText('Checking session')).toBeVisible();
    expect(screen.queryByText('Auth not configured')).not.toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'domain-user' })).toBeVisible();
  });

  it('uses PSE author and ref links on scene cards', async () => {
    mocks.apiClient.listPublicScenes.mockResolvedValue(okSceneList([
      sceneFixture('pse-scene', 'PSE scene', {
        author: 'https://saved-author.example/profile',
        author_nickname: 'Saved Author',
        pse: [
          'PSE3',
          'F.F.1',
          'https%3A%2F%2Fauthor%2Eexample%2Fprofile',
          'https%3A%2F%2Fref%2Eexample%2Fscene',
          'Name.0.0._._',
          '0.1%E5%B1%82',
          '_',
          '_',
        ].join('~'),
      }),
    ]));

    render(<App />);

    expect(await screen.findByText('PSE scene')).toBeVisible();
    const authorLink = screen.getByRole('link', { name: 'author.example/profile' });
    expect(authorLink).toHaveAttribute('href', 'https://author.example/profile');
    expect(authorLink).toHaveAttribute('target', '_blank');
    expect(screen.queryByRole('link', { name: 'saved-author.example/profile' })).not.toBeInTheDocument();

    const refLink = screen.getByRole('link', { name: 'Open ref link' });
    expect(refLink).toHaveAttribute('href', 'https://ref.example/scene');
    expect(refLink).toHaveAttribute('target', '_blank');
  });

  it('deletes an owned scene after confirmation and refreshes scene lists', async () => {
    mocks.domainSessionClient.getSession.mockResolvedValue(domainSession('domain-user'));
    mocks.apiClient.listMyScenes
      .mockResolvedValueOnce(okSceneList([sceneFixture('owned-scene', 'Owned scene')]))
      .mockResolvedValueOnce(okSceneList([]));
    mocks.apiClient.listPublicScenes
      .mockResolvedValueOnce(okSceneList([
        sceneFixture('owned-scene', 'Owned scene'),
        sceneFixture('public-scene', 'Public scene'),
      ]))
      .mockResolvedValueOnce(okSceneList([sceneFixture('public-scene', 'Public scene')]));

    render(<App />);

    const deleteButton = await screen.findByRole('button', { name: 'Delete scene' });
    fireEvent.click(deleteButton);
    const dialog = await screen.findByRole('dialog', { name: 'Delete this scene?' });
    expect(within(dialog).getByText('Owned scene')).toBeVisible();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(mocks.apiClient.deleteScene).toHaveBeenCalledWith({ kind: 'domain-session' } satisfies SceneApiAuth, 'owned-scene');
    });
    await waitFor(() => {
      expect(mocks.apiClient.listMyScenes).toHaveBeenCalledTimes(2);
      expect(mocks.apiClient.listPublicScenes).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText('No saved scenes yet.')).toBeVisible();
    expect(screen.queryByText('Owned scene')).not.toBeInTheDocument();
  });

  it('cancels owned scene deletion without calling the API', async () => {
    mocks.domainSessionClient.getSession.mockResolvedValue(domainSession('domain-user'));

    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: 'Delete scene' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete this scene?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Delete this scene?' })).not.toBeInTheDocument();
    });
    expect(mocks.apiClient.deleteScene).not.toHaveBeenCalled();
    expect(screen.getByText('Owned scene')).toBeVisible();
  });

  it('keeps the owned scene visible when delete fails', async () => {
    mocks.domainSessionClient.getSession.mockResolvedValue(domainSession('domain-user'));
    mocks.apiClient.deleteScene.mockResolvedValue({
      ok: false,
      error: {
        code: 'scene_forbidden',
        message: 'Only the scene owner can delete this scene.',
      },
    });

    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: 'Delete scene' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete this scene?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    expect(await within(dialog).findByText('Only the scene owner can delete this scene.')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Owned scene, 7 by 7 by 1' })).toBeVisible();
  });

  it('does not show delete actions for anonymous public scenes', async () => {
    render(<App />);

    expect(await screen.findByText('Public scene')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Delete scene' })).not.toBeInTheDocument();
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

    expect(within(dialog).queryByText('local@example.com')).not.toBeInTheDocument();
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

function sceneFixture(id: string, name: string, overrides: Partial<SceneRecord> = {}): SceneRecord {
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
    ...overrides,
  };
}
