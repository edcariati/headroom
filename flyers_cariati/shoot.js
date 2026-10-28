const {chromium}=require('playwright');const fs=require('fs'),path=require('path');
(async()=>{const jobs=JSON.parse(fs.readFileSync('jobs.json'));fs.mkdirSync('png',{recursive:true});fs.mkdirSync('png_claro',{recursive:true});fs.mkdirSync('png_dicas',{recursive:true});fs.mkdirSync('png_dicas_claro',{recursive:true});
const b=await chromium.launch();
for(const j of jobs){const p=await b.newPage({viewport:{width:j.w,height:j.h}});
await p.goto('file://'+path.resolve('html',j.f+'.html'));await p.waitForTimeout(300);
await p.screenshot({path:j.d+'/'+j.f+'.png'});await p.close();}
await b.close();})();
