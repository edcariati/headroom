const {chromium}=require('playwright');const fs=require('fs'),path=require('path');
(async()=>{const jobs=JSON.parse(fs.readFileSync('jobs.json'));fs.mkdirSync('png',{recursive:true});
const b=await chromium.launch();
for(const j of jobs){const p=await b.newPage({viewport:{width:j.w,height:j.h}});
await p.goto('file://'+path.resolve('html',j.f+'.html'));await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(400);
await p.screenshot({path:'png/'+j.f+'.png'});await p.close();}
await b.close();})();
