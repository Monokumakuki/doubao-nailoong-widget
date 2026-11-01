/**
 * 豆包宿主发现服务
 * 自动查找本机运行的豆包进程和 CDP 调试端口
 */

const http = require('http');
const isDouBaoProcessName = name => DOUBAO_PROCESS_NAMES.some(dbName => name.replace(/\.exe$/i, '').toLowerCase() === dbName.toLowerCase());
const { spawn } = require('child_process');
const { Logger } = require('../shared/logger');
const { DOUBAO_PROCESS_NAMES, DOUBAO_CDP_PORT_RANGE } = require('../shared/constants');

class HostDiscoverService {
  constructor(options = {}) {
    this.logger = new Logger('HostDiscover', options.logger);
    this.cachedHost = null;
    this.cacheTimeout = options.cacheTimeout || 5000; // 5秒缓存
    this.lastDiscoverTime = 0;
  }

  /**
   * 发现豆包宿主
   * @returns {Promise<Object|null>} { process, cdpPort, wsUrl, target }
   */
  async discover() {
    // 使用缓存
    const now = Date.now();
    if (this.cachedHost && now - this.lastDiscoverTime < this.cacheTimeout) {
      return this.cachedHost;
    }

    try {
      // 步骤1: 查找豆包进程
      const douBaoProcess = await this._findDouBaoProcess();
      if (!douBaoProcess) {
        this.logger.warn('DouBao process not found');
        this.cachedHost = null;
        return null;
      }

      this.logger.info('Found DouBao process:', douBaoProcess.name, 'PID:', douBaoProcess.pid);

      // Only page targets can run Runtime.evaluate; verify the page origin.
      const [startPort, endPort] = DOUBAO_CDP_PORT_RANGE;
      const ports = new Set(this.manualPort ? [this.manualPort] : []);
      const ownedPorts = new Set();
      const { execFile } = require('child_process');
      const output = await new Promise(resolve => execFile('netstat', ['-ano', '-p', 'tcp'], {windowsHide: true, timeout: 5000}, (err, stdout) => resolve(err ? '' : stdout)));
      for (const line of output.split('\n')) {
        const columns = line.trim().split(/\s+/);
        if (columns[0] === 'TCP' && Number(columns[4]) === douBaoProcess.pid && columns[3] === 'LISTENING') {
          const port = Number(columns[1].split(':').pop());
          if (port) { ports.add(port); ownedPorts.add(port); }
        }
      }
      for (let port = startPort; port <= endPort; port++) ports.add(port);
      for (const port of ports) {
        const targets = await this._probeCdpPort(port);
        const target = Array.isArray(targets) && targets.sort((a,b)=>Number(b.url?.startsWith('doubao://doubao-chat/chat'))-Number(a.url?.startsWith('doubao://doubao-chat/chat'))).find(t => this._isDouBaoTarget(t,ownedPorts.has(port)));
        if (!target) continue;
        const host = {process: douBaoProcess, cdpPort: port, wsUrl: target.webSocketDebuggerUrl, ownedPort:ownedPorts.has(port), target, discoveredAt: now};
        this.cachedHost = host;
        this.lastDiscoverTime = now;
        return host;
      }

      this.logger.warn('CDP port not found in range', startPort, '-', endPort);
      this.cachedHost = null;
      return null;

    } catch (err) {
      this.logger.error('Failed to discover DouBao host:', err);
      this.cachedHost = null;
      return null;
    }
  }

  /**
   * 查找豆包进程（Windows）
   */
  async _findDouBaoProcess() {
    return new Promise((resolve, reject) => {
      if (process.platform !== 'win32') {
        // TODO: 支持 macOS 和 Linux
        reject(new Error('Only Windows is supported currently'));
        return;
      }

      const tasklist = spawn('tasklist', ['/FO', 'CSV', '/NH'], { windowsHide: true, timeout: 5000 });
      let output = '';

      tasklist.stdout.on('data', (data) => {
        output += data.toString();
      });

      tasklist.on('close', (code) => {
        if (code !== 0) {
          reject(new Error('tasklist command failed'));
          return;
        }

        // 解析 CSV 输出
        const lines = output.split('\n');
        for (const line of lines) {
          const match = line.match(/"([^"]+)","([^"]+)"/);
          if (match) {
            const [, name, pid] = match;
            // 检查是否为豆包进程
            if (isDouBaoProcessName(name)) {
              resolve({
                name: name.replace('.exe', ''),
                pid: parseInt(pid)
              });
              return;
            }
          }
        }

        resolve(null);
      });

      tasklist.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * 探测 CDP 端口
   */
  async _probeCdpPort(port, pathname = '/json/list') {
    return new Promise((resolve, reject) => {
      const req = http.get({
        hostname: '127.0.0.1',
        port: port,
        path: pathname,
        timeout: 1000
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const info = JSON.parse(data);
            resolve(info);
          } catch (err) {
            resolve(null);
          }
        });
      });

      req.on('error', () => {
        resolve(null);
      });

      req.on('timeout', () => {
        req.destroy();
        resolve(null);
      });
    });
  }

  /**
   * 判断是否为豆包目标
   */
  _isDouBaoTarget(cdpInfo, ownedPort = false) {
    if (!cdpInfo) return false;

    try {
      const url = new URL(cdpInfo.url);
      const ws = new URL(cdpInfo.webSocketDebuggerUrl);
      const officialWeb=['https:', 'http:'].includes(url.protocol)&&(url.hostname === 'doubao.com' || url.hostname.endsWith('.doubao.com'));
      const officialDesktop=ownedPort && url.protocol==='doubao:' && url.hostname==='doubao-chat' && url.pathname==='/chat';
      return cdpInfo.type === 'page' && (officialWeb || officialDesktop) &&
        ws.protocol === 'ws:' && ['localhost', '127.0.0.1', '[::1]'].includes(ws.hostname);
    } catch { return false; }
  }

  /**
   * 清除缓存
   */
  clearCache() {
    this.cachedHost = null;
    this.lastDiscoverTime = 0;
  }
}

module.exports = { HostDiscoverService, isDouBaoProcessName };
