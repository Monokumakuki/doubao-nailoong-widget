/**
 * 挂件状态机
 * 管理持久状态和瞬态状态，协调各组件行为
 */

const { EventEmitter } = require('events');
const { Logger } = require('../shared/logger');
const { PERSISTENT_STATES, TRANSIENT_STATES } = require('../shared/constants');

class WidgetStateMachine extends EventEmitter {
  constructor(options = {}) {
    super();
    this.logger = new Logger('StateMachine', options.logger);

    // 持久状态：业务逻辑状态，长期保持
    this.persistentState = 'idle';

    // 瞬态状态：交互状态，短暂存在
    this.transientState = null;
    this.transientTimer = null;

    // 上次交互时间
    this.lastInteractionTime = Date.now();
    this.idleThreshold = options.idleThreshold || 30000; // 30秒无操作视为闲置

    // 冷却时间
    this.lastPettingTime = 0;
    this.pettingCooldown = 12000; // 12秒

    this.lastSuccessTime = 0;
    this.successCooldown = 3000; // 3秒
  }

  /**
   * 获取当前有效状态
   * 瞬态状态优先于持久状态
   */
  getCurrentState() {
    return this.transientState || this.persistentState;
  }

  /**
   * 获取持久状态
   */
  getPersistentState() {
    return this.persistentState;
  }

  /**
   * 设置持久状态
   */
  setPersistentState(newState) {
    if (!PERSISTENT_STATES.includes(newState)) {
      this.logger.warn('Invalid persistent state:', newState);
      return false;
    }

    if (this.persistentState === newState) {
      return false;
    }

    const oldState = this.persistentState;
    this.persistentState = newState;

    this.logger.info('Persistent state changed:', oldState, '→', newState);
    this.emit('state-change', {
      persistent: newState,
      transient: this.transientState,
      current: this.getCurrentState()
    });

    return true;
  }

  /**
   * 触发瞬态状态
   */
  triggerTransient(state, duration) {
    if (!TRANSIENT_STATES.includes(state)) {
      this.logger.warn('Invalid transient state:', state);
      return false;
    }

    // 清除之前的瞬态定时器
    if (this.transientTimer) {
      clearTimeout(this.transientTimer);
      this.transientTimer = null;
    }

    this.transientState = state;
    this.logger.debug('Transient state triggered:', state, 'for', duration, 'ms');

    this.emit('state-change', {
      persistent: this.persistentState,
      transient: state,
      current: state
    });

    // 设置自动恢复
    if (duration > 0) {
      this.transientTimer = setTimeout(() => {
        this._clearTransient();
      }, duration);
    }

    return true;
  }

  /**
   * 清除瞬态状态
   */
  _clearTransient() {
    if (!this.transientState) return;

    const oldTransient = this.transientState;
    this.transientState = null;

    if (this.transientTimer) {
      clearTimeout(this.transientTimer);
      this.transientTimer = null;
    }

    this.logger.debug('Transient state cleared:', oldTransient);
    this.emit('state-change', {
      persistent: this.persistentState,
      transient: null,
      current: this.persistentState
    });
  }

  /**
   * 处理鼠标按下
   */
  handlePointerDown() {
    this.lastInteractionTime = Date.now();
    this.triggerTransient('pressed', 0); // 持续到释放
    this.logger.debug('Pointer down');
  }

  /**
   * 处理鼠标释放
   */
  handlePointerUp() {
    const pressDuration = Date.now() - this.lastInteractionTime;

    if (this.transientState === 'dragged') {
      // 拖动结束
      this._clearTransient();
    } else if (this.transientState === 'pressed') {
      // 短按，播放释放动画
      this.triggerTransient('release', 560);
    }

    this.logger.debug('Pointer up, duration:', pressDuration);
  }

  /**
   * 处理拖动开始
   */
  handleDragStart() {
    this.lastInteractionTime = Date.now();
    this.triggerTransient('dragged', 0);
    this.logger.debug('Drag started');
  }

  /**
   * 处理拖动结束
   */
  handleDragEnd() {
    if (this.transientState === 'dragged') {
      this._clearTransient();
    }
    this.logger.debug('Drag ended');
  }

  /**
   * 处理抚摸（长按）
   */
  handlePetting() {
    const now = Date.now();

    // 冷却检查
    if (now - this.lastPettingTime < this.pettingCooldown) {
      this.logger.debug('Petting on cooldown');
      return false;
    }

    this.lastPettingTime = now;
    this.lastInteractionTime = now;
    this.triggerTransient('petting', 1600);

    this.logger.info('Petting triggered');
    return true;
  }

  /**
   * 处理任务成功
   */
  handleSuccess() {
    const now = Date.now();

    // 冷却检查
    if (now - this.lastSuccessTime < this.successCooldown) {
      return false;
    }

    // 不打断 thinking 或其他瞬态
    if (this.transientState === 'pressed' || 
        this.transientState === 'dragged' ||
        this.persistentState === 'thinking') {
      return false;
    }

    this.lastSuccessTime = now;
    this.triggerTransient('success', 720);

    this.logger.info('Success triggered');
    return true;
  }

  /**
   * 根据额度更新状态
   */
  updateByQuota(quota, threshold = 20) {
    if (!quota || !quota.online) {
      this.setPersistentState('offline');
      return;
    }

    // 从离线恢复
    if (this.persistentState === 'offline') {
      this.setPersistentState('idle');
    }

    // 额度警告
    const known = [quota.fiveHour, quota.weekly].filter(Number.isFinite);
    const avgQuota = known.length && !quota.stale ? Math.min(...known) : null;
    if (avgQuota !== null && avgQuota <= threshold) {
      if (this.persistentState !== 'warning') {
        this.setPersistentState('warning');
      }
    } else if (this.persistentState === 'warning') {
      // 额度恢复，退出警告状态
      this.setPersistentState('idle');
    }
  }

  /**
   * 获取平均额度
   */
  _getAverageQuota(quota) {
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
   * 检查是否闲置
   */
  checkIdle() {
    const elapsed = Date.now() - this.lastInteractionTime;

    if (elapsed > this.idleThreshold) {
      if (this.persistentState !== 'idle' && 
          this.persistentState !== 'offline' &&
          this.persistentState !== 'warning') {
        this.setPersistentState('idle');
      }
    }
  }

  /**
   * 设置工作中状态
   */
  setWorking() {
    this.setPersistentState('thinking');
  }

  /**
   * 设置错误状态
   */
  setError() {
    this.setPersistentState('error');
  }

  /**
   * 重置为闲置状态
   */
  reset() {
    this.setPersistentState('idle');
    this._clearTransient();
    this.lastInteractionTime = Date.now();
  }

  /**
   * 获取状态快照
   */
  getSnapshot() {
    return {
      persistent: this.persistentState,
      transient: this.transientState,
      current: this.getCurrentState(),
      lastInteraction: this.lastInteractionTime,
      isIdle: Date.now() - this.lastInteractionTime > this.idleThreshold
    };
  }

  /**
   * 销毁状态机
   */
  destroy() {
    if (this.transientTimer) {
      clearTimeout(this.transientTimer);
      this.transientTimer = null;
    }
    this.removeAllListeners();
  }
}

module.exports = { WidgetStateMachine };
