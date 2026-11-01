/**
 * 窗口管理器
 * 负责创建和管理主窗口
 */

const { BrowserWindow, screen } = require('electron');
const path = require('path');
const {artGeometry,characterPlacement,snapToEdges}=require('../domain/placement');
const { Logger } = require('../shared/logger');
const { WINDOW_WIDTH, WINDOW_HEIGHT } = require('../shared/constants');

class WindowManager {
  constructor(options = {}) {
    this.logger = new Logger('WindowManager', options.logger);
    this.mainWindow = null;
    this.settingsWindow = null;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.artShift=0;this.facing='right';this.dockSide='';this.layoutSettings={};
  }

  /**
   * 创建主窗口
   */
  createMainWindow(settings = {}) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.logger.warn('Main window already exists');
      return this.mainWindow;
    }

    // 计算初始位置（右下角）
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
    
    const x = settings.x !== undefined ? settings.x : primaryDisplay.workArea.x + screenWidth - WINDOW_WIDTH - 20;
    const y = settings.y !== undefined ? settings.y : primaryDisplay.workArea.y + screenHeight - WINDOW_HEIGHT - 20;

    // 创建无边框透明窗口
    this.mainWindow = new BrowserWindow({
        icon: path.join(__dirname, '../../assets/ui/icon.ico'),
      width: WINDOW_WIDTH,
      height: WINDOW_HEIGHT,
      x: x,
      y: y,
      frame: false,                    // 无边框
      transparent: true,               // 透明背景
      resizable: false,                // 不可调整大小
      alwaysOnTop: settings.alwaysOnTop !== false,  // 默认置顶
      skipTaskbar: true,               // 不显示在任务栏
      hasShadow: false,                // 无阴影
      show: false,                     // 初始隐藏，准备好后再显示
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: false   // 禁用后台节流
      }
    });

    this.mainWindow.webContents.setFrameRate(30);

    // 加载页面
    this.mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    this.mainWindow.webContents.on('will-navigate', event => event.preventDefault());
    this.mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

    // 准备好后显示
    this.mainWindow.once('ready-to-show', () => {
      if(!this.hostWindowOnly)this.mainWindow.showInactive(); // 显示但不激活
      this.logger.info('Main window shown');
    });

    // 监听关闭事件
    this.mainWindow.on('closed', () => {
      this.logger.info('Main window closed');
      this.mainWindow = null;
    });

    // 开发模式下打开 DevTools
    if (process.argv.includes('--dev')) {
      this.mainWindow.webContents.openDevTools({ mode: 'detach' });
    }

    this.logger.info('Main window created at', x, y);
    return this.mainWindow;
  }

  /**
   * 创建设置窗口
   */
  createSettingsWindow() {
    if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
      this.settingsWindow.focus();
      return this.settingsWindow;
    }

    this.settingsWindow = new BrowserWindow({
        icon: path.join(__dirname, '../../assets/ui/icon.ico'),
      width: 600,
      height: 700,
      minWidth: 500,
      minHeight: 600,
      title: '大肥豆插件设置',
      autoHideMenuBar: true,
      backgroundColor: '#f5f5f5',
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    this.settingsWindow.loadFile(path.join(__dirname, '../renderer/settings.html'));

    this.settingsWindow.on('closed', () => {
      this.logger.info('Settings window closed');
      this.settingsWindow = null;
    });

    this.logger.info('Settings window created');
    return this.settingsWindow;
  }

  /**
   * 处理窗口拖动开始
   */
  area() { return this.hostWindowOnly && this.hostBounds ? this.hostBounds : screen.getDisplayMatching(this.mainWindow.getBounds()).workArea; }
  form() { return this.currentForm || this.layoutSettings.defaultForm || 'doubao'; }
  visualX() { const s=this.effectiveScale||1;return this.mainWindow.getBounds().x+artGeometry(this.form(),this.facing,s).left+this.artShift*s; }
  place(visualX,y,facing=this.facing) {
    const s=this.effectiveScale||1;const result=characterPlacement(this.area(),this.mainWindow.getBounds(),visualX,y,this.form(),facing,s);
    this.facing=facing;this.artShift=result.artShift;this.mainWindow.setBounds(result.bounds);return result;
  }
  handleDragStart(point) {
    if(!this.mainWindow||this.mainWindow.isDestroyed())return;
    this.isDragging=true;this.dragOrigin={point,bounds:this.mainWindow.getBounds(),visualX:this.visualX()};
    this.mainWindow.setIgnoreMouseEvents(false);
  }
  handleDragMove(point) {
    if(!this.isDragging||!this.mainWindow||this.mainWindow.isDestroyed())return;
    const area=this.area(),s=this.effectiveScale||1,origin=this.dragOrigin;
    const visualX=origin.visualX+point.x-origin.point.x;
    const width=artGeometry(this.form(),this.facing,s).width;
    const facing=visualX+width/2<area.x+area.width/2?'left':'right';
    this.dockSide='';return this.place(visualX,origin.bounds.y+point.y-origin.point.y,facing);
  }
  placementSettings() {
    const area=this.area(),b=this.mainWindow.getBounds(),width=artGeometry(this.form(),this.facing,this.effectiveScale||1).width;
    const visualX=this.visualX();
    return this.hostWindowOnly?{hostDock:this.dockSide,hostOffsetX:Math.max(0,area.x+area.width-visualX-width),hostOffsetY:Math.max(0,area.y+area.height-b.y-b.height)}:{x:b.x,y:b.y,desktopDock:this.dockSide,desktopArtShift:this.artShift,facing:this.facing};
  }
  handleDragEnd(point,settings) {
    if(!this.isDragging)return;this.handleDragMove(point);this.isDragging=false;
    const area=this.area(),b=this.mainWindow.getBounds(),s=this.effectiveScale||1,width=artGeometry(this.form(),this.facing,s).width;
    const snap=snapToEdges(area,width,b.height,this.visualX(),b.y);
    this.place(snap.visualX,snap.y,snap.visualX+width/2<area.x+area.width/2?'left':'right');
    this.dockSide=Math.abs(snap.visualX-area.x)<2?'left':Math.abs(snap.visualX+width-area.x-area.width)<2?'right':'';
    this.mainWindow.setIgnoreMouseEvents(settings.clickThrough,{forward:true});return this.placementSettings();
  }
  dock(side) {
    if(!['left','right'].includes(side)||!this.mainWindow)return;
    const area=this.area(),b=this.mainWindow.getBounds(),s=this.effectiveScale||1,width=artGeometry(this.form(),side,s).width;
    this.place(side==='left'?area.x:area.x+area.width-width,area.y+area.height-b.height,side);this.dockSide=side;
    return this.placementSettings();
  }
  restoreLayout() {
    if(!this.mainWindow||this.isDragging)return;
    const area=this.area(),b=this.mainWindow.getBounds(),s=this.effectiveScale||1;
    const side=this.hostWindowOnly?this.layoutSettings.hostDock:this.layoutSettings.desktopDock;
    if(side){const width=artGeometry(this.form(),side,s).width;this.place(side==='left'?area.x:area.x+area.width-width,area.y+area.height-b.height-(this.hostWindowOnly?(this.layoutSettings.hostOffsetY||0):0),side);this.dockSide=side;}
    else if(this.hostWindowOnly){const width=artGeometry(this.form(),this.facing,s).width;const x=area.x+area.width-width-(this.layoutSettings.hostOffsetX||0);this.place(x,area.y+area.height-b.height-(this.layoutSettings.hostOffsetY||0),x+width/2<area.x+area.width/2?'left':'right');}
    else {this.artShift=this.layoutSettings.desktopArtShift||0;this.facing=this.layoutSettings.facing||'right';}
  }

  /**
   * 设置始终置顶
   */
  setAlwaysOnTop(flag) {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return;
    this.mainWindow.setAlwaysOnTop(flag);
    this.logger.info('AlwaysOnTop set to', flag);
  }

  /**
   * 设置鼠标穿透
   */
  setClickThrough(flag) {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return;
    this.mainWindow.setIgnoreMouseEvents(flag, { forward: true });
    this.logger.info('ClickThrough set to', flag);
  }

  /**
   * 显示主窗口
   */
  showMainWindow() {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return;
    if(this.hostWindowOnly)return;
    if (!this.mainWindow.isVisible()) {
      this.mainWindow.showInactive();
    }
  }

  /**
   * 隐藏主窗口
   */
  hideMainWindow() {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return;
    if (this.mainWindow.isVisible()) {
      this.mainWindow.hide();
    }
  }

  /**
   * 移动窗口到指定位置
   */
  moveWindow(x, y, animate = false) {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return;
    this.mainWindow.setPosition(x, y, animate);
  }

  /**
   * 获取窗口位置
   */
  getWindowBounds() {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return null;
    return this.mainWindow.getBounds();
  }

  /**
   * 重置窗口位置到右下角
   */
  resetPosition() {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return;

    const bounds = this.mainWindow.getBounds();
    const display = screen.getDisplayNearestPoint({ x: bounds.x, y: bounds.y });
    const { width: screenWidth, height: screenHeight } = display.workAreaSize;

    const newX = display.workArea.x + screenWidth - bounds.width - 20;
    const newY = display.workArea.y + screenHeight - bounds.height - 20;

    this.mainWindow.setPosition(newX, newY, true);
    this.logger.info('Position reset to', newX, newY);

    return { x: newX, y: newY };
  }

  /**
   * 销毁所有窗口
   */
  destroyAll() {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.destroy();
      this.mainWindow = null;
    }
    if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
      this.settingsWindow.destroy();
      this.settingsWindow = null;
    }
  }

  /**
   * 获取主窗口
   */
  applyScale(scale) {
    const win = this.mainWindow;
    if (!win || win.isDestroyed()) return;
    const area = this.hostWindowOnly && this.hostBounds ? this.hostBounds : screen.getDisplayMatching(win.getBounds()).workArea;
    const bounds = win.getBounds();
    const clearance=this.hostWindowOnly?8:0;
    scale = Math.min(scale, (area.width-clearance) / WINDOW_WIDTH, (area.height-clearance) / WINDOW_HEIGHT);
    this.effectiveScale = scale;
    const width = Math.round(WINDOW_WIDTH * scale);
    const height = Math.round(WINDOW_HEIGHT * scale);
    win.setBounds({x: Math.max(area.x, Math.min(bounds.x, area.x + area.width - width)), y: Math.max(area.y, Math.min(bounds.y, area.y + area.height - height)), width, height});
    this.restoreLayout();
  }

  getMainWindow() {
    return this.mainWindow;
  }

  /**
   * 获取设置窗口
   */
  getSettingsWindow() {
    return this.settingsWindow;
  }
}

module.exports = { WindowManager };
