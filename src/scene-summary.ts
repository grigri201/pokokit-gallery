export interface SceneDimensionSummary {
  length: number;
  width: number;
  height: number;
}

export interface ScenePseAttribution {
  author: string | null;
  ref: string | null;
}

const legacyCodecPrefix = 'PSE1';
const dimensionedCodecPrefix = 'PSE2';
const currentCodecPrefix = 'PSE3';
const empty = '_';
const radixAlphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

export function summarizeScenePse(value: string): SceneDimensionSummary | null {
  const [prefix, ...parts] = value.trim().split('~');
  if (prefix === legacyCodecPrefix) {
    const encodedLevels = parts[1];
    return {
      length: 7,
      width: 7,
      height: countBuildingLevels(encodedLevels),
    };
  }

  if (prefix !== dimensionedCodecPrefix && prefix !== currentCodecPrefix) {
    return null;
  }

  const encodedDimensions = parts[0];
  const encodedLevels = prefix === currentCodecPrefix ? getPse3LevelsPart(parts) : parts[2];
  if (!encodedDimensions) {
    return null;
  }

  const dimensions = decodeDimensions(encodedDimensions);
  if (!dimensions) {
    return null;
  }

  return {
    ...dimensions,
    height: countBuildingLevels(encodedLevels),
  };
}

export function getScenePseAttribution(value: string): ScenePseAttribution {
  const [prefix, ...parts] = value.trim().split('~');
  if (prefix !== currentCodecPrefix) {
    return createEmptyAttribution();
  }

  if (parts.length >= 7) {
    return {
      author: decodeHttpsText(parts[1]),
      ref: decodeHttpsText(parts[2]),
    };
  }

  if (parts.length === 6) {
    const [author, ref, ...extra] = (parts[1] ?? '').split('.');
    if (extra.length > 0) {
      return createEmptyAttribution();
    }
    return {
      author: decodeHttpsText(author),
      ref: decodeHttpsText(ref),
    };
  }

  return createEmptyAttribution();
}

function getPse3LevelsPart(parts: string[]): string | undefined {
  if (parts.length >= 7) {
    return parts[4];
  }
  if (parts.length === 6) {
    return parts[3];
  }
  return parts[2];
}

function createEmptyAttribution(): ScenePseAttribution {
  return {
    author: null,
    ref: null,
  };
}

function decodeHttpsText(value: string | undefined): string | null {
  if (!value || value === empty) {
    return null;
  }
  try {
    const decoded = decodeURIComponent(value).trim();
    return isHttpsUrl(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function decodeDimensions(value: string): Pick<SceneDimensionSummary, 'length' | 'width'> | null {
  const [sceneLength, sceneWidth, outerPadding, ...extra] = value.split('.');
  if (!sceneLength || !sceneWidth || !outerPadding || extra.length > 0) {
    return null;
  }

  const length = decodeNumber(sceneLength);
  const width = decodeNumber(sceneWidth);
  const padding = decodeNumber(outerPadding);
  if (!Number.isInteger(length) || !Number.isInteger(width) || !Number.isInteger(padding) || length <= 0 || width <= 0 || padding < 0) {
    return null;
  }

  return {
    length: length + padding * 2,
    width: width + padding * 2,
  };
}

function countBuildingLevels(value: string | undefined): number {
  if (!value || value === empty) {
    return 1;
  }
  return value.split(';').filter(Boolean).length || 1;
}

function decodeNumber(value: string): number {
  let total = 0;
  for (const char of value) {
    const digit = radixAlphabet.indexOf(char);
    if (digit === -1) {
      return Number.NaN;
    }
    total = total * radixAlphabet.length + digit;
  }
  return total;
}
