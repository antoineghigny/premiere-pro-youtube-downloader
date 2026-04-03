export const BACKEND_PORTS = [3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009, 3010];
export const APP_FINGERPRINT = 'YT2Premiere';
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
    throw new Error(`Backend on ${port} did not match the expected fingerprint`);
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
