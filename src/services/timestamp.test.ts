import { describe, expect, it } from 'vitest';
import { DespawnTimestamp, ImportedSpawnTimestamp, ResetTimestamp, SpawnTimestamp } from './timestamp';

describe('timestamp services', () => {
  it('returns 0 drift for reset timestamps', () => {
    const reset = new ResetTimestamp();
    expect(reset.getDrift()).toBe(0);
    expect(reset.getCycle()).toBe(0);
  });

  it('calculates spawn timestamp drift and cycle within current week', () => {
    const reset = new ResetTimestamp();
    const now = new Date(reset.getTimestamp() * 1000);
    const spawn = new SpawnTimestamp(new Date(now.getTime() + 42 * 1000));

    expect(spawn.getCycle()).toBe(1);
    expect(spawn.getDrift()).toBe(42);
    expect(spawn.getTimestamp()).toBe(reset.getTimestamp() + 42);
  });

  it('calculates despawn drift by normalizing to spawn time', () => {
    const reset = new ResetTimestamp();
    const spawnTime = reset.getTimestamp() + 52;
    const despawn = new DespawnTimestamp(new Date((spawnTime + 3620) * 1000));

    expect(despawn.getCycle()).toBe(1);
    expect(despawn.getDrift()).toBe(52);
    expect(despawn.getNormalizedTimestamp()).toBe(spawnTime);
  });

  it('parses imported unix timestamp in seconds', () => {
    const unixSeconds = 1700000000;
    const imported = new ImportedSpawnTimestamp(unixSeconds);
    expect(imported.getTimestamp()).toBe(unixSeconds);
  });

  it('parses imported millisecond unix timestamp by converting to seconds', () => {
    const unixMilliseconds = 1700000000000;
    const imported = new ImportedSpawnTimestamp(unixMilliseconds);
    expect(imported.getTimestamp()).toBe(1700000000);
  });

  it('parses imported ISO timestamp string correctly', () => {
    const unixSeconds = 1700000000;
    const isoString = new Date(unixSeconds * 1000).toISOString();
    const imported = new ImportedSpawnTimestamp(isoString);
    expect(imported.getTimestamp()).toBe(unixSeconds);
  });
});