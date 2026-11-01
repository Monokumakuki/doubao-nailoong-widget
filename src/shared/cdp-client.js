/**
 * Chrome DevTools Protocol 客户端
 * 用于连接豆包客户端并执行脚本
 */

const WebSocket = require('ws');
const http = require('http');
const { Logger } = require('./logger');

class CdpClient {
  constructor(wsUrl, options = {}) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.connected = false;
    this.nextId = 1;
    this.callbacks = new Map();
    this.logger = new Logger('CdpClient', options.logger);
    this.timeout = options.timeout || 5000;
  }

  /**
   * 连接到 CDP WebSocket
   */
  async connect() {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.wsUrl, {
          perMessageDeflate: false
        });

        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
          this.ws?.terminate();
        }, this.timeout);

        this.ws.on('open', () => {
          clearTimeout(timeout);
          this.connected = true;
          this.logger.info('CDP connected:', this.wsUrl);
          resolve();
        });

        this.ws.on('message', (data) => {
          try {
            const message = JSON.parse(data);
            this._handleMessage(message);
          } catch (err) {
            this.logger.error('Failed to parse CDP message:', err);
          }
        });

        this.ws.on('error', (err) => {
          this.logger.error('CDP WebSocket error:', err);
          this.connected = false;
          clearTimeout(timeout);
          reject(err);
        });

        this.ws.on('close', () => {
          this.logger.info('CDP connection closed');
          this.connected = false;
          this.callbacks.forEach(cb => cb.reject(new Error('Connection closed')));
          this.callbacks.clear();
        });

      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * 处理 CDP 消息
   */
  _handleMessage(message) {
    if (message.id && this.callbacks.has(message.id)) {
      const { resolve, reject } = this.callbacks.get(message.id);
      this.callbacks.delete(message.id);

      if (message.error) {
        reject(new Error(message.error.message || 'CDP error'));
      } else {
        resolve(message.result);
      }
    }
  }

  /**
   * 发送 CDP 命令
   */
  async send(method, params = {}) {
    if (!this.connected) {
      throw new Error('Not connected to CDP');
    }

    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      const message = JSON.stringify({ id, method, params });

      const timeout = setTimeout(() => {
        this.callbacks.delete(id);
        reject(new Error(`CDP command timeout: ${method}`));
      }, this.timeout);

      this.callbacks.set(id, {
        resolve: (result) => {
          clearTimeout(timeout);
          resolve(result);
        },
        reject: (err) => {
          clearTimeout(timeout);
          reject(err);
        }
      });

      this.ws.send(message);
    });
  }

  /**
   * 执行 JavaScript 代码
   */
  async evaluate(expression, options = {}) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: options.returnByValue !== false,
      awaitPromise: options.awaitPromise !== false,
      userGesture: options.userGesture || false
    });

    if (result.exceptionDetails) {
      throw new Error(`Evaluation error: ${result.exceptionDetails.text}`);
    }

    return result.result.value;
  }

  /**
   * 关闭连接
   */
  close() {
    if (this.ws) {
      this.connected = false;
      this.ws.close();
      this.ws = null;
    }
    this.callbacks.forEach(cb => cb.reject(new Error('Connection closed')));
    this.callbacks.clear();
  }

  /**
   * 检查是否连接
   */
  isConnected() {
    return this.connected && this.ws && this.ws.readyState === WebSocket.OPEN;
  }
}

module.exports = { CdpClient };
