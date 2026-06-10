export interface SceneDimensionSummary {
  length: number;
  width: number;
  height: number;
}

const legacyCodecPrefix = 'PSE1';
const dimensionedCodecPrefix = 'PSE2';
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

  if (prefix !== dimensionedCodecPrefix) {
    return null;
  }

  const encodedDimensions = parts[0];
  const encodedLevels = parts[2];
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
