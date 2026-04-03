export function isLikelyRemoteUrl(value: string): boolean {
  const normalized = value.trim();
  if (!normalized) {
    return false;
  }

  try {
    const url = new URL(normalized);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return /^https?:\/\/\S+$/i.test(normalized);
  }
}

export function parseTimecode(value: string): number | undefined {
  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }

  const parts = normalized.split(':');
  if (parts.length < 2 || parts.length > 3) {
    return undefined;
  }

  const [hoursPart, minutesPart, secondsPart] =
    parts.length === 3 ? parts : ['0', parts[0], parts[1]];

  const hours = Number.parseInt(hoursPart, 10);
  const minutes = Number.parseInt(minutesPart, 10);
  const seconds = Number.parseFloat(secondsPart);

  if ([hours, minutes, seconds].some((valuePart) => Number.isNaN(valuePart))) {
    return undefined;
  }

  if (hours < 0 || minutes < 0 || minutes >= 60 || seconds < 0 || seconds >= 60) {
    return undefined;
  }

  return hours * 3600 + minutes * 60 + seconds;
}
