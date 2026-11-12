import JSZip from './zip-codec.js?v=20261112-2';
/* Readingo ZIP manipulation. No network requests; all data stays in memory. */
export const FONT_FAMILY = 'LoviaEmbeddedFont';
const STYLE_ID='lovia-embedded-font';
export const TEXT_SELECTOR = '[data-red-text="note.description"],[data-red-text="note.content"],[data-red-text="note.comment"],[data-reeden-text="note.description"],[data-reeden-text="note.comment"],#excerpt,#thought,#content,#note,.excerpt,.text-block,.note-content,.note-text,.thought,.comment';
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
export async function readFont(data,name,{allowPreviewFailure=false}={}){
 if(!data.byteLength)throw Error('字体文件为空。');if(data.byteLength>60*1024*1024)throw Error('请选择 60 MB 以内的字体文件。');
 const b=new Uint8Array(data);const tag=String.fromCharCode(...b.slice(0,4));
 let ext,format;if(b[0]===0&&b[1]===1&&b[2]===0&&b[3]===0||tag==='true'){ext='ttf';format='truetype'}else if(tag==='OTTO'){ext='otf';format='opentype'}else if(tag==='wOFF'){ext='woff';format='woff'}else if(tag==='wOF2'){ext='woff2';format='woff2'}else throw Error('无法识别字体内容，请选择有效的 TTF、OTF、WOFF 或 WOFF2 文件（不支持 TTC）。');
 // Parse and load the actual font, rather than trusting its filename or header alone.
 let previewSupported=true;
 if(globalThis.FontFace){try{const face=new FontFace('LoviaFontValidation',data.slice(0));await face.load()}catch{
  // Some native-supported WOFF fonts are rejected by Chromium's sanitizer.
  // Recovery may retain a structurally valid bundle font without claiming it
  // can be previewed here. Manually selected corrupt fonts still fail closed.
  const view=new DataView(b.buffer,b.byteOffset,b.byteLength),count=b.length>=44?view.getUint16(12):0;
  let valid=ext==='woff'&&b.length>=44&&view.getUint32(8)===b.length&&count>0&&44+count*20<=b.length;
  for(let i=0;valid&&i<count;i++){const p=44+i*20,offset=view.getUint32(p+4),size=view.getUint32(p+8),original=view.getUint32(p+12);valid=offset>=44+count*20&&offset+size<=b.length&&size<=original}
  if(!allowPreviewFailure||!valid)throw Error('浏览器无法读取此字体，文件可能已损坏，请更换字体文件。');
  previewSupported=false;
 }}
 return {data:new Uint8Array(data),name,ext,format,size:data.byteLength,mime:'font/'+ext,previewSupported};
}
// Recover the exact font from ZIPs generated by older studio versions. This
// lets a failed export be repaired without requiring the original font file.
export async function readTemplateFont(template){
 const own=template.html.match(/<style\b[^>]*\bid=["']lovia-embedded-font["'][^>]*>([\s\S]*?)<\/style\s*>/i);
 const faces=[...(own?own[1]:template.html).matchAll(/@font-face\s*\{[^}]*\}/gi)];
 const sources=[...new Set(faces.flatMap(face=>[...face[0].matchAll(/url\(\s*(["']?)([^)'"\s]+)\1\s*\)/gi)].map(m=>m[2])))];
 // Ambiguous multi-font templates require an explicit font choice.
 if(sources.length!==1)return null;
 const data=sources[0].match(/^data:[^;]+;base64,([A-Za-z0-9+/=]+)$/i);
 if(data){const raw=atob(data[1]);const bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);return readFont(bytes,'模板内置字体',{allowPreviewFailure:true})}
 const path=resolveAsset(template.entry,sources[0]);const file=path&&template.entries.get(path);if(!file)return null;
 return readFont(await file.async('uint8array'),'模板内置字体',{allowPreviewFailure:true});
}
function addBefore(html,close,fragment){return html.replace(new RegExp('</'+close+'\\s*>','i'),()=>fragment+'\n</'+close+'>')}
export function removeOwnInjection(html){return html.replace(/<style\b[^>]*\bid=["'](?:lovia-embedded-font|lovia-bundle-fonts)["'][^>]*>[\s\S]*?<\/style\s*>/gi,'').replace(/<script\b[^>]*\bid=["']lovia-font-ready["'][^>]*>[\s\S]*?<\/script\s*>/gi,'')}
// Keep the full font in the ZIP, matching the user-verified Readingo package.
// Only the sandboxed website preview uses data URLs.
// WOFF compresses complete SFNT tables; every glyph and layout table is kept.
export async function compactFont(font){
 if(!['ttf','otf'].includes(font.ext)||!globalThis.CompressionStream)return font;
 const bytes=font.data,view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),count=view.getUint16(4);
 if(!count||count>256||12+count*16>bytes.length)return font;
 const tables=[];let length=44+20*count,sfntSize=12+16*count;
 for(let i=0;i<count;i++){
  const p=12+i*16,offset=view.getUint32(p+8),size=view.getUint32(p+12);
  if(offset+size>bytes.length)return font;
  const raw=bytes.slice(offset,offset+size);
  const compressed=new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
  const data=compressed.length<raw.length?compressed:raw;
  tables.push({tag:view.getUint32(p),checksum:view.getUint32(p+4),size,data,offset:length});
  length+=(data.length+3)&~3;sfntSize+=(size+3)&~3;
 }
 const data=new Uint8Array(length),out=new DataView(data.buffer);
 out.setUint32(0,0x774f4646);out.setUint32(4,view.getUint32(0));out.setUint32(8,length);out.setUint16(12,count);out.setUint32(16,sfntSize);out.setUint16(20,1);
 tables.forEach((t,i)=>{const p=44+i*20;out.setUint32(p,t.tag);out.setUint32(p+4,t.offset);out.setUint32(p+8,t.data.length);out.setUint32(p+12,t.size);out.setUint32(p+16,t.checksum);data.set(t.data,t.offset)});
 if(data.length>=bytes.length)return font;
 return readFont(data,font.name.replace(/\.(?:ttf|otf)$/i,'')+'.woff');
}
// Repair only the known ruled-note runtime. Other templates, including the
// user-verified gold template, retain their original JavaScript byte for byte.
export function repairTemplateContract(html){
 if(!html.includes('function syncRules()')||!html.includes('sourceKey=')||!html.includes('function settle()')||!html.includes('function getConfig()'))return html;
 html=html.replace(/(#snapshot\{[^}]*?)max-width:100%;/,'$1');
 html=html.replace(/window\.ReedenShareTemplate\.ready=ready;/g,'');
 html=html.replace(/root\.(?:removeAttribute\('data-layout-ready'\)|dataset\.layoutReady='false')/g,"root.setAttribute('data-layout-ready','false')");
 html=html.replace(/function settle\(\)\{[\s\S]*?(?=\nfunction render\(payload\))/,
 `function settle(){var turn=++serial;root.setAttribute('data-layout-ready','false');root.getBoundingClientRect();var fontReady=document.fonts?Promise.all([document.fonts.load('400 16px "LoviaEmbeddedFont"','正文笔记与想法'),document.fonts.ready]):Promise.resolve();ready=fontReady.then(frames).then(function(){if(turn===serial){scale();syncRules();root.dataset.layoutReady='true'}return metrics()});return ready}
`);
 // Both the original runtime and the previously generated interface patch.
 html=html.replaceAll('paint();settle();return root}', 'paint();return settle()}');
 html=html.replaceAll('paint();return settle().then(metrics)}', 'paint();return settle()}');
 const width="var w=Number(p.posterWidth)||375;w=Math.max(120,Math.min(4096,w));root.style.width=w+'px';";
 if(!html.includes(width))html=html.replace('var n=p.note',width+'var n=p.note');
 html=html.replace(/var api=\{render:render[^\n]*?\};/,
 "var api={render:render,ready:function(){return ready.then(frames).then(metrics)},getConfig:getConfig,setConfig:setConfig,getExportMetrics:metrics,measureLayout:metrics,prepareForExport:function(){closeEditor();return ready.then(frames).then(function(){scale();syncRules();return metrics()})},finishExport:function(){}};");
 return html;
}
function repairOffscreenFrames(html){
 // Apply the bounded fallback only to the identified ruled-note runtime.
 if(!html.includes('function syncRules()')||!html.includes('sourceKey='))return html;
 return html.replace('function frames(){return new Promise(function(resolve){requestAnimationFrame(function(){requestAnimationFrame(resolve)})})}',
 'function frames(){return new Promise(function(resolve){var done=false,t=setTimeout(finish,80);function finish(){if(done)return;done=true;clearTimeout(t);resolve()}requestAnimationFrame(function(){requestAnimationFrame(finish)})})}');
}
function replaceOriginalFaces(html,src,font){
 // Preserve original family aliases so existing document.fonts.load calls and
 // render scripts keep working. Replace only CSS sources, never script text.
 return html.replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi,style=>style.replace(/@font-face\s*\{[^}]*\}/gi,face=>face.replace(/src\s*:[^;}]*/i,()=>`src:url("${src}") format("${font.format}")`)));
}
export function embedHtml(template,font,{scope='all',fontUrl,name}={}){
 let html=repairOffscreenFrames(repairTemplateContract(removeOwnInjection(template.html)));const src=fontUrl||asDataUrl(font.data,font.mime);if(scope==='all')html=replaceOriginalFaces(html,src,font);
 const selectors=scope==='all'?'html,body,body *,body *::before,body *::after':TEXT_SELECTOR.split(',').flatMap(s=>[s,s+' *',s+'::before',s+'::after']).join(',');
 const css=`<style id="${STYLE_ID}">@font-face{font-family:"${FONT_FAMILY}";src:url("${src}") format("${font.format}");font-style:normal;font-weight:400;font-display:block}${scope==='all'?':root{--content-font:"'+FONT_FAMILY+'",serif!important}':''}${selectors}{font-family:"${FONT_FAMILY}",serif!important}</style>`;
 html=addBefore(html,'head',css);
 if(name){const escape=s=>s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');html=html.replace(/(<meta\b[^>]*\bname=["']reeden-template-name["'][^>]*\bcontent=["'])[^"']*(["'])/i,(_,a,b)=>a+escape(name)+b);html=html.replace(/<title>[\s\S]*?<\/title>/i,()=>'<title>'+escape(name)+'</title>')}
 return html;
}
export function hasTextTargets(template){const d=new DOMParser().parseFromString(template.html,'text/html');return !!d.querySelector(TEXT_SELECTOR)}
export async function buildArchive(template,font,options={},onProgress=()=>{}){
 font=await compactFont(font);
 const output=new JSZip(),fontName='lovia-embedded.'+font.ext;
 const base=template.entry.slice(0,template.entry.lastIndexOf('/')+1);
 const fontPath=base+'fonts/'+fontName;
 const html=embedHtml(template,font,{...options,fontUrl:'./fonts/'+fontName});
 // Keep all template resources. Prune an old font only when no HTML, stylesheet
 // or script still refers to it; linked CSS may use fonts absent from the HTML.
 let references=html;
 for(const [path,f] of template.entries)if(/\.(?:css|js)$/i.test(path))references+='\n'+await f.async('string');
 for(const [path,f] of template.entries){
  if(path===template.entry||path==='meta.json'||path===fontPath)continue;
  if(/\.(woff2?|ttf|otf)$/i.test(path)&&!references.includes(path)&&!references.includes(path.split('/').pop()))continue;
  output.file(path,await f.async('uint8array'));
 }
 const meta={...template.meta,name:options.name||template.name,entry:template.entry};
 output.file('meta.json',JSON.stringify(meta,null,2));output.file(template.entry,html);
 output.file(fontPath,font.data);
 const data=await output.generateAsync({type:'uint8array',compression:'DEFLATE',compressionOptions:{level:9},mimeType:'application/zip'},m=>onProgress(m.percent));
 const verify=await JSZip.loadAsync(data,{checkCRC32:true});const fm=JSON.parse(await verify.file('meta.json').async('string'));
 if(!verify.file(fm.entry))throw Error('导出校验失败：缺少 HTML 入口。');
 const verifiedHtml=await verify.file(fm.entry).async('string');
 if(!verifiedHtml.includes('src:url("./fonts/'+fontName+'")'))throw Error('导出校验失败：缺少包内字体引用。');
 const file=verify.file(fontPath);if(!file)throw Error('导出校验失败：缺少包内字体文件。');
 const bytes=await file.async('uint8array');
 if(bytes.length!==font.data.length||bytes.some((byte,i)=>byte!==font.data[i]))throw Error('导出校验失败：字体数据不一致。');
 if(/<script\b[^>]*\bid=["']lovia-font-ready["']/i.test(verifiedHtml))throw Error('导出校验失败：旧版导出适配代码未清理。');
 return {data,html,meta};
}
export function asDataUrl(data,mime){let s='';for(let i=0;i<data.length;i+=32768)s+=String.fromCharCode(...data.subarray(i,i+32768));return 'data:'+mime+';base64,'+btoa(s)}
function mimeFor(path){const ext=path.split('.').pop().toLowerCase();return ({woff2:'font/woff2',woff:'font/woff',ttf:'font/ttf',otf:'font/otf',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif',svg:'image/svg+xml',css:'text/css',js:'text/javascript'})[ext]||'application/octet-stream'}
function resolveAsset(base,path){if(/^(data:|blob:|https?:|\/\/|#)/i.test(path))return null;try{const u=new URL(path,'https://local.invalid/'+base);if(u.origin!=='https://local.invalid')return null;return decodeURIComponent(u.pathname.slice(1))}catch{return null}}
async function inlineFontCss(template,css,base){
 const matches=[...css.matchAll(/url\(\s*(["']?)([^)'"\n]+)\1\s*\)/gi)];
 const cache=new Map();
 for(const match of matches){
  const path=resolveAsset(base,match[2]);
  if(!path||!/(?:\.woff2?|\.ttf|\.otf)$/i.test(path))continue;
  const file=template.entries.get(path);if(!file)continue;
  if(!cache.has(path))cache.set(path,asDataUrl(await file.async('uint8array'),mimeFor(path)));
  css=css.replace(match[0],()=>`url("${cache.get(path)}")`);
 }
 return css;
}
async function inlineBundleFonts(template,html){
 // Inline font URLs already declared in the document, preserving the template's
 // original scripts, layout rules and interface contracts.
 const styles=[...html.matchAll(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi)];
 for(const style of styles){const updated=await inlineFontCss(template,style[0],template.entry);if(updated!==style[0])html=html.replace(style[0],()=>updated)}
 // Linked sheets keep their original paths, media attributes, integrity values
 // and bytes. Copy only local @font-face rules into the document for exporters.
 const faces=[];const links=[...html.matchAll(/<link\b[^>]*>/gi)];
 for(const link of links){
  if(!/\brel\s*=\s*["']stylesheet["']/i.test(link[0]))continue;
  const href=link[0].match(/\bhref\s*=\s*(["'])([^"']+)\1/i);if(!href)continue;
  const path=resolveAsset(template.entry,href[2]);const file=path&&template.entries.get(path);if(!file||!/\.css$/i.test(path))continue;
  const css=await file.async('string');
  for(const match of css.matchAll(/@font-face\s*\{[^}]*\}/gi)){const updated=await inlineFontCss(template,match[0],path);if(updated!==match[0])faces.push(updated)}
 }
 if(faces.length)html=addBefore(html,'head','<style id="lovia-bundle-fonts">'+faces.join('\n').replace(/<\/style/gi,'<\\/style')+'</style>');
 return html;
}
export async function previewHtml(template,font,options={}){
 const custom=!!font;if(font)font=await compactFont(font);let html=custom?await inlineBundleFonts(template,embedHtml(template,font,options)):template.html;
 if(custom&&font.previewSupported===false)html=html.replace(/@font-face\s*\{[^}]*\}/gi,'');
 const cache=new Map();async function asset(path,trail=[]){if(cache.has(path))return cache.get(path);if(trail.includes(path))return null;const f=template.entries.get(path);if(!f)return null;let data;if(/\.css$/i.test(path)){let css=await f.async('string');const matches=[...css.matchAll(/url\(\s*(["']?)([^)'"\n]+)\1\s*\)/gi)];for(const m of matches){const ref=resolveAsset(path,m[2]);if(ref){const uri=await asset(ref,[...trail,path]);if(uri)css=css.replace(m[0],()=>`url("${uri}")`)}}data=new TextEncoder().encode(css)}else data=await f.async('uint8array');const url=asDataUrl(data,mimeFor(path));cache.set(path,url);return url}
 // Preserve real resource references in srcdoc by inlining local bundle assets.
 const refs=[...html.matchAll(/\b(src|href)\s*=\s*(["'])([^"']+)\2/gi)];for(const m of refs){const path=resolveAsset(template.entry,m[3]);if(path){const url=await asset(path);if(url)html=html.replace(m[0],()=>m[1]+'='+m[2]+url+m[2])}}
 const cssRefs=[...html.matchAll(/url\(\s*(["']?)([^)'"\n]+)\1\s*\)/gi)];for(const m of cssRefs){const path=resolveAsset(template.entry,m[2]);if(path){const url=await asset(path);if(url)html=html.replace(m[0],()=>`url("${url}")`)}}
 // Sandboxed preview cannot contact outside servers or navigate the parent.
 const csp=`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' data:; style-src 'unsafe-inline' data:; img-src data: blob:; font-src data: blob:; media-src data: blob:; connect-src 'none'; form-action 'none'; base-uri 'none'">`;
 html=html.replace(/<head\b[^>]*>/i,m=>m+csp);
 const channel=options.channel||'';const sample=JSON.stringify(options.sample||{}).replace(/</g,'\\u003c');
 const bridge=`<script>(function(){var channel=${JSON.stringify(channel)};function send(type,extra){parent.postMessage(Object.assign({loviaPreview:true,channel:channel,type:type},extra||{}),'*')}function api(){return window.ReaderShareTemplate||window.ReedenShareTemplate||window.ReadingoShareTemplate}var payload=${sample};function render(p){var a=api(),fn=a&&a.render||window.render;try{var value=fn?fn.call(a,p):null;Promise.resolve(value).then(function(){return a?(typeof a.ready==='function'?a.ready():a.ready):null}).then(function(){return a&&typeof a.prepareForExport==='function'?a.prepareForExport():null}).then(function(){send('ready')}).catch(function(e){send('error',{message:e.message})})}catch(e){send('error',{message:e.message})}}window.addEventListener('message',function(e){if(e.source===parent&&e.data&&e.data.loviaPreview&&e.data.channel===channel&&e.data.type==='sample')render(e.data.payload)});window.addEventListener('error',function(e){send('error',{message:e.message})});render(payload);})();<\/script>`;
 return /<\/body\s*>/i.test(html)?addBefore(html,'body',bridge):html+bridge;
}
