(function () {
  function byId(id) {
    return document.getElementById(id);
  }

  var bridgeStateNode = byId('bridge-state');
  var desktopStateNode = byId('desktop-state');
  var projectStateNode = byId('project-state');
  var portNode = byId('bridge-port');
  var queueNode = byId('queue-list');
  var historyNode = byId('history-list');
  var errorNode = byId('error-banner');

  var serverHost = '127.0.0.1';
  var portCandidates = [3000, 3021, 3022, 3023, 3024, 3025];
  var currentPanelPort = null;
  var heartbeatTimer = null;
  var refreshTimer = null;
  var historyLookup = {};
  var fs = null;
  var http = null;
  var path = null;
  var activePortFile = null;
  var themeListenerRegistered = false;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function mixChannel(channel, target, amount) {
    return Math.round(channel + (target - channel) * amount);
  }

  function rgbString(color) {
    return 'rgb(' + color.red + ', ' + color.green + ', ' + color.blue + ')';
  }

  function luminance(color) {
    return (0.299 * color.red + 0.587 * color.green + 0.114 * color.blue) / 255;
  }

  function deriveSurface(color, amount, lighten) {
    return {
      red: mixChannel(color.red, lighten ? 255 : 0, amount),
      green: mixChannel(color.green, lighten ? 255 : 0, amount),
      blue: mixChannel(color.blue, lighten ? 255 : 0, amount)
    };
  }

  function applyHostTheme() {
    try {
      var cs = new CSInterface();
      var skin = cs.hostEnvironment && cs.hostEnvironment.appSkinInfo;
      var color = skin && skin.panelBackgroundColor && skin.panelBackgroundColor.color;
      if (!color) {
        return;
      }

      var isDark = luminance(color) < 0.52;
      var surface = deriveSurface(color, isDark ? 0.08 : 0.05, !isDark);
      var surface2 = deriveSurface(color, isDark ? 0.14 : 0.1, !isDark);
      var text = isDark ? '#f2f2f2' : '#1f1f1f';
      var muted = isDark ? '#b7b7b7' : '#5d5d5d';
      var border = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.12)';

      document.documentElement.style.setProperty('--host-bg', rgbString(color));
      document.documentElement.style.setProperty('--host-surface', rgbString(surface));
      document.documentElement.style.setProperty('--host-surface-2', rgbString(surface2));
      document.documentElement.style.setProperty('--host-text', text);
      document.documentElement.style.setProperty('--host-muted', muted);
      document.documentElement.style.setProperty('--host-border', border);

      if (!themeListenerRegistered) {
        themeListenerRegistered = true;
        var themeEvent =
          (window.CSInterface && window.CSInterface.THEME_COLOR_CHANGED_EVENT) ||
          'com.adobe.csxs.events.ThemeColorChanged';
        cs.addEventListener(themeEvent, function () {
          applyHostTheme();
        });
      }
    } catch (_error) {}
  }

  function setFatalError(message) {
    if (!errorNode) {
      return;
    }
    errorNode.style.display = 'block';
    errorNode.textContent = message;
  }

  window.addEventListener('error', function () {
    setFatalError('The Premiere panel ran into an error. Close and reopen it in Premiere.');
  });

  window.addEventListener('unhandledrejection', function () {
    setFatalError('The Premiere panel could not finish loading. Close and reopen it in Premiere.');
  });

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderEmpty(node, message) {
    if (!node) {
      return;
    }
    node.innerHTML = '<div class="empty">' + escapeHtml(message) + '</div>';
  }

  function stageLabel(stage) {
    var labels = {
      preparing: 'Starting',
      resolving: 'Resolving media',
      downloading: 'Downloading',
      clipping: 'Finishing',
      importing: 'Adding to Premiere',
      complete: 'Done',
      failed: 'Error'
    };
    var normalized = String(stage || '').toLowerCase();
    return labels[normalized] || 'Working';
  }

  function percentValue(label) {
    var parsed = parseFloat(String(label || '').replace('%', '').trim());
    return isFinite(parsed) ? clamp(parsed, 0, 100) : 0;
  }

  function setPill(node, label, tone) {
    if (!node) {
      return;
    }

    var dotClass = 'dot';
    if (tone === 'ok') {
      dotClass = 'dot ok';
    } else if (tone === 'error') {
      dotClass = 'dot error';
    }

    node.innerHTML =
      '<span class="' + dotClass + '"></span><span>' + escapeHtml(label) + '</span>';
  }

  function setPanelPort(port) {
    if (portNode) {
      portNode.textContent = port ? String(port) : '--';
    }
  }

  function readBackendDescriptor() {
    try {
      if (!fs || !activePortFile || !fs.existsSync(activePortFile)) {
        return null;
      }
      var data = JSON.parse(fs.readFileSync(activePortFile, 'utf8'));
      var port = parseInt(data && data.port, 10);
      if (!isFinite(port)) {
        return null;
      }

      return {
        port: port,
        cepToken: typeof data.cepToken === 'string' ? data.cepToken.trim() : ''
      };
    } catch (_error) {
      return null;
    }
  }

  function requestJson(pathname, callback) {
    var backend = readBackendDescriptor();
    if (!backend || !http) {
      callback(new Error('Desktop app not ready'));
      return;
    }

    var req = http.request(
      {
        hostname: serverHost,
        port: backend.port,
        path: pathname,
        method: 'GET',
        timeout: 1500,
        headers: {
          'X-YT2PP-CEP': '1',
          'X-YT2PP-CEP-Token': backend.cepToken
        }
      },
      function (res) {
        var body = '';
        res.on('data', function (chunk) {
          body += chunk;
        });
        res.on('end', function () {
          try {
            callback(null, JSON.parse(body || '{}'));
          } catch (error) {
            callback(error);
          }
        });
      }
    );

    req.on('error', function (error) {
      callback(error);
    });

    req.on('timeout', function () {
      req.destroy();
      callback(new Error('Request timed out'));
    });

    req.end();
  }

  function registerCepBridge() {
    if (!currentPanelPort || !http) {
      return;
    }

    var backend = readBackendDescriptor();
    if (!backend) {
      setPill(desktopStateNode, 'Waiting', 'warn');
      setPill(projectStateNode, 'Waiting for desktop', 'warn');
      return;
    }

    var payload = JSON.stringify({ port: currentPanelPort });
    var req = http.request(
      {
        hostname: serverHost,
        port: backend.port,
        path: '/register-cep',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          'X-YT2PP-CEP': '1',
          'X-YT2PP-CEP-Token': backend.cepToken
        },
        timeout: 1500
      },
      function (res) {
        res.resume();
        setPill(desktopStateNode, res.statusCode === 200 ? 'Connected' : 'Waiting', res.statusCode === 200 ? 'ok' : 'warn');
      }
    );

    req.on('error', function () {
      setPill(desktopStateNode, 'Waiting', 'warn');
    });

    req.on('timeout', function () {
      req.destroy();
      setPill(desktopStateNode, 'Waiting', 'warn');
    });

    req.write(payload);
    req.end();
  }

  function renderQueue(items) {
    if (!items || !items.length) {
      renderEmpty(queueNode, 'No downloads are active right now.');
      return;
    }

    queueNode.innerHTML = items
      .map(function (item) {
        var percentage = percentValue(item.percentage);
        var indeterminate = !!item.indeterminate;
        var historyItem = historyLookup[item.requestId] || {};
        var detailParts = [];

        if (item.speed) {
          detailParts.push(escapeHtml(item.speed));
        }
        if (item.eta) {
          detailParts.push('ETA ' + escapeHtml(item.eta));
        }
        if (item.detail) {
          detailParts.push(escapeHtml(item.detail));
        }

        return (
          '<div class="item">' +
          '<div class="item-top">' +
          '<div>' +
          '<div class="item-title">' +
          escapeHtml(historyItem.title || item.requestId) +
          '</div>' +
          '<div class="item-meta">' +
          escapeHtml(stageLabel(item.stage)) +
          (detailParts.length ? ' - ' + detailParts.join(' - ') : '') +
          '</div>' +
          '</div>' +
          '<div class="badge">' +
          escapeHtml(item.percentage || stageLabel(item.stage)) +
          '</div>' +
          '</div>' +
          '<div class="progress-shell"><div class="progress-bar' +
          (indeterminate ? ' indeterminate' : '') +
          '" style="transform: scaleX(' +
          (indeterminate ? '1' : String((percentage / 100).toFixed(4))) +
          ');"></div></div>' +
          '</div>'
        );
      })
      .join('');
  }

  function renderHistory(items) {
    if (!items || !items.length) {
      renderEmpty(historyNode, 'Recent results will appear here.');
      return;
    }

    historyNode.innerHTML = items
      .map(function (item) {
        var badgeClass = 'badge';
        var label = stageLabel(item.status);

        if (item.status === 'complete') {
          badgeClass = 'badge badge-ok';
          label = 'Done';
        } else if (item.status === 'failed') {
          badgeClass = 'badge badge-error';
          label = 'Error';
        }

        return (
          '<div class="item">' +
          '<div class="item-top">' +
          '<div>' +
          '<div class="item-title">' +
          escapeHtml(item.title || item.url || 'Download') +
          '</div>' +
          '<div class="item-meta">' +
          escapeHtml(item.outputPath || item.url || '') +
          '</div>' +
          '</div>' +
          '<div class="' +
          badgeClass +
          '">' +
          escapeHtml(label) +
          '</div>' +
          '</div>' +
          '</div>'
        );
      })
      .join('');
  }

  function refreshPremiereStatus() {
    requestJson('/premiere-status', function (error, data) {
      if (error) {
        setPill(desktopStateNode, 'Waiting', 'warn');
        setPill(projectStateNode, 'Waiting for desktop', 'warn');
        return;
      }

      setPill(desktopStateNode, data.cepRegistered ? 'Connected' : 'Waiting', data.cepRegistered ? 'ok' : 'warn');

      if (data.canImport) {
        setPill(projectStateNode, data.projectSaved ? 'Ready' : 'Import ready', 'ok');
      } else if (data.reason) {
        setPill(projectStateNode, String(data.reason), data.running ? 'warn' : 'error');
      } else {
        setPill(projectStateNode, 'Waiting for Premiere', 'warn');
      }
    });
  }

  function refreshQueue() {
    requestJson('/active-downloads', function (error, data) {
      if (error) {
        renderEmpty(queueNode, 'Waiting for the desktop app...');
        return;
      }
      renderQueue(data.items || []);
    });
  }

  function refreshHistory() {
    requestJson('/history?page=1&pageSize=5', function (error, data) {
      if (error) {
        renderEmpty(historyNode, 'Waiting for recent downloads...');
        return;
      }

      var items = data.items || [];
      historyLookup = {};
      for (var index = 0; index < items.length; index += 1) {
        historyLookup[items[index].requestId] = items[index];
      }

      renderHistory(
        items.filter(function (item) {
          return item.status === 'complete' || item.status === 'failed';
        }).slice(0, 5)
      );
    });
  }

  function refreshAll() {
    refreshPremiereStatus();
    refreshQueue();
    refreshHistory();
  }

  function startHeartbeat() {
    registerCepBridge();
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
    }
    heartbeatTimer = setInterval(registerCepBridge, 5000);
  }

  function startRefreshLoop() {
    refreshAll();
    if (refreshTimer) {
      clearInterval(refreshTimer);
    }
    refreshTimer = setInterval(refreshAll, 2000);
  }

  function handleConnection(req, res) {
    res.statusCode = 200;
    var backend = readBackendDescriptor();
    var expectedToken = backend && backend.cepToken ? String(backend.cepToken) : '';
    var providedToken = '';

    if (req && req.headers) {
      providedToken = String(req.headers['x-yt2pp-cep-token'] || '');
    }

    if (!expectedToken || providedToken !== expectedToken) {
      res.statusCode = 403;
      res.end('FORBIDDEN');
      return;
    }

    if (req.method === 'GET') {
      res.setHeader('Content-Type', 'text/plain');
      res.end('Premiere bridge ready');
      return;
    }

    if (req.method === 'POST') {
      var chunks = [];
      req.on('data', function (chunk) {
        chunks.push(chunk);
      });
      req.on('end', function () {
        try {
          var payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          var cs = new CSInterface();
          cs.evalScript(payload.to_eval, function (result) {
            res.setHeader('Content-Type', 'text/plain');
            res.end(result);
          });
        } catch (_error) {
          res.statusCode = 500;
          res.end('ERROR');
        }
      });
      return;
    }

    res.end('OK');
  }

  function listenOnNextPort(index) {
    if (index >= portCandidates.length) {
      setPill(bridgeStateNode, 'Unavailable', 'error');
      setFatalError('The panel could not open its local bridge. Close and reopen the panel in Premiere.');
      return;
    }

    var port = portCandidates[index];
    var server = http.createServer(handleConnection);

    server.on('error', function (error) {
      if (error && error.code === 'EADDRINUSE') {
        listenOnNextPort(index + 1);
        return;
      }

      setPill(bridgeStateNode, 'Unavailable', 'error');
      setFatalError('The Premiere panel could not start correctly.');
    });

    server.listen(port, serverHost, function () {
      currentPanelPort = port;
      setPanelPort(port);
      setPill(bridgeStateNode, 'Ready', 'ok');
      startHeartbeat();
      startRefreshLoop();
    });
  }

  function boot() {
    try {
      fs = require('fs');
      http = require('http');
      path = require('path');
      activePortFile = path.join(process.env.APPDATA || '', 'YT2Premiere', 'active_port.json');
    } catch (_error) {
      setFatalError('The Premiere panel could not access its local bridge. Close and reopen it in Premiere.');
      return;
    }

    applyHostTheme();
    setPill(bridgeStateNode, 'Starting', 'warn');
    setPill(desktopStateNode, 'Waiting', 'warn');
    setPill(projectStateNode, 'Waiting for Premiere', 'warn');
    setPanelPort(null);
    renderEmpty(queueNode, 'Waiting for the desktop app...');
    renderEmpty(historyNode, 'Recent results will appear here.');
    listenOnNextPort(0);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}());
