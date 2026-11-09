import { addDays, isoToDisplayDate, localDate } from './time';

describe('date helpers', () => {
  it('adds days across months, years and leap days', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('formats local dates', () => {
    expect(localDate(new Date(2026, 10, 9, 23, 59))).toBe('2026-11-09');
    expect(isoToDisplayDate('2026-11-09')).toBe('09-11-2026');
  });
});
