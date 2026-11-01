const {app,BrowserWindow}=require('electron');const path=require('path');
app.setPath('userData',path.join(process.env.WIDGET_DATA_DIR,'cover'));
app.whenReady().then(()=>{const w=new BrowserWindow({width:900,height:650,title:'大肥豆层级测试窗口',skipTaskbar:true});w.loadURL('data:text/html,<body style="background:%23ddd">Widget layer test</body>');w.show();w.focus();});
app.on('window-all-closed',()=>app.quit());
