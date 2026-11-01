/**
 * 日志工具
 * 提供分级日志记录功能
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

class Logger {
  constructor(namespace, options = {}) {
    this.namespace = namespace;
    this.logDir = options.logDir || path.join(os.homedir(), '.doubao-nailoong-widget', 'logs');
    this.logFile = options.logFile || 'widget.log';
    this.level = options.level || 'info';
    
    // 确保日志目录存在
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
    } catch (err) {
      console.error('Failed to create log directory:', err);
    }
  }

  _log(level, ...args) {
    const timestamp = new Date().toISOString();
    const message = args.map(arg => 
      arg instanceof Error ? (arg.stack || arg.message) : typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');
    
    const logLine = `[${timestamp}] [${level.toUpperCase()}] [${this.namespace}] ${message}\n`;
    
    // 输出到控制台
    const consoleMethod = level === 'error' ? console.error : 
                         level === 'warn' ? console.warn : console.log;
    consoleMethod(logLine.trim());
    
    // 写入文件
    try {
      fs.appendFileSync(path.join(this.logDir, this.logFile), logLine);
    } catch (err) {
      console.error('Failed to write log:', err);
    }
  }

  debug(...args) {
    if (this.level === 'debug') {
      this._log('debug', ...args);
    }
  }

  info(...args) {
    if (['debug', 'info'].includes(this.level)) {
      this._log('info', ...args);
    }
  }

  warn(...args) {
    if (['debug', 'info', 'warn'].includes(this.level)) {
      this._log('warn', ...args);
    }
  }

  error(...args) {
    this._log('error', ...args);
  }
}

module.exports = { Logger };
