import { APP_FINGERPRINT, BACKEND_PORTS } from './config';

export const BACKEND_API_VERSION = 2;
export const BACKEND_TRANSPORT = 'rust-desktop';

export type BackendInstanceKind = 'development' | 'installed';

export interface BackendHealthPayload {
  app?: string;
  apiVersion?: number;
  transport?: string;
  port?: number;
  instanceKind?: string;
  version?: string;
}

export interface BackendCandidate {
  port: number;
  instanceKind: BackendInstanceKind;
  version?: string;
}

function normalizeInstanceKind(value?: string): BackendInstanceKind {
  return value === 'development' ? 'development' : 'installed';
}

export function parseBackendCandidate(port: number, payload: BackendHealthPayload): BackendCandidate {
  if (
    payload.app !== APP_FINGERPRINT ||
    payload.apiVersion !== BACKEND_API_VERSION ||
    payload.transport !== BACKEND_TRANSPORT ||
    payload.port !== port
  ) {
    throw new Error(`Port ${port} did not match the expected backend fingerprint`);
  }

  return {
    port,
    instanceKind: normalizeInstanceKind(payload.instanceKind),
    version: payload.version,
  };
}

function instanceRank(instanceKind: BackendInstanceKind): number {
  return instanceKind === 'development' ? 0 : 1;
}

export function pickPreferredBackend(candidates: BackendCandidate[]): BackendCandidate {
  if (candidates.length === 0) {
    throw new Error('No compatible backend responded');
  }

  return [...candidates].sort((left, right) => {
    const kindDelta = instanceRank(left.instanceKind) - instanceRank(right.instanceKind);
    if (kindDelta !== 0) {
      return kindDelta;
    }
    return left.port - right.port;
  })[0];
}

export { APP_FINGERPRINT, BACKEND_PORTS };
