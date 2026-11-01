const path=require('node:path');
(async()=>{
 const {rcedit}=await import('rcedit');const pkg=require('../package.json');
 await rcedit(process.argv[2],{icon:path.resolve(__dirname,'../assets/ui/icon.ico'),'file-version':pkg.version,'product-version':pkg.version,'version-string':{ProductName:'大肥豆插件',FileDescription:'大肥豆插件',CompanyName:'Community Contributors'}});
})().catch(e=>{console.error(e.message);process.exitCode=1;});
