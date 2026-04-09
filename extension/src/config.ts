export const APP_FINGERPRINT = 'YT2Premiere';
export const BACKEND_PORTS = [3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009, 3010];

// Download status retention configuration
// How long to keep download status in memory (in milliseconds)
// Default: 2 minutes - enough time for large downloads to complete
export const DOWNLOAD_STATUS_RETENTION_MS = 120_000; // 2 minutes

// How often to check for stale downloads to clean up (in milliseconds)
export const DOWNLOAD_CLEANUP_INTERVAL_MS = 60_000; // 1 minute
