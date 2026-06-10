export interface GalleryConfig {
  sceneApiUrl: string;
  sceneEditorUrl: string;
  supabaseUrl: string | null;
  supabasePublishableKey: string | null;
}

export function loadGalleryConfig(env: ImportMetaEnv = import.meta.env): GalleryConfig {
  return {
    sceneApiUrl: normalizeBaseUrl(env.VITE_SCENE_API_URL, 'http://localhost:8787'),
    sceneEditorUrl: normalizeBaseUrl(env.VITE_SCENE_EDITOR_URL, 'http://localhost:5174'),
    supabaseUrl: normalizeOptionalUrl(env.VITE_SUPABASE_URL),
    supabasePublishableKey: normalizeOptionalSecret(env.VITE_SUPABASE_PUBLISHABLE_KEY),
  };
}

export function buildEditorSceneUrl(sceneEditorUrl: string, sceneId: string): string {
  const url = new URL(sceneEditorUrl);
  url.searchParams.set('scene_id', sceneId);
  return url.toString();
}

function normalizeBaseUrl(value: string | undefined, fallback: string): string {
  const raw = value?.trim() || fallback;
  try {
    return new URL(raw).toString();
  } catch {
    return new URL(fallback).toString();
  }
}

function normalizeOptionalUrl(value: string | undefined): string | null {
  const raw = value?.trim();
  if (!raw || isPlaceholder(raw)) {
    return null;
  }
  try {
    return new URL(raw).toString();
  } catch {
    return null;
  }
}

function normalizeOptionalSecret(value: string | undefined): string | null {
  const raw = value?.trim();
  if (!raw || isPlaceholder(raw)) {
    return null;
  }
  return raw;
}

function isPlaceholder(value: string): boolean {
  return /\breplace\b/i.test(value) || /\bplaceholder\b/i.test(value) || /\bexample\b/i.test(value);
}
