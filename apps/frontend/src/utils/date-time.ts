const TIME_24H_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
const TIME_24H_COMPACT_REGEX = /^([01]\d|2[0-3])([0-5]\d)$/;
const TIME_24H_WITH_SECONDS_REGEX = /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/;
const TIME_24H_SHORT_HOUR_REGEX = /^(\d):([0-5]\d)$/;

export function isTime24(value: string): boolean {
  return TIME_24H_REGEX.test(value);
}

export function normalizeTime24(value: string): string {
  const trimmed = value.trim();

  if (TIME_24H_REGEX.test(trimmed)) {
    return trimmed;
  }

  if (TIME_24H_WITH_SECONDS_REGEX.test(trimmed)) {
    return trimmed.slice(0, 5);
  }

  const compactMatch = trimmed.match(TIME_24H_COMPACT_REGEX);
  if (compactMatch) {
    return `${compactMatch[1]}:${compactMatch[2]}`;
  }

  const shortMatch = trimmed.match(TIME_24H_SHORT_HOUR_REGEX);
  if (shortMatch) {
    const hours = shortMatch[1].padStart(2, '0');
    return `${hours}:${shortMatch[2]}`;
  }

  return trimmed;
}

export function formatTimeHHmm(value: string): string {
  const normalized = normalizeTime24(value);
  if (isTime24(normalized)) {
    return normalized;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function formatDateTimeRu24(iso: string, timeZone = 'UTC'): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }

  let formatter: Intl.DateTimeFormat;

  try {
    formatter = new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone,
    });
  } catch {
    formatter = new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: 'UTC',
    });
  }

  const parts = formatter.formatToParts(date);
  const day = parts.find((part) => part.type === 'day')?.value ?? '00';
  const month = parts.find((part) => part.type === 'month')?.value ?? '00';
  const year = parts.find((part) => part.type === 'year')?.value ?? '0000';
  const hour = parts.find((part) => part.type === 'hour')?.value ?? '00';
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '00';
  const second = parts.find((part) => part.type === 'second')?.value ?? '00';

  return `${day}.${month}.${year} ${hour}:${minute}:${second}`;
}
