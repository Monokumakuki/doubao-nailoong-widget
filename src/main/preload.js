const { contextBridge, ipcRenderer } = require('electron');
const commands = ['getState','getSettings','updateSettings','resetSettings','openSettings','resetPosition','quit','refreshQuota','switchForm','nextDialogue','getDialogue','playSound','clearCache','triggerPointerDown','triggerPointerUp','triggerPetting','triggerSuccess','dragStart','dragMove','dragEnd','hitTest','characterClick','dock'];
const api = Object.fromEntries(commands.map(name=>[name,(...args)=>ipcRenderer.invoke('widget:'+name.replace(/[A-Z]/g,c=>'-'+c.toLowerCase()),...args)]));
api.onStateUpdate = callback => {const listener=(_e,state)=>callback(state);ipcRenderer.on('widget:state-update',listener);return ()=>ipcRenderer.removeListener('widget:state-update',listener);};
api.onSound = callback => {const listener=(_e,sound)=>callback(sound);ipcRenderer.on('widget:sound',listener);return ()=>ipcRenderer.removeListener('widget:sound',listener);};
contextBridge.exposeInMainWorld('widgetAPI', api);
