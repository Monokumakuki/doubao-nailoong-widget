/**
 * 台词管理器
 * 负责加载、选择、记录台词
 */

const fs = require('fs');
const path = require('path');
const { Logger } = require('../shared/logger');

class DialogueManager {
  constructor(options = {}) {
    this.logger = new Logger('DialogueManager', options.logger);
    this.dialogues = [];
    this.recentDialogues = []; // 最近使用的台词
    this.maxRecentCount = 200; // 最多记录20条
    this.currentDialogue = null;
  }

  /**
   * 加载台词库
   */
  async load(languageCode = 'zh-CN') {
    try {
      const dialoguePath = path.join(__dirname, `../../assets/dialogue/${languageCode}.json`);
      const data = fs.readFileSync(dialoguePath, 'utf-8');
      const dialogueData = JSON.parse(data);

      this.dialogues = dialogueData.dialogues || [];
      this.logger.info(`Loaded ${this.dialogues.length} dialogues from ${languageCode}`);

      // 选择初始台词
      this.currentDialogue = this.selectDialogue({ state: 'idle' });

      return true;
    } catch (err) {
      this.logger.error('Failed to load dialogues:', err);
      // 使用默认台词
      this.dialogues = this._getDefaultDialogues();
      this.currentDialogue = this.dialogues[0];
      return false;
    }
  }

  /**
   * 选择台词
   */
  selectDialogue(context = {}) {
    const {
      state = 'idle',
      quota = null,
      form = 'doubao',
      formChange = null,
      force = false
    } = context;

    const previousId=this.currentDialogue?.id;
    // 步骤1: 筛选符合条件的台词
    const candidates = this.dialogues.filter(d => {
      // 检查状态匹配
      if (d.condition.state && !d.condition.state.includes(state)) {
        return false;
      }

      // 检查形态匹配
      if (d.condition.form && d.condition.form !== form) {
        return false;
      }

      // 检查形态切换
      if (d.condition.formChange && d.condition.formChange !== formChange) {
        return false;
      }

      // 检查额度范围
      if (d.condition.quotaRange) {
        const [min, max] = d.condition.quotaRange;
        const avgQuota = this._getAverageQuota(quota);
        if (avgQuota === null || avgQuota < min || avgQuota > max) {
          return false;
        }
      }

      // 检查时间范围
      if (d.condition.timeRange) {
        const hour = new Date().getHours();
        const [start, end] = d.condition.timeRange;
        
        if (start <= end) {
          // 正常范围，如 [6, 9]
          if (hour < start || hour >= end) {
            return false;
          }
        } else {
          // 跨午夜范围，如 [23, 2]
          if (hour < start && hour >= end) {
            return false;
          }
        }
      }

      // 检查冷却时间
      if (!force) {
        const lastUsed = this.recentDialogues.find(r => r.id === d.id);
        if (lastUsed) {
          const elapsed = Date.now() - lastUsed.timestamp;
          if (elapsed < d.cooldown) {
            return false;
          }
        }
      }

      return true;
    });

    // 步骤2: 如果没有候选，使用默认台词
    if (candidates.length === 0) {
      this.logger.debug('No matching dialogues, using fallback');
      this.currentDialogue = this._getFallbackDialogue(state);
      return this.currentDialogue;
    }

    // 步骤3: 权重随机选择
    const fresh=candidates.filter(d=>d.id!==previousId);
    const selected = this._weightedRandom(fresh.length?fresh:candidates);

    // 步骤4: 记录使用
    this._recordUsage(selected);

    this.logger.debug('Selected dialogue:', selected.id, selected.text);
    this.currentDialogue = selected;
    return selected;
  }

  /**
   * 获取平均额度
   */
  _getAverageQuota(quota) {
    if (!quota) return null;

    const fiveHour = quota.fiveHour;
    const weekly = quota.weekly;

    if (fiveHour !== null && fiveHour !== undefined &&
        weekly !== null && weekly !== undefined) {
      return (fiveHour + weekly) / 2;
    }

    if (fiveHour !== null && fiveHour !== undefined) {
      return fiveHour;
    }

    if (weekly !== null && weekly !== undefined) {
      return weekly;
    }

    return null;
  }

  /**
   * 权重随机选择
   */
  _weightedRandom(items) {
    const totalWeight = items.reduce((sum, item) => sum + (item.weight || 1.0), 0);
    let random = Math.random() * totalWeight;

    for (const item of items) {
      random -= item.weight || 1.0;
      if (random <= 0) {
        return item;
      }
    }

    return items[items.length - 1];
  }

  /**
   * 记录台词使用
   */
  _recordUsage(dialogue) {
    // 移除旧记录
    this.recentDialogues = this.recentDialogues.filter(r => r.id !== dialogue.id);

    // 添加新记录
    this.recentDialogues.unshift({
      id: dialogue.id,
      timestamp: Date.now()
    });

    // 限制记录数量
    if (this.recentDialogues.length > this.maxRecentCount) {
      this.recentDialogues = this.recentDialogues.slice(0, this.maxRecentCount);
    }
  }

  /**
   * 获取降级台词
   */
  _getFallbackDialogue(state) {
    const fallbacks = {
      idle: { id: 'fallback_idle', text: '在这里等你哦~', category: 'fallback' },
      thinking: { id: 'fallback_thinking', text: '思考中...', category: 'fallback' },
      warning: { id: 'fallback_warning', text: '注意额度哦', category: 'fallback' },
      offline: { id: 'fallback_offline', text: '离线中...', category: 'fallback' }
    };

    return fallbacks[state] || fallbacks.idle;
  }

  /**
   * 获取默认台词库
   */
  _getDefaultDialogues() {
    return [
      { id: 'default_001', text: '嗨~我是豆包！', category: 'greeting', condition: {}, cooldown: 0, weight: 1.0 },
      { id: 'default_002', text: '有什么可以帮你的吗？', category: 'idle', condition: {}, cooldown: 0, weight: 1.0 },
      { id: 'default_003', text: '正在思考...', category: 'working', condition: {}, cooldown: 0, weight: 1.0 }
    ];
  }

  /**
   * 强制换一句台词
   */
  nextDialogue(context = {}) {
    return this.selectDialogue({ ...context, force: true });
  }

  /**
   * 获取当前台词
   */
  getCurrentDialogue() {
    return this.currentDialogue;
  }

  /**
   * 获取当前台词文本
   */
  getCurrentText() {
    return this.currentDialogue?.text || '你好~';
  }

  /**
   * 根据分类获取台词数量
   */
  getStatsByCategory() {
    const stats = {};
    this.dialogues.forEach(d => {
      const cat = d.category || 'unknown';
      stats[cat] = (stats[cat] || 0) + 1;
    });
    return stats;
  }

  /**
   * 清除使用记录
   */
  clearHistory() {
    this.recentDialogues = [];
    this.logger.info('Dialogue history cleared');
  }
}

module.exports = { DialogueManager };
