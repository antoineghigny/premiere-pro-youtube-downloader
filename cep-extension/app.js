var child_process = require('child_process');
var exec = child_process.exec;
var spawn = child_process.spawn;
var fs = require('fs');
var http = require('http');
var os = require('os');
var path = require('path');

var execPath = path.join(__dirname, 'exec');

function isBackendAlive(callback) {
    var req = http.get({
        hostname: '127.0.0.1',
        port: 3001,
        path: '/',
        timeout: 1000
    }, function(res) {
        res.resume();
        callback(res.statusCode === 200);
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

function getWindowsBackendPath() {
    var baseDirs = uniqueNonEmpty([
        process.env.YT2PREMIERE_HOME || '',
        execPath,
        path.join(process.env.LOCALAPPDATA || '', 'Programs', 'YT2Premiere', 'exec'),
        path.join(process.env.ProgramW6432 || '', 'YT2Premiere', 'exec'),
        path.join(process.env.ProgramFiles || '', 'YT2Premiere', 'exec'),
        path.join(process.env['ProgramFiles(x86)'] || '', 'YT2Premiere', 'exec')
    ]);

    var candidates = baseDirs.map(function(baseDir) {
        return path.join(baseDir, 'YT2Premiere.exe');
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
            console.error('YT2Premiere backend not found. Checked installed locations and YT2PREMIERE_HOME.');
            return;
        }
        try {
            var child = spawn(winExecutablePath, [], { detached: true, stdio: 'ignore', windowsHide: true });
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
        console.log('YT2Premiere backend already running on 127.0.0.1:3001');
        return;
    }
    launchBackend();
});
