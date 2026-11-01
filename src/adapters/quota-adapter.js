/**
 * 豆包额度读取适配器
 * 连接豆包客户端并读取五小时和每周额度
 */

const { EventEmitter } = require('events');
const { CdpClient } = require('../shared/cdp-client');
const { HostDiscoverService } = require('./host-discover');
const { Logger } = require('../shared/logger');
const { QUOTA_POLL_INTERVAL } = require('../shared/constants');

/**
 * 在豆包页面中执行的额度读取函数
 * 这个函数会被注入到豆包客户端执行
 */
function readQuotaFunction() {
  const result = {fiveHour: null, weekly: null, fetchedAt: null, cacheAvailable: false};
  const valid = n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100;
  const accept = (data, ratio = false) => {
    if (!data || typeof data !== 'object') return false;
    for (const [key, value] of [['fiveHour', ratio ? data.fiveHourRemaining : data.fiveHour], ['weekly', ratio ? data.weeklyRemaining : data.weekly]]) {
      const n = ratio && typeof value === 'number' ? value * 100 : value;
      if (valid(n)) result[key] = n;
    }
    result.cacheAvailable = result.fiveHour !== null || result.weekly !== null;
    if (result.cacheAvailable) result.fetchedAt = Number.isFinite(data.fetchedAt) && data.fetchedAt <= Date.now() ? data.fetchedAt : Date.now();
    return result.cacheAvailable;
  };
  // Verified official quota-management markup: values say 已用, so invert the ratio.
  const docs=[document];
  for(const frame of Array.from(document.querySelectorAll('iframe')).slice(0,10)) {
    try { if(frame.contentDocument && /\/member\/quota-management/.test(frame.src))docs.push(frame.contentDocument); } catch {}
  }
  for(const doc of docs) {
    for(const el of Array.from(doc.querySelectorAll('div,span')).slice(0,20000)) {
      if(el.children.length)continue;
      const label=(el.textContent||'').trim();
      const key=label==='当前时段'?'fiveHour':/^(?:近|最近)\s*7\s*天$/.test(label)?'weekly':null;
      if(!key)continue;
      const row=el.parentElement;
      const match=(row?.textContent||'').match(/已用\s*([\d,]+(?:\.\d+)?)\s*\/\s*([\d,]+(?:\.\d+)?)/);
      if(!match)continue;
      const used=Number(match[1].replace(/,/g,'')),total=Number(match[2].replace(/,/g,''));
      if(Number.isFinite(used)&&Number.isFinite(total)&&total>0&&used>=0&&used<=total)result[key]=(1-used/total)*100;
    }
  }
  if(result.fiveHour!==null||result.weekly!==null){result.cacheAvailable=true;result.fetchedAt=Date.now();result.source='official-quota-panel';return result;}

  if (accept(window.__DOUBAO_QUOTA__)) return result;
  const visited = new Set();
  const stack = [];
  for (const element of Array.from(document.querySelectorAll('#root, #app, body > div')).slice(0, 20)) {
    const key = Object.keys(element).find(k => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance'));
    if (key) stack.push(element[key]);
  }
  let budget = 2000;
  while (stack.length && budget-- > 0) {
    const fiber = stack.pop();
    if (!fiber || visited.has(fiber)) continue;
    visited.add(fiber);
    let hook = fiber.memoizedState;
    for (let i = 0; hook && i < 100; i++, hook = hook.next) {
      if (accept(hook.memoizedState, true)) return result;
    }
    stack.push(fiber.child, fiber.sibling);
  }
  for (const el of Array.from(document.querySelectorAll('[data-quota], [class*="quota"], [class*="usage"]')).slice(0, 200)) {
    const text = [el.getAttribute('aria-label'), el.title, el.textContent].filter(Boolean).join(' ');
    if (!/剩余|remaining/i.test(text)) continue;
    const percentages = [...text.matchAll(/(\d+(?:\.\d+)?)\s*%/g)];
    if (percentages.length !== 1) continue;
    const n = Number(percentages[0][1]);
    if (!valid(n)) continue;
    if (/(?:5|五)\s*(?:小时|hours?)/i.test(text) && !/每周|weekly/i.test(text)) result.fiveHour = n;
    else if (/每周|本周|weekly/i.test(text) && !/(?:5|五)\s*(?:小时|hours?)/i.test(text)) result.weekly = n;
  }
  result.cacheAvailable = result.fiveHour !== null || result.weekly !== null;
  if (result.cacheAvailable) result.fetchedAt = Date.now();
  return result;
}

class QuotaAdapter extends EventEmitter {
  constructor(options = {}) {
    super();
    this.logger = new Logger('QuotaAdapter', options.logger);
    this.discoverService = options.discoverService || new HostDiscoverService(options);
    this.cdpClient = null;
    this.active = false;
    this.pollTimer = null;
    this.pollInterval = options.pollInterval || QUOTA_POLL_INTERVAL;
    
    // 当前额度快照
    this.snapshot = {
      fiveHour: null,
      weekly: null,
      fetchedAt: null,
      online: false,
      cached: false,
      stale: false
    };

    // 上次读取时间
    this.lastSampleTime = null;
    // 宿主标识（用于检测宿主切换）
    this.hostIdentity = null;
  }

  /**
   * 启动额度监控
   */
  start() {
    if (this.active) {
      this.logger.warn('QuotaAdapter already started');
      return;
    }

    this.stopped = false;
    this.active = true;
    this.logger.info('Starting quota monitoring');
    
    // 立即执行一次
    this.tick();

    // 定期轮询
    this.pollTimer = setInterval(() => {
      this.tick();
    }, this.pollInterval);
  }

  /**
   * 停止额度监控
   */
  stop() {
    this.stopped = true;
    this.hiddenBrowser?.close();
    this.active = false;
    this.logger.info('Stopping quota monitoring');

    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    if (this.cdpClient) {
      this.cdpClient.close();
      this.cdpClient = null;
    }
  }

  /**
   * 执行一次额度读取
   */
  async tick() {
    if (this.stopped) return;
    if (this.inFlight) return this.inFlight;
    this.inFlight = this._tick().finally(() => { this.inFlight = null; });
    return this.inFlight;
  }

  async _tick() {
    try {
      // 步骤1: 发现宿主
      const host = await this.discoverService.discover();
      if (this.stopped) return;
      
      if (!host) {
        // 宿主离线
        this.snapshot = {
          ...this.snapshot,
          online: false,
          cached: this.lastSampleTime !== null,
          stale: this.lastSampleTime !== null
        };
        this.emit('change', this.snapshot);
        
        if (this.cdpClient) {
          this.cdpClient.close();
          this.cdpClient = null;
        }
        return;
      }

      // 步骤2: 检测宿主切换
      if (this.hostIdentity && this.hostIdentity !== host.wsUrl) {
        this.logger.info('Host changed, clearing cache');
        this.snapshot = {
          fiveHour: null,
          weekly: null,
          fetchedAt: null,
          online: false,
          cached: false,
          stale: false
        };
        this.lastSampleTime = null;
      }
      this.hostIdentity = host.wsUrl;

      if (this.cdpClient && this.cdpClient.wsUrl !== host.wsUrl) { this.cdpClient.close(); this.cdpClient = null; }
      // 步骤3: 建立 CDP 连接
      if (!this.cdpClient || !this.cdpClient.isConnected()) {
        if (this.cdpClient) {
          this.cdpClient.close();
        }
        this.cdpClient = new CdpClient(host.wsUrl, { logger: this.logger });
        await this.cdpClient.connect();
        if (this.stopped) { this.cdpClient?.close(); this.cdpClient = null; return; }
      }

      // 步骤4: 执行额度读取
      let quotaData = await this.cdpClient.evaluate(
        `(${readQuotaFunction.toString()})()`
      );

      // A genuine hidden target runs the official subscription page in the host session.
      // No avatar/menu clicks, visible iframe injection, private RPC or stored credentials.
      if(host.ownedPort){
        try {const hidden=await this._readHiddenQuota(host);if(hidden?.cacheAvailable)quotaData=hidden;}
        catch(err){this.logger.warn('Background quota unavailable:',err.message);}
      }
      // 步骤5: 处理结果
      if (!quotaData.cacheAvailable) {
        // 没有可用缓存
        if (this.lastSampleTime !== null) {
          // 保留上次的数据，但标记为可能过期
          const elapsed = Date.now() - this.lastSampleTime;
          this.snapshot = {
            ...this.snapshot,
            online: true,
            cached: true,
            stale: elapsed >= 300000 // 5分钟
          };
        } else {
          // 从未获取过数据
          this.snapshot = {
            fiveHour: null,
            weekly: null,
            fetchedAt: null,
            online: true,
            cached: false,
            stale: false
          };
        }
      } else {
        // 有可用数据
        if (typeof quotaData.fiveHour === 'number' || typeof quotaData.weekly === 'number') {
          this.lastSampleTime = Number.isFinite(quotaData.fetchedAt) && quotaData.fetchedAt <= Date.now() ? quotaData.fetchedAt : Date.now();
        }

        this.snapshot = {
          fiveHour: this._validateQuota(quotaData.fiveHour),
          weekly: this._validateQuota(quotaData.weekly),
          fetchedAt: quotaData.fetchedAt,
          source: quotaData.source || null,
          online: true,
          cached: false,
          stale: Number.isFinite(quotaData.fetchedAt) && Date.now() - quotaData.fetchedAt >= 300000
        };
      }

      this.emit('change', this.snapshot);

    } catch (err) {
      this.logger.error('Failed to read quota:', err);
      
      // 读取失败，标记为离线但保留缓存
      this.snapshot = {
        ...this.snapshot,
        online: false,
        cached: this.lastSampleTime !== null,
        stale: this.lastSampleTime !== null
      };
      
      this.emit('change', this.snapshot);
    }
  }

  /** Hidden targets have session lifetime and are closed after every sample. */
  async _readHiddenQuota(host) {
    const version=await this.discoverService._probeCdpPort(host.cdpPort,'/json/version');
    const endpoint=new URL(version.webSocketDebuggerUrl);
    if(endpoint.protocol!=='ws:'||!['127.0.0.1','localhost','[::1]'].includes(endpoint.hostname))throw new Error('Nonlocal debugger endpoint');
    const browser=new CdpClient(endpoint.href);this.hiddenBrowser=browser;
    let targetId,client;
    try {
      await browser.connect();
      ({targetId}=await browser.send('Target.createTarget',{url:'https://www.doubao.com/member/quota-management?quota_tab=personal&is_setting_iframe=1&theme=light',hidden:true,background:true}));
      endpoint.pathname='/devtools/page/'+encodeURIComponent(targetId);
      client=new CdpClient(endpoint.href);await client.connect();
      let data;
      for(let i=0;i<60&&!this.stopped;i++){
        data=await client.evaluate(`(${readQuotaFunction.toString()})()`);
        if(data.cacheAvailable)return {...data,source:'official-hidden-quota-page'};
        await new Promise(r=>setTimeout(r,100));
      }
      return null;
    } finally {
      client?.close();
      if(targetId&&browser.isConnected())try{await browser.send('Target.closeTarget',{targetId});}catch{}
      browser.close();if(this.hiddenBrowser===browser)this.hiddenBrowser=null;
    }
  }

  /**
   * 验证额度数值
   */
  _validateQuota(value) {
    if (typeof value !== 'number') return null;
    if (!Number.isFinite(value)) return null;
    if (value < 0 || value > 100) return null;
    return value;
  }

  /**
   * 获取当前额度快照
   */
  getSnapshot() {
    return { ...this.snapshot };
  }

  /**
   * 手动触发刷新
   */
  async refresh() {
    await this.tick();
  }
}

module.exports = { QuotaAdapter, readQuotaFunction };
