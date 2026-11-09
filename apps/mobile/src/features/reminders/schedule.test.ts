import { buildSchedule, DEFAULT_REMINDERS, parseTime } from './schedule';

describe('reminder schedule', () => {
  it('is empty by default', () => {
    expect(buildSchedule(DEFAULT_REMINDERS)).toEqual([]);
  });
  it('schedules hourly water reminders inside the window', () => {
    const s = buildSchedule({ ...DEFAULT_REMINDERS, water: { enabled: true, startHour: 8, endHour: 21, everyHours: 1 } });
    expect(s.map((n) => n.hour)).toEqual([8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]);
    expect(buildSchedule({ ...DEFAULT_REMINDERS, water: { enabled: true, startHour: 8, endHour: 21, everyHours: 2 } })).toHaveLength(7);
  });
  it('adds valid medicines and skips incomplete ones', () => {
    const s = buildSchedule({
      ...DEFAULT_REMINDERS,
      medicines: [
        { id: 'a', name: 'Thyroid tablet', time: '7:00' },
        { id: 'b', name: '', time: '08:00' },
        { id: 'c', name: 'Vitamin D', time: '25:00' },
      ],
    });
    expect(s).toEqual([{ id: 'med-a', kind: 'medicine', hour: 7, minute: 0, label: 'Thyroid tablet' }]);
  });
  it('parses 24-hour times only', () => {
    expect(parseTime('08:30')).toEqual({ hour: 8, minute: 30 });
    expect(parseTime('8.30')).toBeNull();
    expect(parseTime('12:60')).toBeNull();
  });
});
