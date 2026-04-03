var child_process = require('child_process');
var exec = child_process.exec;
var execSync = child_process.execSync;
var spawn = child_process.spawn;
var fs = require('fs');
var http = require('http');
var os = require('os');
var path = require('path');

var execPath = path.join(__dirname, 'exec');
var activePortFile = path.join(process.env.APPDATA || '', 'YT2Premiere', 'active_port.json');

function readActiveBackendPort() {
    try {
        if (!fs.existsSync(activePortFile)) {
            return null;
        }
        var data = JSON.parse(fs.readFileSync(activePortFile, 'utf8'));
        var port = Number(data && data.port);
        return Number.isInteger(port) ? port : null;
    } catch (error) {
        console.error('Could not read active_port.json:', error);
        return null;
    }
}

function isBackendAlive(callback) {
    var port = readActiveBackendPort();
    if (!port) {
        callback(false);
        return;
    }

    var req = http.get({
        hostname: '127.0.0.1',
        port: port,
        path: '/',
        timeout: 800
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

function uniqueNonEmpty(items) {
    var seen = {};
    return items.filter(function(item) {
        if (!item || seen[item]) {
            return false;
        }
        seen[item] = true;
        return true;
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

function getWindowsBackendPath() {
    var registryPath = readInstallPathFromRegistry();
    if (registryPath) {
        return registryPath;
    }

    var baseDirs = uniqueNonEmpty([
        process.env.YT2PREMIERE_HOME || '',
        execPath,
        path.join(process.env.LOCALAPPDATA || '', 'Programs', 'YT2Premiere'),
        path.join(process.env.LOCALAPPDATA || '', 'Programs', 'YT2Premiere', 'exec'),
        path.join(process.env.ProgramW6432 || '', 'YT2Premiere'),
        path.join(process.env.ProgramW6432 || '', 'YT2Premiere', 'exec'),
        path.join(process.env.ProgramFiles || '', 'YT2Premiere'),
        path.join(process.env.ProgramFiles || '', 'YT2Premiere', 'exec'),
        path.join(process.env['ProgramFiles(x86)'] || '', 'YT2Premiere'),
        path.join(process.env['ProgramFiles(x86)'] || '', 'YT2Premiere', 'exec')
    ]);

    var candidates = [];
    baseDirs.forEach(function(baseDir) {
        candidates.push(path.join(baseDir, 'YT2Premiere.exe'));
        candidates.push(path.join(baseDir, 'exec', 'YT2Premiere.exe'));
    });

    for (var k = 0; k < candidates.length; k++) {
        var candidate = candidates[k];
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }

    return null;
}

function launchBackend() {
    if (os.platform() === 'darwin') {
        var macExecutablePath = path.join(execPath, 'YT2Premiere');
        if (!fs.existsSync(macExecutablePath)) {
            console.error('YT2Premiere backend not found for macOS:', macExecutablePath);
            return;
        }
        var appleScriptCommand = 'tell application "Finder" to launch application "' + macExecutablePath + '"';
        exec("osascript -e '" + appleScriptCommand + "' -e 'delay 2' -e 'tell application \"System Events\" to set visible of process \"YT2Premiere\" to false'", function(err, stdout, stderr) {
            if (err) {
                console.error('Error executing command:', err);
            }
            if (stdout) {
                console.log('Output:', stdout);
            }
            if (stderr) {
                console.error('Error output:', stderr);
            }
        });
    } else if (os.platform() === 'win32') {
        var winExecutablePath = getWindowsBackendPath();
        if (!winExecutablePath) {
            console.error('YT2Premiere backend not found. Checked registry, installed locations and YT2PREMIERE_HOME.');
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
        console.log('YT2Premiere backend already running');
        return;
    }
    launchBackend();
});
