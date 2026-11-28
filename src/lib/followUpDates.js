const dateLabel = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' });

export function followUpDueDate(item, createdAt = item.createdAt) {
  if (item.dueAt) {
    const date = new Date(item.dueAt);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (!createdAt || (item.when !== 'Hoje' && item.when !== 'Amanhã')) return null;
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return null;
  date.setDate(date.getDate() + (item.when === 'Amanhã' ? 1 : 0));
  date.setHours(23, 59, 59, 999);
  return date;
}

export function followUpPeriod(due, now) {
  if (!due) return 'unscheduled';
  if (due < now) return 'overdue';
  return due.toDateString() === now.toDateString() ? 'today' : 'upcoming';
}

export function formatFollowUpDate(due) {
  return dateLabel.format(due);
}

export function dateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return [year, month, day].join('-');
}
