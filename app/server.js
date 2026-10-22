import http from 'node:http';
import fs from 'node:fs';
import { getProposals, getReviews, saveReview } from './proposal-review.js';
import {fileURLToPath} from 'node:url';
const samples=JSON.parse(fs.readFileSync(new URL('../data/samples.json',import.meta.url)));
const audit=[];
const send=(res,status,obj)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(obj));};
const valid=x=>x&&typeof x.sampleId==='string'&&/^SYN-[0-9]{3}$/.test(x.sampleId)&&Number.isInteger(x.fragmentLength)&&x.fragmentLength>0&&x.fragmentLength<=100000&&typeof x.signalQuality==='number'&&Number.isFinite(x.signalQuality)&&x.signalQuality>=0&&x.signalQuality<=1&&Number.isInteger(x.variantCount)&&x.variantCount>=0;
const quality=x=>x.signalQuality>=0.8?'PASS':'REVIEW';
const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>BioGuard AI | Synthetic Lab</title><style>body{font:16px system-ui;background:#f3f7fb;color:#182a40;margin:0}header{background:#153451;color:white;padding:25px 7%}main{max-width:950px;margin:30px auto;background:white;border-radius:16px;padding:28px;box-shadow:0 4px 24px #d9e2ee}table{width:100%;border-collapse:collapse}th,td{padding:14px;border-bottom:1px solid #dce4ee;text-align:left}.tag{background:#dff5e8;border-radius:20px;padding:5px 12px}.review{background:#fff0d3}small{color:#5c6e81}</style></head><body><header><h1>BioGuard AI</h1><div>Synthetic Biotech Sample Quality Engineering Demo</div></header><main><h2>Sample Analysis Overview</h2><p>Fictional data only. Not a medical or diagnostic application.</p><table><thead><tr><th>Sample ID</th><th>Fragment length</th><th>Signal quality</th><th>QC outcome</th></tr></thead><tbody id="samples"></tbody></table><p><small>Threshold for demo: signal quality ≥ 0.80 → PASS; otherwise REVIEW.</small></p></main><script>fetch('/api/samples').then(r=>r.json()).then(d=>{document.querySelector('#samples').innerHTML=d.map(x=>'<tr><td>'+x.sampleId+'</td><td>'+x.fragmentLength+'</td><td>'+x.signalQuality+'</td><td><span class="tag '+(x.qcStatus==='REVIEW'?'review':'')+'">'+x.qcStatus+'</span></td></tr>').join('')})</script></body></html>`;
const server=http.createServer(async(req,res)=>{
 const path=new URL(req.url,'http://localhost').pathname;
 if(req.method==='GET'&&path==='/health')return send(res,200,{ok:true});
if(req.method==='GET'&&path==='/ai-review'){
  const dashboard=fs.readFileSync(new URL('./review-dashboard.html',import.meta.url),'utf8');
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
  return res.end(dashboard);
}
 if(req.method==='GET'&&path==='/'){res.writeHead(200,{'Content-Type':'text/html'});return res.end(html);}
 if(req.method==='GET'&&path==='/api/samples')return send(res,200,samples.map(x=>({...x,qcStatus:quality(x)})));
 if(req.method==='GET'&&path==='/api/audit')return send(res,200,audit);
if(req.method==='GET'&&path==='/api/ai/proposals'){
  return send(res,200,getProposals());
}
if(req.method==='GET'&&path==='/api/ai/reviews'){
  return send(res,200,getReviews());
}
if(req.method==='POST'&&path==='/api/ai/reviews'){
  let raw='';
  for await(const part of req){
    raw+=part;
    if(raw.length>10000){
      return send(res,413,{error:'Payload too large'});
    }
  }

  let input;
  try{
    input=JSON.parse(raw);
  }catch{
    return send(res,400,{error:'Invalid JSON'});
  }

  try{
    const review=saveReview(input);
    return send(res,200,{success:true,review});
  }catch(error){
    return send(res,400,{error:error.message});
  }
}
 if(req.method==='POST'&&path==='/api/analyze'){
  let raw='';for await(const part of req){raw+=part;if(raw.length>10000)return send(res,413,{error:'Payload too large'});}
  let input;try{input=JSON.parse(raw)}catch{return send(res,400,{error:'Invalid JSON'})}
  // Intentional defect is opt-in only; normal execution must pass.
  const demoDefect=process.env.INJECT_DEMO_DEFECT==='true';
  const isValid=valid(input)||(demoDefect&&input&&input.fragmentLength<0&&typeof input.sampleId==='string'&&typeof input.signalQuality==='number'&&Number.isInteger(input.variantCount));
  if(!isValid)return send(res,422,{error:'Invalid synthetic sample'});
  const event={eventId:`EVT-${String(audit.length+1).padStart(4,'0')}`,sampleId:input.sampleId,action:'ANALYZE',result:quality(input),timestamp:new Date().toISOString()};audit.push(event);
  return send(res,200,{sampleId:input.sampleId,qcStatus:quality(input),variantCount:input.variantCount});
 }
 send(res,404,{error:'Not found'});
});
server.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('BioGuard app listening'));
