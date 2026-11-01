/**
 * 全局常量定义
 */

module.exports = {
  // 应用信息
  APP_NAME: '大肥豆插件',
  APP_VERSION: '0.2.0',
  APP_ID: 'doubao-nailoong-widget',

  // 豆包相关
  DOUBAO_PROCESS_NAMES: ['DouBao', 'doubao', '豆包'],
  DOUBAO_CDP_PORT_RANGE: [9222, 9250],

  // 窗口尺寸
  WINDOW_WIDTH: 340,
  WINDOW_HEIGHT: 500,
  CHARACTER_SIZE: 200,

  // 性能参数
  QUOTA_POLL_INTERVAL: 30000,        // 30秒
  WINDOW_FOLLOW_INTERVAL: 100,       // 100ms
  HEALTH_CHECK_INTERVAL: 15000,      // 15秒

  // 状态定义
  PERSISTENT_STATES: ['idle', 'thinking', 'warning', 'error', 'offline'],
  TRANSIENT_STATES: ['pressed', 'dragged', 'release', 'petting', 'success'],

  // 角色形态
  FORMS: {
    DOUBAO: 'doubao',
    NAILOONG: 'nailoong'
  },

  // 表情
  EXPRESSIONS: {
    IDLE: 'idle',
    THINKING: 'thinking',
    HAPPY: 'happy',
    WARNING: 'warning',
    PROUD: 'proud',
    CRYING: 'crying',
    ANGRY: 'angry'
  },

  // 额度阈值
  QUOTA_THRESHOLDS: {
    CRITICAL: 10,     // 10%以下为严重
    WARNING: 20,      // 20%以下为警告
    LOW: 50,          // 50%以下为偏低
    GOOD: 80          // 80%以上为良好
  },

  // 台词分类
  DIALOGUE_CATEGORIES: [
    'greeting',
    'working',
    'idle',
    'warning',
    'quota',
    'easter_egg'
  ],

  // 默认设置
  DEFAULT_SETTINGS: {
    scale: 1.0,
    cdpPort: 0,
    hostDock: 'right',hostOffsetX:0,hostOffsetY:0,
    desktopDock:'right',desktopArtShift:0,facing:'right',
    alwaysOnTop: true,
    clickThrough: false,
    hostWindowOnly: false,
    defaultForm: 'doubao',
    autoSwitchForm: true,
    bubbleOn: true,
    sound: true,
    volume: 0.5,
    warningThreshold: 20,
    dialogueFrequency: 'medium'
  }
};
