export function toStartOfLocalDay(dateInput: string | Date): Date {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : new Date(dateInput);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(dateInput: string | Date, days: number): Date {
  const date = toStartOfLocalDay(dateInput);
  date.setDate(date.getDate() + days);
  return date;
}

export function toIsoDateTimeAtLocalStart(dateInput: string | Date): string {
  return toStartOfLocalDay(dateInput).toISOString();
}

export function toDateKey(dateInput: string | Date): string {
  const date = toStartOfLocalDay(dateInput);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function startOfWeekMonday(dateInput: string | Date): Date {
  const date = toStartOfLocalDay(dateInput);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
}
