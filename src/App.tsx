import { ExternalLink, Languages, LoaderCircle, LogIn, LogOut, RefreshCw, Sparkles, User, UserPlus } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, ReactElement } from 'react';
import type { Session } from '@supabase/supabase-js';

import { createSceneApiClient, type ApiError, type PageInfo, type SceneApiAuth, type SceneRecord, type SceneVisibility } from './api';
import { createGalleryAuthClient, type GalleryAuthClient } from './auth';
import { buildEditorSceneUrl, loadGalleryConfig } from './config';
import pokemonColorsData from './data/pokemon-colors.generated.json';
import { createGalleryDomainSessionClient, type GalleryDomainSession, type GalleryDomainSessionClient } from './domain-session';
import { getScenePseAttribution, summarizeScenePse, type SceneDimensionSummary, type ScenePseAttribution } from './scene-summary';

type LoadState<T> =
  | { status: 'loading' }
  | { status: 'loaded'; data: T }
  | { status: 'error'; error: ApiError };

const config = loadGalleryConfig();

type GalleryLanguage = 'en' | 'zh';

type GalleryAuthIdentity =
  | { kind: 'supabase'; session: Session }
  | { kind: 'domain-session'; session: GalleryDomainSession };

type PokemonColorSwatch = {
  hex: string;
  percent: number;
};

type PokemonColorEntry = {
  slug: string;
  name: string;
  zhName: string | null;
  primaryColor: string;
  palette: PokemonColorSwatch[];
};

const pokemonColorEntries = pokemonColorsData.pokemon as PokemonColorEntry[];
const pokemonColorBySlug = new Map(pokemonColorEntries.map(entry => [entry.slug, entry]));
const POKOKIT_HOME_URL = 'https://www.pokokit.com';

interface GalleryCopy {
  account: string;
  brandTitle: string;
  myScenes: string;
  signInToViewScenes: string;
  publicScenes: string;
  noSavedScenes: string;
  noPublicScenes: string;
  loadingScenes: string;
  retry: string;
  loadMore: string;
  loadingMore: string;
  dimensionsUnavailable: string;
  dimensionLabel: (length: number, width: number, height: number) => string;
  authorPrefix: string;
  authNotConfigured: string;
  checkingSession: string;
  restoreSessionError: string;
  email: string;
  password: string;
  nickname: string;
  signIn: string;
  signUp: string;
  signUpSuccess: string;
  signOut: string;
  signOutSharedError: string;
  saveNickname: string;
  savingNickname: string;
  nicknameSaved: string;
  nicknameUpdateError: string;
  openSignIn: string;
  publicToggle: string;
  publicToggleTitle: string;
  privateToggleTitle: string;
  openRef: string;
  openRefTitle: string;
  confirmPublicTitle: string;
  confirmPublicBody: string;
  confirmPublicCancel: string;
  confirmPublicAction: string;
  updatingVisibility: string;
  filterByPokemon: string;
  allPokemon: string;
  switchLanguage: string;
  languageButton: string;
}

const galleryCopy: Record<GalleryLanguage, GalleryCopy> = {
  en: {
    account: 'Account',
    brandTitle: 'Gallery',
    myScenes: 'My scenes',
    signInToViewScenes: 'Sign in to view scenes saved to your account.',
    publicScenes: 'Public scenes',
    noSavedScenes: 'No saved scenes yet.',
    noPublicScenes: 'No public scenes yet.',
    loadingScenes: 'Loading scenes',
    retry: 'Retry',
    loadMore: 'Load more',
    loadingMore: 'Loading more',
    dimensionsUnavailable: 'scene dimensions unavailable',
    dimensionLabel: (length, width, height) => `${length} by ${width} by ${height}`,
    authorPrefix: 'by',
    authNotConfigured: 'Auth not configured',
    checkingSession: 'Checking session',
    restoreSessionError: 'Unable to restore session.',
    email: 'Email',
    password: 'Password',
    nickname: 'Nickname',
    signIn: 'Sign in',
    signUp: 'Sign up',
    signUpSuccess: 'Registration submitted. Check your email if confirmation is required.',
    signOut: 'Sign out',
    signOutSharedError: 'Unable to clear shared Pokokit session. Try signing out again.',
    saveNickname: 'Save nickname',
    savingNickname: 'Saving',
    nicknameSaved: 'Nickname saved',
    nicknameUpdateError: 'Unable to update nickname.',
    openSignIn: 'Sign in',
    publicToggle: 'Public',
    publicToggleTitle: 'Make private',
    privateToggleTitle: 'Make public',
    openRef: 'Ref',
    openRefTitle: 'Open ref link',
    confirmPublicTitle: 'Make this scene public?',
    confirmPublicBody: 'Public scenes can be seen by other Gallery visitors.',
    confirmPublicCancel: 'Keep private',
    confirmPublicAction: 'Make public',
    updatingVisibility: 'Updating',
    filterByPokemon: 'Filter by Pokemon',
    allPokemon: 'All Pokemon',
    switchLanguage: 'Switch to Chinese',
    languageButton: '中文',
  },
  zh: {
    account: '账号',
    brandTitle: '画廊',
    myScenes: '我的场景',
    signInToViewScenes: '登录后查看保存到你账户的场景。',
    publicScenes: '公开场景',
    noSavedScenes: '还没有保存的场景。',
    noPublicScenes: '还没有公开场景。',
    loadingScenes: '正在加载场景',
    retry: '重试',
    loadMore: '加载更多',
    loadingMore: '正在加载',
    dimensionsUnavailable: '场景尺寸不可用',
    dimensionLabel: (length, width, height) => `${length} x ${width} x ${height}`,
    authorPrefix: '作者',
    authNotConfigured: '认证未配置',
    checkingSession: '正在检查登录状态',
    restoreSessionError: '无法恢复登录状态。',
    email: '邮箱',
    password: '密码',
    nickname: '昵称',
    signIn: '登录',
    signUp: '注册',
    signUpSuccess: '注册已提交。如果需要邮箱确认，请检查你的邮箱。',
    signOut: '退出登录',
    signOutSharedError: '无法清除 Pokokit 共享登录态。请重试退出登录。',
    saveNickname: '保存昵称',
    savingNickname: '保存中',
    nicknameSaved: '昵称已保存',
    nicknameUpdateError: '无法保存昵称。',
    openSignIn: '登录',
    publicToggle: '公开',
    publicToggleTitle: '改为私有',
    privateToggleTitle: '改为公开',
    openRef: 'Ref',
    openRefTitle: '打开 Ref 链接',
    confirmPublicTitle: '公开这个场景？',
    confirmPublicBody: '公开的 scene 可以被其他 Gallery 访问者看到。',
    confirmPublicCancel: '保持私有',
    confirmPublicAction: '确认公开',
    updatingVisibility: '正在更新',
    filterByPokemon: '按宝可梦筛选',
    allPokemon: '全部宝可梦',
    switchLanguage: '切换到 English',
    languageButton: 'EN',
  },
};

