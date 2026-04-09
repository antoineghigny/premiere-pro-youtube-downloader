# Security Configuration

This document covers security-related configuration for YT2Premiere.

## Extension ID Rotation

The Chrome extension must be trusted by the desktop app to communicate. Extension IDs are whitelisted in the desktop backend to prevent unauthorized extensions from accessing the API.

### Default Extension IDs

The default extension IDs are hardcoded in `desktop/src-tauri/src/cors.rs`:

```rust
const DEFAULT_EXTENSION_IDS: &str = "noloogahcbofnjjkpbeandcgoldejcic,aidffebbdmdjibggcfkeihnljgambjjd";
```

### Rotating Extension IDs

If you need to use a custom extension build or if an extension ID is compromised:

1. **Build your extension** and load it in Chrome in developer mode
2. **Get the extension ID** from `chrome://extensions`
3. **Set the environment variable** before launching the desktop app:

   **Windows (PowerShell):**
   ```powershell
   $env:YT2PP_EXTENSION_IDS = "your-extension-id-here,another-extension-id"
   .\YT2Premiere.exe
   ```

   **macOS/Linux:**
   ```bash
   YT2PP_EXTENSION_IDS=your-extension-id-here,another-extension-id ./YT2Premiere
   ```

4. **Restart the desktop app** for the change to take effect

### Multiple Extension IDs

You can whitelist multiple extension IDs by separating them with commas:

```
YT2PP_EXTENSION_IDS=id1,id2,id3
```

Spaces around commas are trimmed automatically.

## Rate Limiting

The desktop backend implements rate limiting to prevent abuse.

### Default Limits

- **Window:** 60 seconds
- **Max requests:** 100 requests per client per window

### Configuring Rate Limits

Override via environment variables:

```
YT2PP_RATE_LIMIT_WINDOW=60     # Window in seconds
YT2PP_RATE_LIMIT_MAX=100       # Max requests per window
```

### Rate Limit Behavior

When a client exceeds the rate limit, they receive:
- HTTP 429 (Too Many Requests)
- JSON response with `error` and `retryAfter` fields

## CEP Heartbeat

The Premiere Pro panel (CEP) must send periodic heartbeats to remain connected.

### Default Configuration

- **Heartbeat TTL:** 30 seconds (configurable)

### Configuring Heartbeat TTL

```
YT2PP_CEP_HEARTBEAT_TTL=30    # Seconds before CEP is considered disconnected
```

A longer TTL is more forgiving on slower systems but may delay detection of disconnected panels.

## File Permissions

### Token Files

The `active_port.json` file (containing authentication tokens) is created with restrictive permissions:

- **Unix:** `chmod 600` (read/write for owner only)
- **Windows:** Inherits ACL from parent directory

### Location

Token files are stored in:
- **Windows:** `%APPDATA%\YT2Premiere\`
- **macOS:** `~/Library/Application Support/YT2Premiere/`
- **Linux:** `~/.config/YT2Premiere/`

## Request Logging

All API requests are logged with:
- HTTP method and path
- Client type (desktop, extension, CEP, unknown)
- Response status and duration

Suspicious activity (403 Forbidden, 429 Too Many Requests) is logged at WARN level.

### Viewing Logs

**Development:**
```bash
RUST_LOG=info ./YT2Premiere
```

**Production:** Logs are written to stdout/stderr and can be redirected to a file or log aggregation service.

## Security Best Practices

1. **Keep extension IDs secret** - Don't share your extension ID with untrusted parties
2. **Use HTTPS** - The extension only communicates with `https://` URLs for video sources
3. **Review downloads** - Always review downloaded files before importing into projects
4. **Update regularly** - Keep yt-dlp and FFmpeg updated for security fixes
5. **Monitor logs** - Check logs for suspicious activity (high rate of 403/429 responses)
