/**
 * 设置面板脚本
 */

let settings = {};

/**
 * 初始化
 */
async function init() {
  console.log('[Settings] Initializing');

  // 加载当前设置
  settings = await window.widgetAPI.getSettings();
  console.log('[Settings] Loaded:', settings);

  // 填充表单
  populateForm();

  // 绑定事件
  bindEvents();

  console.log('[Settings] Initialized');
}

/**
 * 填充表单
 */
function populateForm() {
  document.getElementById('cdpPort').value = settings.cdpPort ?? 0;
  // 滑块
  setRangeValue('scale', settings.scale ?? 1.0);
  setRangeValue('volume', settings.volume ?? 0.5);
  setRangeValue('warningThreshold', settings.warningThreshold ?? 20);

  // 复选框
  document.getElementById('alwaysOnTop').checked = settings.alwaysOnTop !== false;
  document.getElementById('clickThrough').checked = settings.clickThrough || false;
  document.getElementById('hostWindowOnly').checked = settings.hostWindowOnly || false;
  document.getElementById('autoSwitchForm').checked = settings.autoSwitchForm !== false;
  document.getElementById('bubbleOn').checked = settings.bubbleOn !== false;
  document.getElementById('sound').checked = settings.sound !== false;

  // 下拉框
  document.getElementById('defaultForm').value = settings.defaultForm || 'doubao';
  document.getElementById('dialogueFrequency').value = settings.dialogueFrequency || 'medium';
}

/**
 * 设置滑块值
 */
function setRangeValue(id, value) {
  const input = document.getElementById(id);
  const valueSpan = document.getElementById(`${id}-value`);

  if (input) {
    input.value = value;
    if (valueSpan) {
      if (id === 'scale') {
        valueSpan.textContent = Math.round(value * 100) + '%';
      } else if (id === 'volume') {
        valueSpan.textContent = Math.round(value * 100) + '%';
      } else {
        valueSpan.textContent = Math.round(value) + '%';
      }
    }
  }
}

/**
 * 绑定事件
 */
function bindEvents() {
  document.getElementById('dockLeft').onclick=()=>widgetAPI.dock('left');
  document.getElementById('dockRight').onclick=()=>widgetAPI.dock('right');
  // 滑块实时更新
  document.getElementById('scale').addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    document.getElementById('scale-value').textContent = Math.round(value * 100) + '%';
  });

  document.getElementById('volume').addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    document.getElementById('volume-value').textContent = Math.round(value * 100) + '%';
  });

  document.getElementById('warningThreshold').addEventListener('input', (e) => {
    const value = parseInt(e.target.value);
    document.getElementById('warningThreshold-value').textContent = value + '%';
  });

  // 立即切换形态
  document.getElementById('switchFormNow').addEventListener('click', async () => {
    const currentForm = settings.defaultForm || 'doubao';
    const newForm = currentForm === 'doubao' ? 'nailoong' : 'doubao';
    
    await window.widgetAPI.switchForm(newForm);
    settings.defaultForm = newForm;
    document.getElementById('defaultForm').value = newForm;
    
    showToast('形态已切换');
  });

  // 测试音效
  document.getElementById('testSound').addEventListener('click', () => {
    window.widgetAPI.playSound('press');
    setTimeout(() => window.widgetAPI.playSound('release'), 300);
  });

  // 刷新额度
  document.getElementById('refreshQuota').addEventListener('click', async () => {
    await window.widgetAPI.refreshQuota();
    showToast('额度刷新中...');
  });

  // 重置位置
  document.getElementById('resetPosition').addEventListener('click', () => {
    window.widgetAPI.resetPosition();
    showToast('窗口位置已重置');
  });

  // 清除缓存
  document.getElementById('clearCache').addEventListener('click', () => {
    if (confirm('确定要清除所有缓存数据吗？')) {
      window.widgetAPI.clearCache().then(() => showToast('缓存已清除')).catch(err => showToast(err.message));
    }
  });

  // 恢复默认设置
  document.getElementById('resetSettings').addEventListener('click', () => {
    if (confirm('确定要恢复所有默认设置吗？此操作不可撤销。')) {
      window.widgetAPI.resetSettings().then(() => {
        showToast('设置已恢复为默认值');
        setTimeout(() => location.reload(), 1000);
      });
    }
  });

  document.getElementById('openLicense').addEventListener('click', (e) => {
    e.preventDefault();
    alert('MIT License\n\nCopyright (c) 2024 DouBao Nailoong Widget Contributors\n\n详见 LICENSE 文件');
  });

  for (const id of ['hostWindowOnly','scale','alwaysOnTop','clickThrough','bubbleOn','sound','volume','warningThreshold','dialogueFrequency','autoSwitchForm']) {
    document.getElementById(id).addEventListener('change', saveSettings);
  }

  // 保存设置
  document.getElementById('saveSettings').addEventListener('click', saveSettings);

  // 关闭窗口
  document.getElementById('closeSettings').addEventListener('click', () => {
    window.close();
  });
}

/**
 * 保存设置
 */
async function saveSettings() {
  const newSettings = {
    cdpPort: Number(document.getElementById('cdpPort').value),
    scale: parseFloat(document.getElementById('scale').value),
    alwaysOnTop: document.getElementById('alwaysOnTop').checked,
    clickThrough: document.getElementById('clickThrough').checked,
    hostWindowOnly: document.getElementById('hostWindowOnly').checked,
    defaultForm: document.getElementById('defaultForm').value,
    autoSwitchForm: document.getElementById('autoSwitchForm').checked,
    bubbleOn: document.getElementById('bubbleOn').checked,
    sound: document.getElementById('sound').checked,
    volume: parseFloat(document.getElementById('volume').value),
    warningThreshold: parseInt(document.getElementById('warningThreshold').value),
    dialogueFrequency: document.getElementById('dialogueFrequency').value
  };

  console.log('[Settings] Saving:', newSettings);

  try {
    await window.widgetAPI.updateSettings(newSettings);
    showToast('设置已保存');
    settings = { ...settings, ...newSettings };
  } catch (err) {
    console.error('[Settings] Save failed:', err);
    alert('保存失败: ' + err.message);
  }
}

/**
 * 显示提示
 */
function showToast(message) {
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #333;
    color: white;
    padding: 12px 20px;
    border-radius: 4px;
    font-size: 14px;
    z-index: 10000;
    animation: slideIn 0.3s ease;
  `;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

// 动画
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
  }
`;
document.head.appendChild(style);

// 启动
init().catch(err => {
  console.error('[Settings] Initialization failed:', err);
  alert('设置面板加载失败: ' + err.message);
});