function readInitialLanguage(): GalleryLanguage {
  const stored = window.localStorage.getItem('pokokit.gallery.language');
  if (stored === 'en' || stored === 'zh') {
    return stored;
  }
  return 'en';
}

function getPokemonFilterOptions(language: GalleryLanguage): Array<{ slug: string; label: string }> {
  return pokemonColorEntries
    .map(entry => ({
      slug: entry.slug,
      label: getPokemonDisplayName(entry.slug, language),
    }))
    .sort((left, right) => left.label.localeCompare(right.label, language === 'zh' ? 'zh-Hans' : 'en'));
}

function getPokemonDisplayName(slug: string, language: GalleryLanguage): string {
  const entry = pokemonColorBySlug.get(slug);
  if (!entry) {
    return slug;
  }
  return language === 'zh' ? entry.zhName || entry.name || slug : entry.name || slug;
}

function normalizeNickname(value: string, email: string): string {
  const nickname = value.trim();
  if (nickname) {
    return nickname;
  }
  const emailPrefix = email.trim().split('@')[0]?.trim();
  return emailPrefix || 'pokokit-user';
}

export function App(): ReactElement {
  const apiClient = useMemo(() => createSceneApiClient(config.sceneApiUrl), []);
  const authClient = useMemo(() => createGalleryAuthClient(config.supabaseUrl, config.supabasePublishableKey), []);
  const domainSessionClient = useMemo(() => createGalleryDomainSessionClient(config.sceneApiUrl), []);
  const [language, setLanguage] = useState<GalleryLanguage>(() => readInitialLanguage());
  const [authIdentity, setAuthIdentity] = useState<GalleryAuthIdentity | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [publicOffset, setPublicOffset] = useState(0);
  const [myOffset, setMyOffset] = useState(0);
  const [publicPokemonFilter, setPublicPokemonFilter] = useState('');
  const [publicReloadToken, setPublicReloadToken] = useState(0);
  const [myReloadToken, setMyReloadToken] = useState(0);
  const [publicLoadingMore, setPublicLoadingMore] = useState(false);
  const [myLoadingMore, setMyLoadingMore] = useState(false);
  const [pendingPublicScene, setPendingPublicScene] = useState<SceneRecord | null>(null);
  const [updatingVisibilitySceneIds, setUpdatingVisibilitySceneIds] = useState<Set<string>>(() => new Set());
  const [visibilityActionError, setVisibilityActionError] = useState<string | null>(null);
  const [publicScenes, setPublicScenes] = useState<LoadState<{ scenes: SceneRecord[]; page: PageInfo }>>({ status: 'loading' });
  const [myScenes, setMyScenes] = useState<LoadState<{ scenes: SceneRecord[]; page: PageInfo }> | null>(null);
  const t = galleryCopy[language];
  const pokemonFilterOptions = useMemo(() => getPokemonFilterOptions(language), [language]);

  useEffect(() => {
    window.localStorage.setItem('pokokit.gallery.language', language);
  }, [language]);

  useEffect(() => {
    let cancelled = false;

    async function restoreSession(): Promise<void> {
      try {
        const nextSession = authClient ? await authClient.getSession() : null;
        const domainSession = await domainSessionClient.getSession();
        if (nextSession && domainSession && domainSession.user.id === nextSession.user.id) {
          await syncDomainSession(domainSessionClient, nextSession.access_token);
          if (cancelled) {
            return;
          }
          setAuthIdentity({ kind: 'supabase', session: nextSession });
        } else if (nextSession && domainSession && domainSession.user.id !== nextSession.user.id) {
          await authClient?.signOut();
          if (cancelled) {
            return;
          }
          setAuthIdentity({ kind: 'domain-session', session: domainSession });
        } else if (nextSession && !domainSession) {
          await authClient?.signOut();
          if (cancelled) {
            return;
          }
          setAuthIdentity(null);
        } else {
          if (cancelled) {
            return;
          }
          setAuthIdentity(domainSession ? { kind: 'domain-session', session: domainSession } : null);
        }
        setMyOffset(0);
        setAuthReady(true);
      } catch {
        if (!cancelled) {
          setAuthReady(true);
          setAuthError(t.restoreSessionError);
        }
      }
    }

    void restoreSession();

    const unsubscribe = authClient?.onSessionChange((nextSession, event) => {
      if (event === 'INITIAL_SESSION') {
        return;
      }
      if (nextSession) {
        void syncDomainSession(domainSessionClient, nextSession.access_token);
        setAuthIdentity({ kind: 'supabase', session: nextSession });
      } else {
        if (event === 'SIGNED_OUT') {
          void domainSessionClient.clear();
        }
        setAuthIdentity(null);
      }
      setMyOffset(0);
      setAuthReady(true);
    }) ?? (() => undefined);

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [authClient, domainSessionClient, t.restoreSessionError]);

  useEffect(() => {
    let cancelled = false;
    const shouldAppend = publicOffset > 0;
    if (shouldAppend) {
      setPublicLoadingMore(true);
    } else {
      setPublicLoadingMore(false);
      setPublicScenes({ status: 'loading' });
    }
    apiClient.listPublicScenes(publicOffset, { pokemon: publicPokemonFilter }).then(result => {
      if (cancelled) {
        return;
      }
      if (result.ok) {
        setPublicScenes(current => ({
          status: 'loaded',
          data: {
            scenes: shouldAppend && current.status === 'loaded' ? appendUniqueScenes(current.data.scenes, result.data.data) : result.data.data,
            page: result.data.page,
          },
        }));
      } else {
        setPublicScenes({ status: 'error', error: result.error });
      }
      setPublicLoadingMore(false);
    });
    return () => {
      cancelled = true;
    };
  }, [apiClient, publicOffset, publicReloadToken, publicPokemonFilter]);

  useEffect(() => {
    let cancelled = false;
    const sceneAuth = createSceneApiAuth(authIdentity);
    if (!sceneAuth) {
      setMyScenes(null);
      setMyLoadingMore(false);
      return;
    }

    const shouldAppend = myOffset > 0;
    if (shouldAppend) {
      setMyLoadingMore(true);
    } else {
      setMyLoadingMore(false);
      setMyScenes({ status: 'loading' });
    }
    apiClient.listMyScenes(sceneAuth, myOffset).then(result => {
      if (cancelled) {
        return;
      }
      if (result.ok) {
        setMyScenes(current => ({
          status: 'loaded',
          data: {
            scenes: shouldAppend && current?.status === 'loaded' ? appendUniqueScenes(current.data.scenes, result.data.data) : result.data.data,
            page: result.data.page,
          },
        }));
      } else if (shouldTreatMySceneErrorAsEmpty(result.error)) {
        setMyScenes(current => shouldAppend && current?.status === 'loaded' ? current : { status: 'loaded', data: createEmptySceneList(myOffset) });
      } else {
        setMyScenes({ status: 'error', error: result.error });
      }
      setMyLoadingMore(false);
    });
    return () => {
      cancelled = true;
    };
  }, [apiClient, authIdentity, myOffset, myReloadToken]);

  function handlePublicRetry(): void {
    setPublicOffset(0);
    setPublicReloadToken(token => token + 1);
  }

  function handlePublicLoadMore(): void {
    if (publicScenes.status !== 'loaded' || publicScenes.data.page.nextOffset === null) {
      return;
    }
    setPublicOffset(publicScenes.data.page.nextOffset);
  }

  function handleMyRetry(): void {
    setMyOffset(0);
    setMyReloadToken(token => token + 1);
  }

  function handleMyLoadMore(): void {
    if (myScenes?.status !== 'loaded' || myScenes.data.page.nextOffset === null) {
      return;
    }
    setMyOffset(myScenes.data.page.nextOffset);
  }

  function refreshSceneListsAfterProfileUpdate(): void {
    setMyOffset(0);
    setMyReloadToken(token => token + 1);
    setPublicOffset(0);
    setPublicReloadToken(token => token + 1);
  }

  async function updateMySceneVisibility(scene: SceneRecord, visibility: SceneVisibility): Promise<boolean> {
    const sceneAuth = createSceneApiAuth(authIdentity);
    if (!sceneAuth || updatingVisibilitySceneIds.has(scene.id)) {
      return false;
    }

    setVisibilityActionError(null);
    setUpdatingVisibilitySceneIds(current => {
      const next = new Set(current);
      next.add(scene.id);
      return next;
    });
    const result = await apiClient.updateSceneVisibility(sceneAuth, scene.id, visibility);
    setUpdatingVisibilitySceneIds(current => {
      const next = new Set(current);
      next.delete(scene.id);
      return next;
    });

    if (!result.ok) {
      setVisibilityActionError(result.error.message);
      return false;
    }

    setMyScenes(current => updateLoadedSceneRecord(current, result.data));
    setPublicOffset(0);
    setPublicReloadToken(token => token + 1);
    return true;
  }

  function handleMySceneVisibilityToggle(scene: SceneRecord): void {
    if (scene.visibility === 'public') {
      void updateMySceneVisibility(scene, 'private');
      return;
    }

    setVisibilityActionError(null);
    setPendingPublicScene(scene);
  }

  async function handleConfirmPublicScene(): Promise<void> {
    if (!pendingPublicScene) {
      return;
    }

    const updated = await updateMySceneVisibility(pendingPublicScene, 'public');
    if (updated) {
      setPendingPublicScene(null);
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand-lockup" href={POKOKIT_HOME_URL} aria-label={`pokokit ${t.brandTitle}`}>
          <span className="brand-pokokit">pokokit</span>
          <span className="brand-product">{t.brandTitle}</span>
        </a>
        <div className="topbar-actions">
          <button type="button" className="tool-button language-button" title={t.switchLanguage} onClick={() => setLanguage(current => (current === 'en' ? 'zh' : 'en'))}>
            <Languages size={16} aria-hidden="true" />
            {t.languageButton}
          </button>
          <AuthPanel
            authClient={authClient}
            domainSessionClient={domainSessionClient}
            authReady={authReady}
            authError={authError}
            authIdentity={authIdentity}
            onSignedIn={session => {
              setAuthIdentity({ kind: 'supabase', session });
              setMyOffset(0);
            }}
            onSignedOut={() => {
              setAuthIdentity(null);
              setMyOffset(0);
            }}
            onNicknameUpdated={refreshSceneListsAfterProfileUpdate}
            onAuthError={setAuthError}
            t={t}
          />
        </div>
      </header>

      <section className="content-grid">
        <section className="section-block my-scenes-section">
          <div className="section-heading">
            <div>
              <h2>{t.myScenes}</h2>
            </div>
          </div>
          {!authIdentity ? (
            <div className="state-panel compact-state">{t.signInToViewScenes}</div>
          ) : (
            <SceneList
              state={myScenes ?? { status: 'loading' }}
              emptyText={t.noSavedScenes}
              sceneEditorUrl={config.sceneEditorUrl}
              onRetry={handleMyRetry}
              onLoadMore={handleMyLoadMore}
              isLoadingMore={myLoadingMore}
              cardVariant="owned"
              renderActions={scene => (
                <PublicVisibilityToggle
                  scene={scene}
                  pending={updatingVisibilitySceneIds.has(scene.id)}
                  onToggle={handleMySceneVisibilityToggle}
                  t={t}
                />
              )}
              t={t}
            />
          )}
          {visibilityActionError ? <p className="visibility-action-error" role="status">{visibilityActionError}</p> : null}
        </section>

        <section className="section-block public-scenes-section">
          <div className="section-heading">
            <div>
              <h2>{t.publicScenes}</h2>
            </div>
            <div className="public-scene-filters">
              <label className="scene-pokemon-control">
                <select
                  value={publicPokemonFilter}
                  aria-label={t.filterByPokemon}
                  onChange={event => {
                    setPublicPokemonFilter(event.target.value);
                    setPublicOffset(0);
                  }}
                >
                  <option value="">{t.allPokemon}</option>
                  {pokemonFilterOptions.map(option => (
                    <option key={option.slug} value={option.slug}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <SceneList
            state={publicScenes}
            emptyText={t.noPublicScenes}
            sceneEditorUrl={config.sceneEditorUrl}
            onRetry={handlePublicRetry}
            onLoadMore={handlePublicLoadMore}
            isLoadingMore={publicLoadingMore}
            t={t}
          />
        </section>
      </section>
      {pendingPublicScene ? (
        <ConfirmPublicSceneDialog
          scene={pendingPublicScene}
          pending={updatingVisibilitySceneIds.has(pendingPublicScene.id)}
          error={visibilityActionError}
          onCancel={() => {
            setPendingPublicScene(null);
            setVisibilityActionError(null);
          }}
          onConfirm={() => void handleConfirmPublicScene()}
          t={t}
        />
      ) : null}
    </main>
  );
}

function AuthPanel({
  authClient,
  domainSessionClient,
  authReady,
  authError,
  authIdentity,
  onSignedIn,
  onSignedOut,
  onNicknameUpdated,
  onAuthError,
  t,
}: {
  authClient: GalleryAuthClient | null;
  domainSessionClient: GalleryDomainSessionClient;
  authReady: boolean;
  authError: string | null;
  authIdentity: GalleryAuthIdentity | null;
  onSignedIn: (session: Session) => void;
  onSignedOut: () => void;
  onNicknameUpdated: () => void;
  onAuthError: (error: string | null) => void;
  t: GalleryCopy;
}): ReactElement {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [profileNickname, setProfileNickname] = useState('');
  const [profilePending, setProfilePending] = useState(false);
  const [profileNotice, setProfileNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleDocumentPointerDown(event: PointerEvent): void {
      const target = event.target;
      if (target instanceof Node && popoverRef.current?.contains(target)) {
        return;
      }
      setIsOpen(false);
    }

    function handleEscape(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('pointerdown', handleDocumentPointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', handleDocumentPointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!authIdentity) {
      setProfileNickname('');
      setProfileNotice(null);
      return undefined;
    }

    let cancelled = false;
    const identityUserId = getAuthIdentityUserId(authIdentity);
    const fallbackNickname = getAuthIdentityNickname(authIdentity) ?? '';
    setProfileNickname(fallbackNickname);
    setProfileNotice(null);

    domainSessionClient.getProfile(getAuthIdentityAccessToken(authIdentity))
      .then(profile => {
        if (cancelled || profile.user.id !== identityUserId) {
          return;
        }
        setProfileNickname(profile.user.nickname ?? fallbackNickname);
      })
      .catch(() => {
        // The account menu remains usable with the restored identity when profile refresh fails.
      });

    return () => {
      cancelled = true;
    };
  }, [authIdentity, domainSessionClient]);

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!authClient || pending) {
      return;
    }
    setPending(true);
    onAuthError(null);
    setAuthNotice(null);
    const result = mode === 'signIn' ? await authClient.signIn(email, password) : await authClient.signUp(email, password, normalizeNickname(nickname, email));
    if (result.error) {
      onAuthError(result.error);
    } else {
      if (result.session) {
        await syncDomainSession(domainSessionClient, result.session.access_token);
        onSignedIn(result.session);
      }
      if (mode === 'signIn') {
        setIsOpen(false);
      } else {
        setAuthNotice(t.signUpSuccess);
      }
    }
    setPending(false);
  }

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!authIdentity || profilePending) {
      return;
    }

    const nextNickname = profileNickname.trim();
    if (!nextNickname || nextNickname.length > 80) {
      onAuthError(t.nicknameUpdateError);
      return;
    }

    setProfilePending(true);
    setProfileNotice(null);
    onAuthError(null);

    try {
      const profile = await domainSessionClient.updateProfile(nextNickname, getAuthIdentityAccessToken(authIdentity));
      if (profile.user.id === getAuthIdentityUserId(authIdentity)) {
        setProfileNickname(profile.user.nickname ?? nextNickname);
      }
      setProfileNotice(t.nicknameSaved);
      onNicknameUpdated();
    } catch {
      onAuthError(t.nicknameUpdateError);
    } finally {
      setProfilePending(false);
    }
  }

  async function handleSignOut(): Promise<void> {
    if (profilePending) {
      return;
    }
    try {
      await domainSessionClient.clear();
    } catch {
      onAuthError(t.signOutSharedError);
      return;
    }
    await authClient?.signOut();
    onSignedOut();
    setIsOpen(false);
  }

  if (!authClient && !authIdentity) {
    return <div className="auth-status disabled">{t.authNotConfigured}</div>;
  }

  if (!authReady) {
    return (
      <div className="auth-status muted">
        <LoaderCircle className="spin" size={16} aria-hidden="true" />
        {t.checkingSession}
      </div>
    );
  }

  if (authIdentity) {
    const userLabel = getAuthIdentityLabel(authIdentity);
    const accountLabel = profileNickname.trim() || userLabel;
    return (
      <div className="auth-menu" ref={popoverRef}>
        <button type="button" className="signed-in-user-trigger" aria-label={accountLabel} aria-expanded={isOpen} aria-controls="gallery-account-popover" title={accountLabel} onClick={() => setIsOpen(open => !open)}>
          <User size={15} aria-hidden="true" />
        </button>
        {isOpen ? (
          <div id="gallery-account-popover" className="auth-popover account-popover" role="dialog" aria-label={t.account}>
            <div className="account-email">
              <strong>{accountLabel}</strong>
            </div>
            <form className="account-profile-form" onSubmit={event => void handleProfileSubmit(event)}>
              <label>
                <span>{t.nickname}</span>
                <input
                  value={profileNickname}
                  type="text"
                  autoComplete="nickname"
                  maxLength={80}
                  disabled={profilePending}
                  onChange={event => {
                    setProfileNickname(event.target.value);
                    setProfileNotice(null);
                    onAuthError(null);
                  }}
                />
              </label>
              <button type="submit" className="primary-button account-profile-submit" disabled={profilePending || !profileNickname.trim()}>
                {profilePending ? <LoaderCircle className="spin" size={16} aria-hidden="true" /> : <User size={16} aria-hidden="true" />}
                {profilePending ? t.savingNickname : t.saveNickname}
              </button>
            </form>
            {profileNotice ? <p className="auth-notice account-profile-notice">{profileNotice}</p> : null}
            <button type="button" className="account-menu-item" disabled={profilePending} onClick={() => void handleSignOut()}>
              <LogOut size={16} aria-hidden="true" />
              {t.signOut}
            </button>
            {authError ? <p className="auth-error">{authError}</p> : null}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="auth-menu" ref={popoverRef}>
      <button type="button" className="tool-button sign-in-trigger" aria-expanded={isOpen} aria-controls="gallery-sign-in-popover" onClick={() => setIsOpen(open => !open)}>
        <LogIn size={16} aria-hidden="true" />
        {t.openSignIn}
      </button>
      {isOpen ? (
        <form id="gallery-sign-in-popover" className="auth-popover" onSubmit={event => void handleAuthSubmit(event)}>
          <div className="auth-mode-tabs" role="group" aria-label="Authentication mode">
            <button
              type="button"
              className={`auth-mode-tab${mode === 'signIn' ? ' is-active' : ''}`}
              aria-pressed={mode === 'signIn'}
              onClick={() => {
                setMode('signIn');
                setAuthNotice(null);
                onAuthError(null);
              }}
            >
              {t.signIn}
            </button>
            <button
              type="button"
              className={`auth-mode-tab${mode === 'signUp' ? ' is-active' : ''}`}
              aria-pressed={mode === 'signUp'}
              onClick={() => {
                setMode('signUp');
                setAuthNotice(null);
                onAuthError(null);
              }}
            >
              {t.signUp}
            </button>
          </div>
          <label>
            <span>{t.email}</span>
            <input value={email} type="email" autoComplete="email" onChange={event => setEmail(event.target.value)} />
          </label>
          {mode === 'signUp' ? (
            <label>
              <span>{t.nickname}</span>
              <input value={nickname} type="text" autoComplete="nickname" maxLength={80} onChange={event => setNickname(event.target.value)} />
            </label>
          ) : null}
          <label>
            <span>{t.password}</span>
            <input value={password} type="password" autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'} minLength={mode === 'signUp' ? 6 : undefined} onChange={event => setPassword(event.target.value)} />
          </label>
          <button type="submit" className="primary-button" disabled={pending}>
            {pending ? <LoaderCircle className="spin" size={16} aria-hidden="true" /> : mode === 'signUp' ? <UserPlus size={16} aria-hidden="true" /> : <LogIn size={16} aria-hidden="true" />}
            {mode === 'signUp' ? t.signUp : t.signIn}
          </button>
          {authNotice ? <p className="auth-notice">{authNotice}</p> : null}
          {authError ? <p className="auth-error">{authError}</p> : null}
        </form>
      ) : null}
    </div>
  );
}

async function syncDomainSession(domainSessionClient: GalleryDomainSessionClient, accessToken: string): Promise<void> {
  try {
    await domainSessionClient.sync(accessToken);
  } catch {
    // The Supabase session remains usable on this origin even if the shared domain cookie cannot be refreshed.
  }
}

function createSceneApiAuth(identity: GalleryAuthIdentity | null): SceneApiAuth | null {
  if (!identity) {
    return null;
  }
  if (identity.kind === 'supabase') {
    return {
      kind: 'bearer',
      token: identity.session.access_token,
    };
  }
  return { kind: 'domain-session' };
}

function getAuthIdentityLabel(identity: GalleryAuthIdentity): string {
  if (identity.kind === 'supabase') {
    return identity.session.user.email ?? identity.session.user.id;
  }
  return identity.session.user.id;
}

function getAuthIdentityUserId(identity: GalleryAuthIdentity): string {
  return identity.kind === 'supabase' ? identity.session.user.id : identity.session.user.id;
}

function getAuthIdentityAccessToken(identity: GalleryAuthIdentity): string | null {
  return identity.kind === 'supabase' ? identity.session.access_token : null;
}

function getAuthIdentityNickname(identity: GalleryAuthIdentity): string | null {
  if (identity.kind === 'domain-session') {
    return identity.session.user.nickname?.trim() || null;
  }

  const metadata = identity.session.user.user_metadata;
  if (!isRecord(metadata)) {
    return null;
  }
  const nicknameFields = ['nickname', 'display_name', 'name', 'username'];
  for (const field of nicknameFields) {
    const value = metadata[field];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function SceneList({
  state,
  emptyText,
  sceneEditorUrl,
  onRetry,
  onLoadMore,
  isLoadingMore = false,
  cardVariant = 'gallery',
  renderActions,
  t,
}: {
  state: LoadState<{ scenes: SceneRecord[]; page: PageInfo }>;
  emptyText: string;
  sceneEditorUrl: string;
  onRetry: () => void;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  cardVariant?: SceneCardVariant;
  renderActions?: (scene: SceneRecord) => ReactElement | null;
  t: GalleryCopy;
}): ReactElement {
  if (state.status === 'loading') {
    return (
      <div className="state-panel">
        <LoaderCircle className="spin" size={18} aria-hidden="true" />
        {t.loadingScenes}
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="state-panel error-state">
        <div>
          <strong>{state.error.code}</strong>
          <span>{state.error.message}</span>
        </div>
        <button type="button" className="icon-button" title={t.retry} onClick={onRetry}>
          <RefreshCw size={16} aria-hidden="true" />
        </button>
      </div>
    );
  }

  if (state.data.scenes.length === 0) {
    return (
      <div className="state-panel">
        <Sparkles size={18} aria-hidden="true" />
        {emptyText}
      </div>
    );
  }

  return (
    <>
      <div className="scene-list">
        {state.data.scenes.map(scene => (
          <SceneCard
            key={scene.id}
            scene={scene}
            sceneEditorUrl={sceneEditorUrl}
            actions={renderActions?.(scene) ?? null}
            variant={cardVariant}
            t={t}
          />
        ))}
      </div>
      <LoadMore page={state.data.page} onLoadMore={onLoadMore} isLoading={isLoadingMore} t={t} />
    </>
  );
}

type SceneCardVariant = 'gallery' | 'owned';

function SceneCard({
  scene,
  sceneEditorUrl,
  actions,
  variant,
  t,
}: {
  scene: SceneRecord;
  sceneEditorUrl: string;
  actions?: ReactElement | null;
  variant: SceneCardVariant;
  t: GalleryCopy;
}): ReactElement {
  const editorUrl = buildEditorSceneUrl(sceneEditorUrl, scene.id);
  const pokemonImage = getPokemonImageUrl(scene.pokemon);
  const dimensions = summarizeScenePse(scene.pse);
  const pseAttribution = getScenePseAttribution(scene.pse);
  const author = getSceneAuthor(scene, pseAttribution);
  const refUrl = pseAttribution.ref;

  function openEditor(): void {
    window.location.assign(editorUrl);
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLElement>): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openEditor();
    }
  }

  return (
    <article
      className={`scene-card scene-card--${variant}`}
      role="link"
      tabIndex={0}
      style={getSceneVisualStyle(scene)}
      aria-label={`${scene.name}, ${formatDimensionLabel(dimensions, t)}`}
      onClick={openEditor}
      onKeyDown={handleKeyDown}
    >
      {actions || refUrl ? (
        <div
          className="scene-card-actions"
          onClick={event => event.stopPropagation()}
          onKeyDown={event => event.stopPropagation()}
        >
          {refUrl ? <SceneRefLink url={refUrl} t={t} /> : null}
          {actions}
        </div>
      ) : null}
      {pokemonImage ? (
        <img
          className="scene-card-pokemon"
          src={pokemonImage}
          alt=""
          loading="lazy"
          onError={event => {
            event.currentTarget.hidden = true;
          }}
        />
      ) : null}
      <div className="scene-card-content">
        <h3>{scene.name}</h3>
        {variant === 'gallery' && author ? <SceneAuthor author={author} t={t} /> : null}
        <SceneDimensions dimensions={dimensions} t={t} />
      </div>
    </article>
  );
}

function PublicVisibilityToggle({
  scene,
  pending,
  onToggle,
  t,
}: {
  scene: SceneRecord;
  pending: boolean;
  onToggle: (scene: SceneRecord) => void;
  t: GalleryCopy;
}): ReactElement {
  const isPublic = scene.visibility === 'public';
  return (
    <button
      type="button"
      className={`public-toggle${isPublic ? ' is-on' : ''}`}
      role="switch"
      aria-checked={isPublic}
      aria-label={isPublic ? t.publicToggleTitle : t.privateToggleTitle}
      title={isPublic ? t.publicToggleTitle : t.privateToggleTitle}
      disabled={pending}
      onClick={() => onToggle(scene)}
    >
      <span className="public-toggle-track" aria-hidden="true">
        <span className="public-toggle-thumb" />
      </span>
      <span className="public-toggle-label">{t.publicToggle}</span>
      {pending ? <LoaderCircle className="spin" size={13} aria-hidden="true" /> : null}
    </button>
  );
}

function ConfirmPublicSceneDialog({
  scene,
  pending,
  error,
  onCancel,
  onConfirm,
  t,
}: {
  scene: SceneRecord;
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
  t: GalleryCopy;
}): ReactElement {
  return (
    <div className="confirm-backdrop" role="presentation">
      <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-public-title">
        <h2 id="confirm-public-title">{t.confirmPublicTitle}</h2>
        <p className="confirm-scene-name">{scene.name}</p>
        <p>{t.confirmPublicBody}</p>
        {error ? <p className="confirm-error" role="status">{error}</p> : null}
        <div className="confirm-dialog-actions">
          <button type="button" className="secondary-button" disabled={pending} onClick={onCancel}>
            {t.confirmPublicCancel}
          </button>
          <button type="button" className="primary-button" disabled={pending} onClick={onConfirm}>
            {pending ? <LoaderCircle className="spin" size={16} aria-hidden="true" /> : null}
            {pending ? t.updatingVisibility : t.confirmPublicAction}
          </button>
        </div>
      </section>
    </div>
  );
}

function SceneRefLink({ url, t }: { url: string; t: GalleryCopy }): ReactElement {
  return (
    <a
      className="scene-ref-link"
      href={url}
      target="_blank"
      rel="noreferrer"
      aria-label={t.openRefTitle}
      title={t.openRefTitle}
      onClick={event => event.stopPropagation()}
      onKeyDown={event => event.stopPropagation()}
    >
      <ExternalLink size={13} aria-hidden="true" />
      <span>{t.openRef}</span>
    </a>
  );
}

function SceneAuthor({ author, t }: { author: { label: string; url: string | null }; t: GalleryCopy }): ReactElement {
  return (
    <p className="scene-author-line">
      <span>{t.authorPrefix}</span>
      {author.url ? (
        <a
          href={author.url}
          target="_blank"
          rel="noreferrer"
          onClick={event => event.stopPropagation()}
          onKeyDown={event => event.stopPropagation()}
        >
          {author.label}
        </a>
      ) : (
        <strong>{author.label}</strong>
      )}
    </p>
  );
}

function SceneDimensions({ dimensions, t }: { dimensions: SceneDimensionSummary | null; t: GalleryCopy }): ReactElement {
  return (
    <p className="scene-dimension-formula" aria-label={formatDimensionLabel(dimensions, t)}>
      {formatDimensionFormula(dimensions)}
    </p>
  );
}

function LoadMore({ page, onLoadMore, isLoading, t }: { page: PageInfo; onLoadMore: (() => void) | undefined; isLoading: boolean; t: GalleryCopy }): ReactElement | null {
  if (!page.hasNextPage || page.nextOffset === null || !onLoadMore) {
    return null;
  }
  return (
    <div className="load-more-bar">
      <button type="button" className="primary-button load-more-button" disabled={isLoading} onClick={onLoadMore}>
        {isLoading ? <LoaderCircle className="spin" size={16} aria-hidden="true" /> : null}
        {isLoading ? t.loadingMore : t.loadMore}
      </button>
    </div>
  );
}

function formatDimensionLabel(dimensions: SceneDimensionSummary | null, t: GalleryCopy): string {
  if (!dimensions) {
    return t.dimensionsUnavailable;
  }
  return t.dimensionLabel(dimensions.length, dimensions.width, dimensions.height);
}

function formatDimensionFormula(dimensions: SceneDimensionSummary | null): string {
  if (!dimensions) {
    return '-';
  }
  return `${dimensions.length}*${dimensions.width}*${dimensions.height}`;
}

function getSceneAuthor(scene: SceneRecord, pseAttribution: ScenePseAttribution): { label: string; url: string | null } | null {
  const pseAuthorUrl = pseAttribution.author;
  if (pseAuthorUrl) {
    return {
      label: formatAuthorUrl(pseAuthorUrl),
      url: pseAuthorUrl,
    };
  }

  const authorUrl = scene.author?.trim();
  if (authorUrl && isHttpsUrl(authorUrl)) {
    return {
      label: formatAuthorUrl(authorUrl),
      url: authorUrl,
    };
  }

  const nickname = scene.author_nickname?.trim();
  return nickname ? { label: nickname, url: null } : null;
}

function formatAuthorUrl(value: string): string {
  try {
    const url = new URL(value);
    return url.hostname.replace(/^www\./, '') + url.pathname.replace(/\/$/, '');
  } catch {
    return value;
  }
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function appendUniqueScenes(currentScenes: SceneRecord[], nextScenes: SceneRecord[]): SceneRecord[] {
  const seenIds = new Set(currentScenes.map(scene => scene.id));
  return currentScenes.concat(nextScenes.filter(scene => {
    if (seenIds.has(scene.id)) {
      return false;
    }
    seenIds.add(scene.id);
    return true;
  }));
}

function updateLoadedSceneRecord(
  state: LoadState<{ scenes: SceneRecord[]; page: PageInfo }> | null,
  record: SceneRecord,
): LoadState<{ scenes: SceneRecord[]; page: PageInfo }> | null {
  if (state?.status !== 'loaded') {
    return state;
  }

  return {
    status: 'loaded',
    data: {
      ...state.data,
      scenes: state.data.scenes.map(scene => scene.id === record.id ? record : scene),
    },
  };
}

function shouldTreatMySceneErrorAsEmpty(error: ApiError): boolean {
  return error.code === 'scene_store_unavailable';
}

function createEmptySceneList(offset: number): { scenes: SceneRecord[]; page: PageInfo } {
  return {
    scenes: [],
    page: {
      page: 1,
      pageSize: 0,
      total: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: offset > 0,
      offset,
      limit: 0,
      nextOffset: null,
      previousOffset: null,
    },
  };
}

function getSceneVisualStyle(scene: SceneRecord): CSSProperties {
  const slug = normalizePokemonSlug(scene.pokemon);
  const colors = getPokemonCardColors(slug, scene.id);

  return {
    '--pokemon-primary': colors.primary,
    '--pokemon-secondary': colors.secondary,
    '--pokemon-tertiary': colors.tertiary,
    '--pokemon-card-ink': colors.ink,
  } as CSSProperties;
}

function getPokemonImageUrl(pokemon: string): string | null {
  const slug = normalizePokemonSlug(pokemon);
  if (!slug) {
    return null;
  }
  return `https://decor-dex.pokokit.com/assets/runtime/pokemon/${slug}.webp`;
}

function normalizePokemonSlug(pokemon: string): string {
  return pokemon
    .trim()
    .toLowerCase()
    .replace(/['.]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getPokemonCardColors(slug: string, fallbackSeed: string): { primary: string; secondary: string; tertiary: string; ink: string } {
  const entry = pokemonColorBySlug.get(slug);
  const palette = (entry?.palette.length ? entry.palette : entry ? [{ hex: entry.primaryColor, percent: 100 }] : [])
    .map(color => color.hex)
    .filter(isHexColor);
  const primary = isHexColor(entry?.primaryColor) ? entry.primaryColor : palette[0] ?? fallbackCardColor(fallbackSeed);
  const secondary = palette.find(color => color.toLowerCase() !== primary.toLowerCase()) ?? primary;
  const tertiary = palette.find(color => color.toLowerCase() !== primary.toLowerCase() && color.toLowerCase() !== secondary.toLowerCase()) ?? secondary;

  return {
    primary,
    secondary,
    tertiary,
    ink: readableInk(hexToRgb(primary)),
  };
}

function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
}

function fallbackCardColor(seed: string): string {
  const hue = hashString(seed) % 360;
  return `#${hslToRgbHex(hue, 0.42, 0.68)}`;
}

function hslToRgbHex(hue: number, saturation: number, lightness: number): string {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const segment = hue / 60;
  const x = chroma * (1 - Math.abs((segment % 2) - 1));
  const [r1, g1, b1] =
    segment < 1 ? [chroma, x, 0] :
    segment < 2 ? [x, chroma, 0] :
    segment < 3 ? [0, chroma, x] :
    segment < 4 ? [0, x, chroma] :
    segment < 5 ? [x, 0, chroma] :
    [chroma, 0, x];
  const match = lightness - chroma / 2;
  return [r1, g1, b1]
    .map(channel => Math.round((channel + match) * 255).toString(16).padStart(2, '0'))
    .join('');
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace(/^#/, '');
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function readableInk(rgb: { r: number; g: number; b: number }): string {
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.57 ? '#1c1a17' : '#fff8ea';
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}
