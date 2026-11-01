(() => {
/**
 * 角色渲染器
 * 负责加载、切换和渲染角色形态与表情
 */

const Logger = class { info() {} debug() {} warn(...args) { console.warn(...args); } error(...args) { console.error(...args); } };
const FORMS = { DOUBAO: 'doubao', NAILOONG: 'nailoong' };
const EXPRESSIONS = Object.fromEntries(['idle','thinking','happy','warning','proud','crying','angry'].map(x => [x.toUpperCase(), x]));

class CharacterRenderer {
  constructor(options = {}) {
    this.logger = new Logger('CharacterRenderer', options.logger);
    this.currentForm = options.defaultForm || FORMS.DOUBAO;
    this.currentExpression = EXPRESSIONS.IDLE;
    this.transitioning = false;
    this.imageCache = new Map();
    this.animationTimer = null;
  }

  /**
   * 预加载所有角色图片
   */
  async preloadImages() {
    this.logger.info('Preloading character images');

    const imagesToLoad = [
      // 豆包形态
      { form: FORMS.DOUBAO, expression: EXPRESSIONS.IDLE, path: 'doubao/idle.png' },
      { form: FORMS.DOUBAO, expression: EXPRESSIONS.THINKING, path: 'doubao/thinking.png' },
      { form: FORMS.DOUBAO, expression: EXPRESSIONS.HAPPY, path: 'doubao/happy.png' },
      { form: FORMS.DOUBAO, expression: EXPRESSIONS.WARNING, path: 'doubao/warning.png' },
      
      // 奶龙形态
      { form: FORMS.NAILOONG, expression: EXPRESSIONS.IDLE, path: 'nailoong/idle.png' },
      { form: FORMS.NAILOONG, expression: EXPRESSIONS.PROUD, path: 'nailoong/proud.png' },
      { form: FORMS.NAILOONG, expression: EXPRESSIONS.ANGRY, path: 'nailoong/angry.png' },
      { form: FORMS.NAILOONG, expression: EXPRESSIONS.CRYING, path: 'nailoong/crying.png' }
    ];

    const loadPromises = imagesToLoad.map(({ form, expression, path: imgPath }) => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        const fullPath = this._getImagePath(imgPath);
        
        img.onload = () => {
          const key = `${form}-${expression}`;
          this.imageCache.set(key, img);
          this.logger.debug('Image loaded:', key);
          resolve();
        };
        
        img.onerror = () => {
          this.logger.error('Failed to load image:', imgPath);
          reject(new Error(`Failed to load ${imgPath}`));
        };
        
        img.src = fullPath;
      });
    });

    try {
      await Promise.all(loadPromises);
      this.logger.info('All images preloaded');
      this._render();
    } catch (err) {
      this.logger.error('Image preloading failed:', err);
      throw err;
    }
  }

  /**
   * 获取图片路径
   */
  _getImagePath(relativePath) {
    return `../../assets/characters/${relativePath}`;
  }

  /**
   * 切换形态
   */
  async switchForm(newForm) {
    if (newForm === this.currentForm) {
      this.logger.debug('Already in form:', newForm);
      return;
    }

    if (this.transitioning) {
      this.logger.warn('Form transition in progress');
      return;
    }

    this.logger.info('Switching form:', this.currentForm, '→', newForm);
    this.transitioning = true;

    try {
      // 淡出当前形态
      await this._fadeOut();
      
      // 切换形态
      this.currentForm = newForm;
      this.currentExpression = EXPRESSIONS.IDLE;
      
      // 淡入新形态
      await this._fadeIn();
      
      this.logger.info('Form switched to:', newForm);
    } finally {
      this.transitioning = false;
    }
  }

  /**
   * 切换表情
   */
  changeExpression(newExpression) {
    if (newExpression === this.currentExpression) {
      return;
    }

    this.logger.debug('Changing expression:', this.currentExpression, '→', newExpression);
    
    const key = `${this.currentForm}-${newExpression}`;
    if (!this.imageCache.has(key)) {
      this.logger.warn('Expression image not found:', key);
      return;
    }

    this.currentExpression = newExpression;
    this._render();
  }

  /**
   * 根据状态自动选择表情
   */
  updateByState(state, quota, easterExpression = null) {
    let targetExpression = EXPRESSIONS.IDLE;

    // 根据状态选择表情
    switch (state) {
      case 'idle':
        targetExpression = EXPRESSIONS.IDLE;
        break;
      case 'thinking':
        targetExpression = EXPRESSIONS.THINKING;
        break;
      case 'warning':
        targetExpression = EXPRESSIONS.WARNING;
        break;
      case 'offline':
        targetExpression = EXPRESSIONS.IDLE;
        break;
      case 'error':
        if (this.currentForm === FORMS.NAILOONG) {
          targetExpression = EXPRESSIONS.CRYING;
        } else {
          targetExpression = EXPRESSIONS.WARNING;
        }
        break;
    }

    // 额度影响（奶龙形态）
    if (this.currentForm === FORMS.NAILOONG && quota) {
      const known = [quota.fiveHour, quota.weekly].filter(Number.isFinite);
      const avgQuota = known.length && !quota.stale ? Math.min(...known) : null;
      if (avgQuota !== null && avgQuota < 20) {
        targetExpression = EXPRESSIONS.ANGRY;
      } else if (avgQuota !== null && avgQuota > 80) {
        targetExpression = EXPRESSIONS.PROUD;
      }
    }

    const valid = this.currentForm === 'doubao' ? ['idle','thinking','happy','warning'] : ['idle','proud','angry','crying'];
    if (this.currentForm === 'nailoong' && ['success','petting'].includes(state)) targetExpression = 'proud';
    if(easterExpression && !['pressed','dragged','thinking','error'].includes(state))targetExpression=easterExpression;
    this.changeExpression(valid.includes(targetExpression) ? targetExpression : 'idle');
  }

  /**
   * 渲染当前角色
   */
  _render() {
    const characterEl = document.getElementById('character');
    if (!characterEl) return;

    const key = `${this.currentForm}-${this.currentExpression}`;
    const img = this.imageCache.get(key);

    if (!img) {
      this.logger.warn('Image not found in cache:', key);
      return;
    }

    // 清空容器
    characterEl.innerHTML = '';

    // 创建图片元素
    const imgEl = document.createElement('img');
    imgEl.src = img.src;
    imgEl.alt = `${this.currentForm} - ${this.currentExpression}`;
    imgEl.className = 'character-image';
    imgEl.style.width = '100%';
    imgEl.style.height = '100%';
    imgEl.style.objectFit = 'contain';
    imgEl.draggable = false;

    const face=document.createElement('div');face.className='character-face';face.appendChild(imgEl);characterEl.appendChild(face);
  }

  /**
   * 淡出动画
   */
  _fadeOut() {
    return new Promise((resolve) => {
      const characterEl = document.getElementById('character');
      if (!characterEl) {
        resolve();
        return;
      }

      characterEl.style.transition = 'opacity 0.3s ease';
      characterEl.style.opacity = '0';

      setTimeout(resolve, 300);
    });
  }

  /**
   * 淡入动画
   */
  _fadeIn() {
    return new Promise((resolve) => {
      const characterEl = document.getElementById('character');
      if (!characterEl) {
        resolve();
        return;
      }

      // 先渲染新角色（透明）
      this._render();

      // 淡入
      setTimeout(() => {
        characterEl.style.transition = 'opacity 0.3s ease';
        characterEl.style.opacity = '1';
        setTimeout(resolve, 300);
      }, 50);
    });
  }

  /**
   * 启动呼吸动画
   */
  startBreathingAnimation() {
    if (this.animationTimer) return;

    this.animationTimer = setInterval(() => {
      const characterEl = document.getElementById('character');
      if (!characterEl) return;

      // CSS 动画已处理，这里可以添加额外效果
    }, 3000);
  }

  /**
   * 停止呼吸动画
   */
  stopBreathingAnimation() {
    if (this.animationTimer) {
      clearInterval(this.animationTimer);
      this.animationTimer = null;
    }
  }

  /**
   * 获取当前形态
   */
  getCurrentForm() {
    return this.currentForm;
  }

  /**
   * 获取当前表情
   */
  getCurrentExpression() {
    return this.currentExpression;
  }

  /**
   * 销毁渲染器
   */
  destroy() {
    this.stopBreathingAnimation();
    this.imageCache.clear();
  }
}

window.CharacterRenderer = CharacterRenderer;

})();
