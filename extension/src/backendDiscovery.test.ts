import { describe, expect, it } from 'vitest';

import { parseBackendCandidate, pickPreferredBackend } from './backendDiscovery';

describe('extension backend discovery', () => {
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
  });

  it('rejects incompatible backends', () => {
    expect(() =>
      parseBackendCandidate(3001, {
        app: 'LegacyApp',
        apiVersion: 1,
        transport: 'legacy',
        port: 3001,
      })
    ).toThrow(/fingerprint/i);
  });
});
