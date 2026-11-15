const DAY_NAMES = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

function pad(value) {
  return String(value).padStart(2, '0');
}

function toDateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDateKey(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (Number.isNaN(date.getTime())) return null;
  if (date.getFullYear() !== Number(year) || date.getMonth() !== Number(month) - 1 || date.getDate() !== Number(day)) {
    return null;
  }
  return date;
}

function dayOfWeek(dateKey) {
  const date = parseDateKey(dateKey);
  return date ? date.getDay() : null;
}

function isValidTime(value) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value || '');
}

function timeToMinutes(value) {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes) {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

function addMinutes(time, minutes) {
  return minutesToTime(timeToMinutes(time) + minutes);
}

function isPastSlot(dateKey, startTime) {
  const date = parseDateKey(dateKey);
  if (!date) return true;
  const [h, m] = startTime.split(':').map(Number);
  date.setHours(h, m, 0, 0);
  return date.getTime() <= Date.now();
}

function monthBounds(date = new Date()) {
  const start = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-01`;
  const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const end = `${endDate.getFullYear()}-${pad(endDate.getMonth() + 1)}-${pad(endDate.getDate())}`;
  return { start, end };
}

module.exports = {
  DAY_NAMES,
  toDateKey,
  parseDateKey,
  dayOfWeek,
  isValidTime,
  timeToMinutes,
  minutesToTime,
  addMinutes,
  isPastSlot,
  monthBounds,
};
