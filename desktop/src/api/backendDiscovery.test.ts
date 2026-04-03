import { describe, expect, it } from 'vitest';

import { parseBackendCandidate, pickPreferredBackend } from './backendDiscovery';

describe('backend discovery', () => {
  it('prefers development backends over installed ones', () => {
    const preferred = pickPreferredBackend([
      parseBackendCandidate(3001, {
        app: 'YT2Premiere',
        apiVersion: 2,
        transport: 'rust-desktop',
        port: 3001,
        instanceKind: 'installed',
      }),
      parseBackendCandidate(3002, {
        app: 'YT2Premiere',
        apiVersion: 2,
        transport: 'rust-desktop',
        port: 3002,
        instanceKind: 'development',
      }),
    ]);

    expect(preferred.port).toBe(3002);
    expect(preferred.instanceKind).toBe('development');
  });

  it('rejects incompatible fingerprints', () => {
    expect(() =>
      parseBackendCandidate(3001, {
        app: 'WrongApp',
        apiVersion: 2,
        transport: 'rust-desktop',
        port: 3001,
      })
    ).toThrow(/fingerprint/i);
  });
});
