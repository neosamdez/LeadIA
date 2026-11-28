export const ANALYTICS_TIME_ZONE = 'America/Sao_Paulo';
const DAY_MS = 86400000;
const calendar = new Intl.DateTimeFormat('en', { timeZone: ANALYTICS_TIME_ZONE, year: 'numeric', month: 'numeric' });
const zoneOffset = new Intl.DateTimeFormat('en', { timeZone: ANALYTICS_TIME_ZONE, timeZoneName: 'longOffset' });

export function analyticsPeriod(value) {
  return value === '30d' || value === 'mes' ? value : '7d';
}

export function analyticsStart(period, now) {
  if (period !== 'mes') return new Date(now - (period === '30d' ? 30 : 7) * DAY_MS).toISOString();

  const parts = Object.fromEntries(calendar.formatToParts(now).map(({ type, value }) => [type, value]));
  const midnight = Date.UTC(Number(parts.year), Number(parts.month) - 1, 1);
  const offset = zoneOffset.formatToParts(midnight)
    .find(part => part.type === 'timeZoneName').value;
  const match = /^GMT([+-])(\d\d):(\d\d)$/.exec(offset);
  if (!match) return new Date(midnight).toISOString();
  const [, sign, hours, minutes] = match;
  const offsetMs = (Number(hours) * 60 + Number(minutes)) * 60000;
  return new Date(midnight + (sign === '-' ? offsetMs : -offsetMs)).toISOString();
}
