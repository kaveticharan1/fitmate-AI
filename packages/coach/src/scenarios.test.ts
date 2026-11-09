import { describe, expect, it } from 'vitest';
import { extractActions, safetyFlags, validateAction } from './index';

/** Positive and negative scenarios for what the coach may do and must catch. */
describe('coach action scenarios', () => {
  it('accepts well-formed actions', () => {
    expect(validateAction({ type: 'log_water', ml: 250 })).toBeTruthy();
    expect(validateAction({ type: 'log_weight', kg: 72.5 })).toBeTruthy();
  });
  it.each([
    [{ type: 'log_water', ml: -100 }],
    [{ type: 'log_water', ml: 50_000 }],
    [{ type: 'log_weight', kg: 'seventy' }],
    [{ type: 'delete_all_data' }],
    [{ type: 'log_sleep', hours: 30 }],
    [null],
    ['log_water'],
    [{ type: 'set_reminder', time: '25:99', text: 'x' }],
  ])('rejects bad action %j', (raw) => {
    expect(validateAction(raw)).toBeNull();
  });
  it('ignores broken or excess action tags and hides them from the text', () => {
    const tag = (o: object) => `[[action:${JSON.stringify(o)}]]`;
    const reply = `Done. ${tag({ type: 'log_water', ml: 250 })} [[action:{oops}]] ${tag({ type: 'log_water', ml: 250 })} ${tag({ type: 'log_water', ml: 250 })} ${tag({ type: 'log_water', ml: 250 })}`;
    const r = extractActions(reply);
    expect(r.actions.length).toBeLessThanOrEqual(3);
    expect(r.text).not.toMatch(/\[\[action/);
  });
});

describe('safety scenarios', () => {
  it.each(['I can’t breathe and my throat is swelling', 'my lips are swelling up', 'I want to end my life'])('flags %s', (t) => {
    expect(safetyFlags(t).length).toBeGreaterThan(0);
  });
  it.each(['I want to end my workout early', 'how do I breathe during squats', 'my face looks puffy in the morning'])('does not flag %s', (t) => {
    expect(safetyFlags(t)).toEqual([]);
  });
});
