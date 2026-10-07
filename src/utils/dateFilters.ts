export type DatePreset =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'this_year'
  | 'custom'
  | 'all';

export interface DateRange {
  preset: DatePreset;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  label: string;     // e.g. "01 Oct 2026 – 05 Oct 2026"
}

export function formatDateToISO(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDisplayDate(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export function getDateRangeFromPreset(
  preset: DatePreset,
  customStart?: string,
  customEnd?: string,
  referenceDate: Date = new Date()
): DateRange {
  const ref = new Date(referenceDate);

  if (preset === 'all') {
    return {
      preset: 'all',
      startDate: '',
      endDate: '',
      label: 'All Time'
    };
  }

  if (preset === 'today') {
    const todayStr = formatDateToISO(ref);
    return {
      preset: 'today',
      startDate: todayStr,
      endDate: todayStr,
      label: `Today (${formatDisplayDate(todayStr)})`
    };
  }

  if (preset === 'yesterday') {
    const yest = new Date(ref);
    yest.setDate(ref.getDate() - 1);
    const yestStr = formatDateToISO(yest);
    return {
      preset: 'yesterday',
      startDate: yestStr,
      endDate: yestStr,
      label: `Yesterday (${formatDisplayDate(yestStr)})`
    };
  }

  if (preset === 'this_week') {
    const day = ref.getDay(); // 0 is Sun, 1 is Mon
    const diffToMon = day === 0 ? -6 : 1 - day;
    const monday = new Date(ref);
    monday.setDate(ref.getDate() + diffToMon);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const startStr = formatDateToISO(monday);
    const endStr = formatDateToISO(sunday);
    return {
      preset: 'this_week',
      startDate: startStr,
      endDate: endStr,
      label: `This Week (${formatDisplayDate(startStr)} – ${formatDisplayDate(endStr)})`
    };
  }

  if (preset === 'last_week') {
    const day = ref.getDay();
    const diffToMon = day === 0 ? -6 : 1 - day;
    const thisMonday = new Date(ref);
    thisMonday.setDate(ref.getDate() + diffToMon);

    const lastMonday = new Date(thisMonday);
    lastMonday.setDate(thisMonday.getDate() - 7);
    const lastSunday = new Date(lastMonday);
    lastSunday.setDate(lastMonday.getDate() + 6);

    const startStr = formatDateToISO(lastMonday);
    const endStr = formatDateToISO(lastSunday);
    return {
      preset: 'last_week',
      startDate: startStr,
      endDate: endStr,
      label: `Last Week (${formatDisplayDate(startStr)} – ${formatDisplayDate(endStr)})`
    };
  }

  if (preset === 'this_month') {
    const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
    const startStr = formatDateToISO(start);
    const endStr = formatDateToISO(end);
    return {
      preset: 'this_month',
      startDate: startStr,
      endDate: endStr,
      label: `This Month (${formatDisplayDate(startStr)} – ${formatDisplayDate(endStr)})`
    };
  }

  if (preset === 'last_month') {
    const start = new Date(ref.getFullYear(), ref.getMonth() - 1, 1);
    const end = new Date(ref.getFullYear(), ref.getMonth(), 0);
    const startStr = formatDateToISO(start);
    const endStr = formatDateToISO(end);
    return {
      preset: 'last_month',
      startDate: startStr,
      endDate: endStr,
      label: `Last Month (${formatDisplayDate(startStr)} – ${formatDisplayDate(endStr)})`
    };
  }

  if (preset === 'this_year') {
    const start = new Date(ref.getFullYear(), 0, 1);
    const end = new Date(ref.getFullYear(), 11, 31);
    const startStr = formatDateToISO(start);
    const endStr = formatDateToISO(end);
    return {
      preset: 'this_year',
      startDate: startStr,
      endDate: endStr,
      label: `This Year (${formatDisplayDate(startStr)} – ${formatDisplayDate(endStr)})`
    };
  }

  // Custom
  const startStr = customStart || formatDateToISO(ref);
  const endStr = customEnd || formatDateToISO(ref);
  return {
    preset: 'custom',
    startDate: startStr,
    endDate: endStr,
    label: `${formatDisplayDate(startStr)} – ${formatDisplayDate(endStr)}`
  };
}
