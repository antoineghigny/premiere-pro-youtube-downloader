var child_process = require('child_process');
var exec = child_process.exec;
var execSync = child_process.execSync;
var spawn = child_process.spawn;
var fs = require('fs');
var http = require('http');
var os = require('os');
var path = require('path');

var execPath = path.join(__dirname, 'exec');
var appDataDir = os.platform() === 'darwin'
    ? path.join(os.homedir(), 'Library', 'Application Support')
    : (process.env.APPDATA || '');
var activePortFile = path.join(appDataDir, 'YT2Premiere', 'active_port.json');

function readActiveBackendDescriptor() {
    try {
        if (!fs.existsSync(activePortFile)) {
            return null;
        }
        var data = JSON.parse(fs.readFileSync(activePortFile, 'utf8'));
        var port = Number(data && data.port);
        if (!Number.isInteger(port)) {
            return null;
        }

        return {
            port: port,
            cepToken: typeof data.cepToken === 'string' ? data.cepToken.trim() : ''
        };
    } catch (error) {
        console.error('Could not read active_port.json:', error);
        return null;
    }
}

function isBackendAlive(callback) {
    var backend = readActiveBackendDescriptor();
    if (!backend) {
        callback(false);
        return;
    }

    var req = http.get({
        hostname: '127.0.0.1',
        port: backend.port,
        path: '/',
        timeout: 800,
        headers: {
            'X-YT2PP-CEP': '1',
            'X-YT2PP-CEP-Token': backend.cepToken
        }
    }, function(res) {
        var body = '';
        res.on('data', function(chunk) {
            body += chunk;
        });
        res.on('end', function() {
            try {
                var payload = JSON.parse(body);
                callback(res.statusCode === 200 && payload.app === 'YT2Premiere');
            } catch (_error) {
                callback(false);
            }
        });
    });

    req.on('error', function() {
        callback(false);
    });

    req.on('timeout', function() {
        req.destroy();
        callback(false);
    });
}

function readInstallPathFromRegistry() {
    if (os.platform() !== 'win32') {
        return null;
    }

    try {
        var output = execSync('reg query "HKCU\\Software\\YT2Premiere" /v InstallPath', {
            encoding: 'utf8',
            windowsHide: true
        });
        var lines = output.split(/\r?\n/);
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line || line.indexOf('InstallPath') === -1) {
                continue;
            }
            var parts = line.split(/\s{2,}/).filter(Boolean);
            var rawValue = parts[parts.length - 1];
            if (!rawValue) {
                continue;
            }
            if (fs.existsSync(rawValue) && rawValue.toLowerCase().endsWith('.exe')) {
                return rawValue;
            }
            var candidate = path.join(rawValue, 'YT2Premiere.exe');
            if (fs.existsSync(candidate)) {
                return candidate;
            }
        }
    } catch (_error) {
        return null;
    }

    return null;
}

function uniqueExistingPaths(items) {
    var seen = {};
    return items.filter(function(item) {
        if (!item || seen[item] || !fs.existsSync(item)) {
            return false;
        }
        seen[item] = true;
        return true;
    });
}

function windowsExecutableCandidates() {
    var installRoots = [
        path.join(process.env.LOCALAPPDATA || '', 'Programs', 'YT2Premiere'),
        path.join(process.env.ProgramW6432 || '', 'YT2Premiere'),
        path.join(process.env.ProgramFiles || '', 'YT2Premiere'),
        path.join(process.env['ProgramFiles(x86)'] || '', 'YT2Premiere')
    ];

    var candidates = [path.join(execPath, 'YT2Premiere.exe')];
    uniqueExistingPaths(installRoots).forEach(function(installRoot) {
        candidates.push(path.join(installRoot, 'YT2Premiere.exe'));
        candidates.push(path.join(installRoot, 'exec', 'YT2Premiere.exe'));
    });

    return uniqueExistingPaths(candidates);
}

function getWindowsBackendPath() {
    var registryPath = readInstallPathFromRegistry();
    if (registryPath) {
        return registryPath;
    }

    var candidates = windowsExecutableCandidates();
    return candidates.length > 0 ? candidates[0] : null;
}

function launchBackend() {
    if (os.platform() === 'darwin') {
        var macExecutablePath = path.join(execPath, 'YT2Premiere');
        if (!fs.existsSync(macExecutablePath)) {
            console.error('YT2Premiere backend not found for macOS:', macExecutablePath);
            return;
        }
        var appleScriptCommand = 'tell application "Finder" to launch application "' + macExecutablePath + '"';
        exec("osascript -e '" + appleScriptCommand + "' -e 'delay 2' -e 'tell application \"System Events\" to set visible of process \"YT2Premiere\" to false'", function(err) {
            if (err) {
                console.error('Error executing command:', err);
                return;
            }
        });
    } else if (os.platform() === 'win32') {
        var winExecutablePath = getWindowsBackendPath();
        if (!winExecutablePath) {
            console.error('YT2Premiere backend not found. Checked the registry and standard install folders.');
            return;
        }
        try {
            var child = spawn(winExecutablePath, ['--background'], { detached: true, stdio: 'ignore', windowsHide: true });
            child.unref();
        } catch (error) {
            console.error('Could not launch Windows backend:', error);
        }
    } else {
        console.error('Unsupported operating system.');
    }
}

isBackendAlive(function(alive) {
    if (alive) {
        return;
    }
    launchBackend();
});
