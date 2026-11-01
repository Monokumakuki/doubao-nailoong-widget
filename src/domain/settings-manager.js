/**
 * 设置管理器
 * 负责加载、保存、更新设置
 */

const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const { Logger } = require('../shared/logger');
const { DEFAULT_SETTINGS } = require('../shared/constants');

class SettingsManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.logger = new Logger('SettingsManager', options.logger);
    this.configPath = options.configPath;
    this.settings = { ...DEFAULT_SETTINGS };
    this.dirty = false;
  }

  /**
   * 加载设置
   */
  async load() {
    if (!this.configPath) {
      this.logger.warn('No config path specified, using defaults');
      return;
    }

    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf-8');
        const loaded = JSON.parse(data);

        // 合并默认设置和加载的设置
        this.update(loaded);

        this.logger.info('Settings loaded from', this.configPath);
      } else {
        this.logger.info('Config file not found, using defaults');
        // 创建默认配置
        await this.save();
      }
    } catch (err) {
      this.logger.error('Failed to load settings:', err);
      // 使用默认设置
      this.settings = { ...DEFAULT_SETTINGS };
    }
  }

  /**
   * 保存设置
   */
  async save() {
    if (!this.configPath) {
      this.logger.warn('No config path specified, cannot save');
      return false;
    }

    try {
      // 确保目录存在
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // 写入文件
      const data = JSON.stringify(this.settings, null, 2);
      fs.writeFileSync(this.configPath + '.tmp', data, 'utf-8');
      fs.renameSync(this.configPath + '.tmp', this.configPath);

      this.dirty = false;
      this.logger.info('Settings saved to', this.configPath);
      return true;
    } catch (err) {
      this.logger.error('Failed to save settings:', err);
      return false;
    }
  }

  /**
   * 获取设置值
   */
  get(key) {
    return this.settings[key];
  }

  /**
   * 获取所有设置
   */
  getAll() {
    return { ...this.settings };
  }

  /**
   * 设置值
   */
  set(key, value) {
    const oldValue = this.settings[key];
    
    if (oldValue === value) {
      return false;
    }

    if (!this.validate(key, value)) throw new Error('Invalid setting: ' + key);
    this.settings[key] = value;
    this.dirty = true;

    this.logger.debug('Setting changed:', key, oldValue, '→', value);
    this.emit('change', { key, value, oldValue });

    return true;
  }

  /**
   * 批量更新
   */
  update(updates) {
    if (!updates || typeof updates !== 'object' || Array.isArray(updates) || Object.entries(updates).some(([k,v]) => !this.validate(k,v))) throw new Error('Invalid settings');
    const changed = [];

    Object.entries(updates).forEach(([key, value]) => {
      if (this.set(key, value)) {
        changed.push(key);
      }
    });

    if (changed.length > 0) {
      this.emit('batch-change', { changed, settings: this.getAll() });
    }

    return changed;
  }

  /**
   * 重置为默认值
   */
  reset() {
    this.settings = { ...DEFAULT_SETTINGS };
    this.dirty = true;
    this.emit('reset');
    this.logger.info('Settings reset to defaults');
  }

  /**
   * 重置单个设置
   */
  resetKey(key) {
    if (DEFAULT_SETTINGS[key] !== undefined) {
      this.set(key, DEFAULT_SETTINGS[key]);
    }
  }

  /**
   * 检查是否需要保存
   */
  isDirty() {
    return this.dirty;
  }

  /**
   * 验证设置值
   */
  validate(key, value) {
    switch (key) {
      case 'scale':
        return typeof value === 'number' && value >= 0.5 && value <= 2.0;
      case 'volume':
        return typeof value === 'number' && value >= 0 && value <= 1;
      case 'warningThreshold':
        return typeof value === 'number' && value >= 0 && value <= 100;
      case 'alwaysOnTop':
      case 'clickThrough':
      case 'hostWindowOnly':
      case 'autoSwitchForm':
      case 'bubbleOn':
      case 'sound':
        return typeof value === 'boolean';
      case 'defaultForm':
        return value === 'doubao' || value === 'nailoong';
      case 'dialogueFrequency':
        return ['high', 'medium', 'low'].includes(value);
      case 'hostDock':
      case 'desktopDock':
        return ['', 'left','right'].includes(value);
      case 'facing':
        return ['left','right'].includes(value);
      case 'hostOffsetX':
      case 'hostOffsetY':
        return Number.isFinite(value)&&value>=0&&value<100000;
      case 'desktopArtShift':
        return Number.isFinite(value)&&Math.abs(value)<100000;
      case 'x':
      case 'y':
        return Number.isFinite(value) && Math.abs(value) < 100000;
      case 'cdpPort':
        return Number.isInteger(value) && value >= 0 && value <= 65535;
      default:
        return false;
    }
  }

  /**
   * 导出设置
   */
  export() {
    return JSON.stringify(this.settings, null, 2);
  }

  /**
   * 导入设置
   */
  import(jsonString) {
    try {
      const imported = JSON.parse(jsonString);
      this.update(imported);
      this.dirty = true;
      this.emit('import');
      this.logger.info('Settings imported');
      return true;
    } catch (err) {
      this.logger.error('Failed to import settings:', err);
      return false;
    }
  }
}

module.exports = { SettingsManager };
