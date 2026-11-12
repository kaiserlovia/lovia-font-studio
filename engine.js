import JSZip from './zip-codec.js?v=20261112-2';
/* Readingo ZIP manipulation. No network requests; all data stays in memory. */
export const FONT_FAMILY = 'LoviaEmbeddedFont';
const STYLE_ID='lovia-embedded-font';
const SCRIPT_ID='lovia-font-ready';
export const TEXT_SELECTOR = '[data-red-text="note.description"],[data-red-text="note.content"],[data-red-text="note.comment"],[data-reeden-text="note.description"],[data-reeden-text="note.comment"],#excerpt,#thought,#content,#note,.text-block,.note-content,.note-text,.thought,.comment';
const MAX_TOTAL=180*1024*1024;
export function safePath(path){
 if(typeof path!=='string'||!path||path.includes('\\')||path.startsWith('/')||path.includes('\0')||/^[a-z]+:/i.test(path))throw Error('模板包含无效文件路径。');
 const parts=[];for(const p of path.split('/')){if(p==='..')throw Error('模板包含不安全的相对路径。');if(p!=='.'&&p)parts.push(p)}
 return parts.join('/');
}
export function sizeText(n){return n<1024?n+' B':n<1024*1024?(n/1024).toFixed(1)+' KB':(n/1024/1024).toFixed(2)+' MB'}
export async function readTemplate(data,filename){
 const bytes = data instanceof Uint8Array ? data : ArrayBuffer.isView(data) ? new Uint8Array(data.buffer,data.byteOffset,data.byteLength) : new Uint8Array(data);
 if(!bytes.byteLength)throw Error('这个 ZIP 文件是空的，请重新下载原始模板。');
 if(bytes.byteLength>90*1024*1024)throw Error('ZIP 文件过大，请选择 90 MB 以内的模板。');
 let zip;
 try{zip=await JSZip.loadAsync(bytes,{checkCRC32:false})}
 catch(error){
  const message=String(error?.message||error);
  const head=new TextDecoder().decode(bytes.subarray(0,160)).trimStart();
  if(/^<!doctype\s+html|^<html|^<\?xml/i.test(head))throw Error('这个文件的内容是网页，不是真正的 ZIP。请重新下载原始模板 ZIP 后导入。');
  if(/encrypt|password/i.test(message))throw Error('这个 ZIP 有密码保护，请解密后重新压缩为普通 ZIP。');
  if(/compression|not supported/i.test(message))throw Error('这个 ZIP 使用了暂不支持的压缩方式，请解压后用普通 ZIP 格式重新压缩。');
  if(/end of central|corrupt|unexpected end|missing/i.test(message))throw Error('ZIP 数据不完整或格式无效，请重新下载原始模板 ZIP；模板无需自带字体。');
  throw Error('读取 ZIP 失败：'+message);
 }
 const files=Object.values(zip.files).filter(f=>!f.dir&&!f.name.startsWith('__MACOSX/'));
 if(files.length>600)throw Error('模板文件数量超过 600，请检查 ZIP 内容。');
 let total=0;for(const f of files){safePath(f.unsafeOriginalName||f.name);total+=(f._data?.uncompressedSize||0);if(total>MAX_TOTAL)throw Error('ZIP 解压后过大，请使用 180 MB 以内的模板。')}
 const candidates=files.filter(f=>/(^|\/)meta\.json$/.test(f.name));
 if(!candidates.length)throw Error('没有找到 meta.json。请导入 Readingo 导出的笔记分享模板 ZIP。');
 let selected=candidates.find(f=>f.name==='meta.json');if(!selected){if(candidates.length!==1)throw Error('ZIP 内有多个模板，请一次导入一个。');selected=candidates[0]}
 let meta;try{meta=JSON.parse(await selected.async('string'))}catch{throw Error('meta.json 不是有效的 JSON 文件。')}
 if(meta?.type!=='reader_share_template'||meta.version!==1)throw Error('暂支持 type 为 reader_share_template、version 为 1 的 Readingo 模板。');
 const entry=safePath(meta.entry||'index.html');if(!/\.html?$/i.test(entry))throw Error('模板入口必须是 HTML 文件。');
 const prefix=selected.name.slice(0,-9);const entryFile=zip.file(prefix+entry);if(!entryFile)throw Error('找不到 meta.json 指定的 HTML 入口：'+entry);
 const html=await entryFile.async('string');if(!/<html[\s>]/i.test(html)||!/<\/head\s*>/i.test(html))throw Error('模板入口不是完整的 HTML 文档。');
 const entries=new Map();for(const f of files){if(f.name.startsWith(prefix)){const name=safePath(f.name.slice(prefix.length));entries.set(name,f)}}
 return {zip,entries,meta,entry,html,name:meta.name||filename.replace(/\.zip$/i,''),filename,sourceSize:bytes.byteLength};
}
export async function readFont(data,name){
 if(!data.byteLength)throw Error('字体文件为空。');if(data.byteLength>60*1024*1024)throw Error('请选择 60 MB 以内的字体文件。');
 const b=new Uint8Array(data);const tag=String.fromCharCode(...b.slice(0,4));
 let ext,format;if(b[0]===0&&b[1]===1&&b[2]===0&&b[3]===0||tag==='true'){ext='ttf';format='truetype'}else if(tag==='OTTO'){ext='otf';format='opentype'}else if(tag==='wOFF'){ext='woff';format='woff'}else if(tag==='wOF2'){ext='woff2';format='woff2'}else throw Error('无法识别字体内容，请选择有效的 TTF、OTF、WOFF 或 WOFF2 文件（不支持 TTC）。');
 // Parse and load the actual font, rather than trusting its filename or header alone.
 if(globalThis.FontFace){try{const face=new FontFace('LoviaFontValidation',data.slice(0));await face.load()}catch{throw Error('浏览器无法读取此字体，文件可能已损坏，请更换字体文件。')}}
 return {data:new Uint8Array(data),name,ext,format,size:data.byteLength,mime:'font/'+ext};
}
function addBefore(html,close,fragment){return html.replace(new RegExp('</'+close+'\\s*>','i'),()=>fragment+'\n</'+close+'>')}
export function removeOwnInjection(html){return html.replace(/<style\b[^>]*\bid=["']lovia-embedded-font["'][^>]*>[\s\S]*?<\/style\s*>/gi,'').replace(/<script\b[^>]*\bid=["']lovia-font-ready["'][^>]*>[\s\S]*?<\/script\s*>/gi,'')}
function relativeFont(entry,fontpath){const up=entry.split('/').length-1;return '../'.repeat(up)+fontpath}
function fontWaitScript(){
 return `<script id="${SCRIPT_ID}">(function(){'use strict';var family='${FONT_FAMILY}',loaded=document.fonts?document.fonts.load('16px "'+family+'"').then(function(){return document.fonts.ready}):Promise.resolve();function frames(){return new Promise(function(r){requestAnimationFrame(function(){requestAnimationFrame(r)})})}var original=[],wrapped=[];function wrap(fn){var i=original.indexOf(fn);if(i>=0)return wrapped[i];var w=function(){var self=this,args=arguments;return loaded.then(function(){return fn.apply(self,args)}).then(function(v){return frames().then(function(){return v})})};original.push(fn);wrapped.push(w);return w}['ReaderShareTemplate','ReedenShareTemplate','ReadingoShareTemplate'].forEach(function(k){var api=window[k];if(!api)return;['render','ready','prepareForExport'].forEach(function(method){if(typeof api[method]==='function')api[method]=wrap(api[method])})});if(typeof window.render==='function')window.render=wrap(window.render);loaded.then(frames).then(function(){window.dispatchEvent(new Event('resize'))});})();<\/script>`;
}
export function embedHtml(template,font,{scope='all',fontUrl,name}={}){
 let html=removeOwnInjection(template.html);const path='fonts/lovia-embedded.'+font.ext;const src=fontUrl||relativeFont(template.entry,path);
 const selectors=scope==='all'?'html,body,body *,body *::before,body *::after':TEXT_SELECTOR.split(',').flatMap(s=>[s,s+' *',s+'::before',s+'::after']).join(',');
 const css=`<style id="${STYLE_ID}">@font-face{font-family:"${FONT_FAMILY}";src:url("${src}") format("${font.format}");font-style:normal;font-weight:100 900;font-display:block}${scope==='all'?':root{--content-font:"'+FONT_FAMILY+'",serif!important}':''}${selectors}{font-family:"${FONT_FAMILY}",serif!important}</style>`;
 html=addBefore(html,'head',css);html=/<\/body\s*>/i.test(html)?addBefore(html,'body',fontWaitScript()):html+fontWaitScript();
 if(name){const escape=s=>s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');html=html.replace(/(<meta\b[^>]*\bname=["']reeden-template-name["'][^>]*\bcontent=["'])[^"']*(["'])/i,(_,a,b)=>a+escape(name)+b);html=html.replace(/<title>[\s\S]*?<\/title>/i,()=>'<title>'+escape(name)+'</title>')}
 return html;
}
export function hasTextTargets(template){const d=new DOMParser().parseFromString(template.html,'text/html');return !!d.querySelector(TEXT_SELECTOR)}
export async function buildArchive(template,font,options,onProgress=()=>{}){
 const html=embedHtml(template,font,options);const output=new JSZip();
 for(const [path,f] of template.entries){if(path===template.entry||path==='meta.json'||/^fonts\/lovia-embedded\.(ttf|otf|woff2?)$/i.test(path))continue;output.file(path,await f.async('uint8array'))}
 const meta={...template.meta,name:options.name||template.name,entry:template.entry};
 output.file('meta.json',JSON.stringify(meta,null,2));output.file(template.entry,html);output.file('fonts/lovia-embedded.'+font.ext,font.data);
 const data=await output.generateAsync({type:'uint8array',compression:'DEFLATE',compressionOptions:{level:9},mimeType:'application/zip'},m=>onProgress(m.percent));
 // Reopen the generated ZIP and verify manifest, entry and byte-exact font integrity.
 const verify=await JSZip.loadAsync(data,{checkCRC32:true});const fm=JSON.parse(await verify.file('meta.json').async('string'));
 if(!verify.file(fm.entry))throw Error('导出校验失败：缺少 HTML 入口。');const check=await verify.file('fonts/lovia-embedded.'+font.ext).async('uint8array');
 if(check.length!==font.data.length||check.some((v,i)=>v!==font.data[i]))throw Error('导出校验失败：字体数据不一致。');
 return {data,html,meta};
}
export function asDataUrl(data,mime){let s='';for(let i=0;i<data.length;i+=32768)s+=String.fromCharCode(...data.subarray(i,i+32768));return 'data:'+mime+';base64,'+btoa(s)}
function mimeFor(path){const ext=path.split('.').pop().toLowerCase();return ({woff2:'font/woff2',woff:'font/woff',ttf:'font/ttf',otf:'font/otf',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif',svg:'image/svg+xml',css:'text/css',js:'text/javascript'})[ext]||'application/octet-stream'}
function resolveAsset(base,path){if(/^(data:|blob:|https?:|\/\/|#)/i.test(path))return null;try{const u=new URL(path,'https://local.invalid/'+base);if(u.origin!=='https://local.invalid')return null;return decodeURIComponent(u.pathname.slice(1))}catch{return null}}
export async function previewHtml(template,font,options={}){
 const custom=!!font;let html=custom?embedHtml(template,font,{...options,fontUrl:asDataUrl(font.data,font.mime)}):template.html;
 const cache=new Map();async function asset(path,trail=[]){if(cache.has(path))return cache.get(path);if(trail.includes(path))return null;const f=template.entries.get(path);if(!f)return null;let data;if(/\.css$/i.test(path)){let css=await f.async('string');const matches=[...css.matchAll(/url\(\s*(["']?)([^)'"\n]+)\1\s*\)/gi)];for(const m of matches){const ref=resolveAsset(path,m[2]);if(ref){const uri=await asset(ref,[...trail,path]);if(uri)css=css.replace(m[0],()=>`url("${uri}")`)}}data=new TextEncoder().encode(css)}else data=await f.async('uint8array');const url=asDataUrl(data,mimeFor(path));cache.set(path,url);return url}
 // Preserve real resource references in srcdoc by inlining local bundle assets.
 const refs=[...html.matchAll(/\b(src|href)\s*=\s*(["'])([^"']+)\2/gi)];for(const m of refs){const path=resolveAsset(template.entry,m[3]);if(path){const url=await asset(path);if(url)html=html.replace(m[0],()=>m[1]+'='+m[2]+url+m[2])}}
 const cssRefs=[...html.matchAll(/url\(\s*(["']?)([^)'"\n]+)\1\s*\)/gi)];for(const m of cssRefs){const path=resolveAsset(template.entry,m[2]);if(path){const url=await asset(path);if(url)html=html.replace(m[0],()=>`url("${url}")`)}}
 // Sandboxed preview cannot contact outside servers or navigate the parent.
 const csp=`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' data:; style-src 'unsafe-inline' data:; img-src data: blob:; font-src data: blob:; media-src data: blob:; connect-src 'none'; form-action 'none'; base-uri 'none'">`;
 html=html.replace(/<head\b[^>]*>/i,m=>m+csp);
 const channel=options.channel||'';const sample=JSON.stringify(options.sample||{}).replace(/</g,'\\u003c');
 const bridge=`<script>(function(){var channel=${JSON.stringify(channel)};function send(type,extra){parent.postMessage(Object.assign({loviaPreview:true,channel:channel,type:type},extra||{}),'*')}function api(){return window.ReaderShareTemplate||window.ReedenShareTemplate||window.ReadingoShareTemplate}var payload=${sample};function render(p){var a=api(),fn=a&&a.render||window.render;try{var value=fn?fn.call(a,p):null;Promise.resolve(value).then(function(){send('ready')}).catch(function(e){send('error',{message:e.message})})}catch(e){send('error',{message:e.message})}}window.addEventListener('message',function(e){if(e.source===parent&&e.data&&e.data.loviaPreview&&e.data.channel===channel&&e.data.type==='sample')render(e.data.payload)});window.addEventListener('error',function(e){send('error',{message:e.message})});render(payload);})();<\/script>`;
 return /<\/body\s*>/i.test(html)?addBefore(html,'body',bridge):html+bridge;
}
