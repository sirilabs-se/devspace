const $=s=>document.querySelector(s);
const P={tune:'M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z',stop:'M6 6h12v12H6z',play:'M8 5v14l11-7z',pause:'M6 19h4V5H6zm8-14v14h4V5z',next:'M6 18l8.5-6L6 6zM16 6v12h2V6z',prev:'M6 6h2v12H6zm3.5 6l8.5 6V6z',shuf:'M10.6 9.2 5.4 4 4 5.4l5.2 5.2zM14.5 4l2 2L4 18.6 5.4 20 18 7.5l2 2V4zm.3 9.4-1.4 1.4 3.1 3.1-2 2H20v-5.5l-2 2z',gear:'M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7zM20.5 13.5v-3l-2.2-.4a7 7 0 00-.8-1.9l1.3-1.8-2.1-2.1-1.8 1.3a7 7 0 00-1.9-.8l-.4-2.2h-3l-.4 2.2a7 7 0 00-1.9.8L6.4 4.2 4.3 6.3l1.3 1.8a7 7 0 00-.8 1.9l-2.2.4v3l2.2.4a7 7 0 00.8 1.9l-1.3 1.8 2.1 2.1 1.8-1.3a7 7 0 001.9.8l.4 2.2h3l.4-2.2a7 7 0 001.9-.8l1.8 1.3 2.1-2.1-1.3-1.8a7 7 0 00.8-1.9z',x:'M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z',back:'M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20z',drag:'M9 4a2 2 0 100 4 2 2 0 000-4zm6 0a2 2 0 100 4 2 2 0 000-4zM9 10a2 2 0 100 4 2 2 0 000-4zm6 0a2 2 0 100 4 2 2 0 000-4zM9 16a2 2 0 100 4 2 2 0 000-4zm6 0a2 2 0 100 4 2 2 0 000-4z',hp:'M12 3a9 9 0 00-9 9v7a2 2 0 002 2h4v-8H5v-1a7 7 0 0114 0v1h-4v8h4a2 2 0 002-2v-7a9 9 0 00-9-9z',vol:'M3 9v6h4l5 5V4L7 9zm13.5 3A4.5 4.5 0 0014 8v8a4.5 4.5 0 002.5-4z',loop:'M7 7h10v3l4-4-4-4v3H5v6h2zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2z',plus:'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z',edit:'M3 17.3V21h3.8L17.8 9.9l-3.8-3.8zM20.7 7a1 1 0 000-1.4l-2.3-2.3a1 1 0 00-1.4 0l-1.8 1.8 3.7 3.7z',del:'M6 19a2 2 0 002 2h8a2 2 0 002-2V7H6zM19 4h-3.5l-1-1h-5l-1 1H5v2h14z',vid:'M4 6h11a2 2 0 012 2v2.5l4-3v9l-4-3V16a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2z',mute:'M16.5 12A4.5 4.5 0 0014 8v2.2l2.5 2.5zM19 12c0 .9-.2 1.8-.5 2.6l1.5 1.5A9 9 0 0021 12a9 9 0 00-7-8.8v2.1A7 7 0 0119 12zM4.3 3 3 4.3 7.7 9H3v6h4l5 5v-6.7l4.3 4.3c-.7.5-1.4.9-2.3 1.1v2.1a9 9 0 003.7-1.8l2 2 1.3-1.3L12 7.7zM12 4 9.9 6.1 12 8.2z',pla:'M14 10H3v2h11zm0-4H3v2h11zM3 16h7v-2H3zM17 10v4h-4v2h4v4h2v-4h4v-2h-4v-4z'};
const ic=(d,s=20)=>`<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="currentColor" fill-rule="evenodd" aria-hidden="true"><path d="${d}"/></svg>`;
const V=[['Lofi focus mix – deep work beats','Chill Archive',3612,210],['Full album stream – ambient classics','Warp Listening',2780,150],['How the Fourier transform really works','Signal Lab',1105,260],['Jazz for rainy Sunday afternoons','Blue Room',4210,30],['Stockholm ambient field recordings','Nordic Tapes',1860,180],['Podcast: building audio-first apps','Dev Radio',2340,280],['Classical piano for studying','Keys & Co',3300,330],['Synthwave night drive','Neon Roads',2650,300],['Deep house live set','Club Archive',5400,10],['Acoustic covers session','Open Strings',2980,50]].map((a,i)=>({id:'v'+i,t:a[0],c:a[1],d:a[2],h:a[3]}));
const vb=id=>V.find(v=>v.id===id),SP=[.5,.75,1,1.25,1.5,1.75,2];V[1].tr=V[5].tr=['Original','Español','Deutsch'];
const DEF={save:1,resume:1,speed:1,vol:80,theme:'system',accent:'#d93025',autoOff:0};
const S={tab:'player',set:0,audio:1,play:1,pos:312,cur:V[0],q:[V[2],V[3],V[4],V[5]],hist:[],loop:'off',speed:1,vol:80,sleep:0,sleepLeft:0,fail:null,uf:null,toast:null,vb:0,opt:0,trk:{},nv:'',perr:'',sq:0,pl:[{id:0,n:'Listen later',pin:1,i:['v1','v7']},{id:1,n:'Focus',i:['v0','v4','v6']},{id:2,n:'Evening jazz',i:['v3','v9']}],pid:3,open:null,edit:0,add:0,err:'',st:{...DEF}};
const fmt=s=>{s=Math.max(0,s|0);const h=s/3600|0,m=s%3600/60|0;return (h?h+':'+String(m).padStart(2,'0'):m)+':'+String(s%60).padStart(2,'0')};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const g=h=>`background:linear-gradient(135deg,hsl(${h} 60% 45%),hsl(${(h+50)%360} 60% 28%))`;
const th=v=>`<span class="th" style="${g(v.h)}"></span>`;
const logo=n=>`<span class="lg" style="width:${n}px;height:${n}px;border-radius:${n/4}px">${ic(P.hp,n*.6|0)}</span>`;
const cover=()=>`<div class="cover">${logo(48)}<span>Audio only</span></div>`;
const sw=(a,v,l,k='')=>`<button class="sw" role="switch" aria-checked="${!!v}" aria-label="${l}" data-a="${a}" data-i="${k}"><i></i></button>`;
const PL=()=>S.pl.find(p=>p.id===S.open);
const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]]}return a};
let tt;const T=(m,u)=>{S.uf=typeof u==='function'?u:null;S.toast={m:esc(m),u:!!S.uf};clearTimeout(tt);tt=setTimeout(()=>{S.toast=null;R()},10000)};
const snap=()=>({cur:S.cur,pos:S.pos,play:S.play,hist:[...S.hist],q:[...S.q]}),cap=()=>{while(S.hist.length>50)S.hist.shift()};
const nm=x=>x.trim().replace(/\s+/g,' ').normalize('NFC');
function chk(raw,self){const n=nm(raw);if(!n)return[n,'Name required'];if(n.length>60)return[n,'Max 60 characters'];if(S.pl.some(p=>p.id!==self&&p.n.toLowerCase()===n.toLowerCase()))return[n,'Name already used'];if(self===-1&&S.pl.length>=25)return[n,'Limit of 25 playlists'];return[n,'']}
const uniq=b=>{let n=b,i=2;while(S.pl.some(p=>p.n.toLowerCase()===n.toLowerCase()))n=b+' ('+i+++')';return n};
const plsnap=()=>JSON.stringify(S.pl),plundo=j=>()=>{S.pl=JSON.parse(j)};
function go(v){if(S.cur&&S.cur!==v){S.hist.push(S.cur);cap()}S.cur=v;S.pos=0;S.play=1;S.fail=null;S.q=S.q.filter(x=>x!==v)}
function addv(v){if(v===S.cur)return'Already playing';if(S.q.includes(v))return'Already in the queue';if(!S.cur&&!S.q.length){go(v);return''}if(S.q.length>=1000)return'Queue is full (1000)';S.q.push(v);return'ok'}
const FM={unavail:['This video is unavailable or age-restricted.','Skip to next'],closed:['The playback tab was closed.','Reopen tab'],offline:['You appear to be offline.','Retry']};
function nxt(){S.fail=null;if(!S.q.length&&S.loop==='queue'){if(S.hist.length){S.q=[...S.hist];S.hist=[]}else if(S.cur){S.pos=0;S.play=1;return}}
if(S.q.length){go(S.q[0]);return}if(!S.cur)return;
if(!S.st.autoOff){const y=rnd();if(y){go(y);T('YouTube chose the next video');return}}
S.hist.push(S.cur);cap();S.cur=null;S.play=0;T('Queue finished. Playback stopped.')}
function ended(){if(S.sleep===-1){S.sleep=0;nxt();S.play=0;T('Sleep timer: paused at the end of the video');return}if(S.loop==='one'){S.pos=0;return}nxt()}
function mv(l,i,j){const a=l==='q'?S.q:PL().i;if(j<0||j>=a.length||i===j)return;a.splice(j,0,...a.splice(i,1))}
function playPl(sh){const l=PL().i.map(vb);if(!l.length)return;if(sh)shuffle(l);const o=snap();if(S.cur){S.hist.push(S.cur);cap()}S.cur=l.shift();S.q=l;S.pos=0;S.play=1;S.fail=null;T('Playing “'+PL().n+'”',()=>Object.assign(S,o))}
const rnd=()=>{const c=V.filter(v=>v!==S.cur&&!S.q.includes(v));return c[Math.random()*c.length|0]};
const A={
tab:i=>{S.tab=i;S.open=null;S.rs=1},gear:()=>{S.set=+!S.set;S.rs=1},aud:()=>{S.audio=+!S.audio},aud1:()=>{S.audio=1},aud0:()=>{S.audio=0},
slp:i=>{S.sleep=+i;S.sleepLeft=S.sleep>0?S.sleep*60:0},spdset:i=>{S.speed=+i},spdm:()=>{S.speed=SP[Math.max(0,SP.indexOf(S.speed)-1)]},spdp:()=>{S.speed=SP[Math.min(SP.length-1,SP.indexOf(S.speed)+1)]},
mute:()=>{S.muted=+!S.muted},vb:()=>{S.vb=+!S.vb},opt:()=>{S.opt=1},optx:()=>{S.opt=0},
stop:()=>{if(!S.cur)return;const o=snap();S.hist.push(S.cur);cap();S.cur=null;S.play=0;S.opt=0;S.fail=null;T('Stopped. Your queue is still here.',()=>Object.assign(S,o))},
pmc:()=>{if(S.cur){S.menu=S.cur.id;S.nv='';S.perr='';S.f='#pmn'}},pm:i=>{S.menu=S.q[+i].id;S.nv='';S.perr='';S.f='#pmn'},pmx:()=>{S.menu=null;S.perr=''},
atp:i=>{const p=S.pl.find(x=>x.id===+i);if(p.i.includes(S.menu))T('Already in “'+p.n+'”');else if(p.i.length>=1000)T('That playlist is full (1000)');else{p.i.push(S.menu);T('Added to “'+p.n+'”')}S.menu=null},
pmn:()=>{const raw=$('#pmn')?.value||'',[n,e]=chk(raw,-1);if(e){S.perr=e;S.nv=raw;S.f='#pmn';return}S.pl.push({id:S.pid++,n,i:[S.menu]});T('Created “'+n+'” and added the video');S.menu=null;S.perr=''},
tg:k=>{S.st[k]=+!S.st[k]},
pp:()=>{if(!S.cur){if(S.q.length)nxt();return}if(!S.fail)S.play=+!S.play},next:()=>nxt(),
prev:()=>{if(!S.cur){if(S.hist.length){S.cur=S.hist.pop();S.pos=0;S.play=1}return}if(S.pos>3||!S.hist.length){S.pos=0;S.play=1;return}const b=S.hist.pop();if(S.q.length<1000)S.q.unshift(S.cur);S.q=S.q.filter(x=>x!==b);S.cur=b;S.pos=0;S.play=1},
loop:()=>{S.loop={off:'queue',queue:'one',one:'off'}[S.loop]},
fail:i=>{S.fail=i;S.play=0},fix:()=>{if(S.fail==='unavail')nxt();else{S.fail=null;S.play=1}},
addq:i=>{const r=addv(vb(i));T(r==='ok'?'Added to queue':r||'Playing now')},
now:i=>{const v=vb(i);if(v===S.cur){S.pos=0;S.play=1}else go(v)},
rm:i=>{const o=[...S.q],[v]=S.q.splice(+i,1);T('Removed “'+v.t+'”',()=>{S.q=o})},
shuf:()=>{const o=[...S.q];shuffle(S.q);T('Queue shuffled',()=>{S.q=o})},clr:()=>{const o=[...S.q];S.q=[];T('Queue cleared',()=>{S.q=o})},
undo:()=>{const f=S.uf;S.uf=null;S.toast=null;f&&f()},
addyt:()=>{const v=rnd();if(v)A.addq(v.id)},
addurl:()=>{const u=($('#u')?.value||'').trim();if(!/(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]{6,}/.test(u)){S.err='Enter a valid YouTube video link.';return}S.err='';const v=rnd();if(v){const r=addv(v);T(r==='ok'?'Added from link':r||'Playing now')}},
saveq:()=>{if(!S.q.length&&!S.cur)return T('Add videos to the queue first');if(S.pl.length>=25)return T('Limit of 25 playlists');S.sq=1;S.nv=uniq('Queue · '+new Date().toLocaleDateString(undefined,{month:'short',day:'numeric'}));S.perr='';S.f='#sqn'},
sqx:()=>{S.sq=0;S.perr=''},
sqc:()=>{const raw=$('#sqn')?.value||'',[n,e]=chk(raw,-1);if(e){S.perr=e;S.nv=raw;S.f='#sqn';return}const ids=[...(S.cur?[S.cur.id]:[]),...S.q.map(v=>v.id)];S.pl.push({id:S.pid++,n,i:ids});S.sq=0;S.perr='';T('Saved as “'+n+'” in Playlists')},
plo:i=>{S.open=+i;S.edit=0;S.perr=''},plb:()=>{S.open=null},pln:()=>{if(S.pl.length>=25)return;S.add=1;S.nv='';S.perr='';S.f='#pn'},plx:()=>{S.add=0;S.perr=''},
plc:()=>{const raw=$('#pn')?.value||'',[n,e]=chk(raw,-1);if(e){S.perr=e;S.nv=raw;S.f='#pn';return}S.pl.push({id:S.pid++,n,i:[]});S.add=0;S.perr=''},
ple:()=>{S.edit=1;S.nv=PL().n;S.perr='';S.f='#pr'},plce:()=>{S.edit=0;S.perr=''},
pls:()=>{const raw=$('#pr')?.value||'',[n,e]=chk(raw,PL().id);if(e){S.perr=e;S.nv=raw;S.f='#pr';return}PL().n=n;S.edit=0;S.perr=''},
pld:()=>{if(PL().pin)return;const j=plsnap(),nme=PL().n;S.pl=S.pl.filter(p=>p.id!==S.open);S.open=null;T('Deleted “'+nme+'”',plundo(j))},
plp:()=>playPl(0),plh:()=>playPl(1),
pla:()=>{let n=0,k=0;PL().i.map(vb).forEach(v=>{const r=addv(v);r==='ok'||r===''?n++:k++});T(n?'Added '+n+(k?', '+k+' already queued':''):'Nothing new to add')},
plr:i=>{const j=plsnap();PL().i.splice(+i,1);T('Removed from playlist',plundo(j))},
plq:i=>{const r=addv(vb(PL().i[+i]));T(r==='ok'?'Added to queue':r||'Playing now')},
th:i=>{S.st.theme=i},ac:i=>{S.st.accent=i},
rst:()=>{const o={st:{...S.st},speed:S.speed,vol:S.vol,audio:S.audio};S.st={...DEF};S.speed=1;S.vol=80;S.audio=1;T('Settings reset to defaults',()=>{S.st=o.st;S.speed=o.speed;S.vol=o.vol;S.audio=o.audio})},
exp:()=>T('Settings exported (simulated)'),imp:()=>T('Import dialog would open here'),kbd:()=>T('Chrome’s shortcuts page would open in a new tab (simulated)'),fb:()=>T('Feedback form would open in a new tab (simulated)'),pol:()=>T('Privacy policy would open in a new tab (simulated)'),
otab:()=>T('Switched to the playback tab'),oyt:()=>T('Opened video on YouTube')};
function applyTheme(){const d=S.st.theme==='system'?matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light':S.st.theme,r=document.documentElement,a=S.st.accent,n=parseInt(a.slice(1),16),l=[n>>16,n>>8&255,n&255].map(c=>(c/=255)<=.03928?c/12.92:((c+.055)/1.055)**2.4),L=.2126*l[0]+.7152*l[1]+.0722*l[2];r.dataset.theme=d;r.style.setProperty('--ac',a);r.style.setProperty('--on',1.05/(L+.05)>=(L+.05)/.05?'#fff':'#111')}
const item=(v,i,l,act)=>`<li class="it" draggable="true" tabindex="0" data-ix="${i}" data-l="${l}"><span class="dh" aria-hidden="true">${ic(P.drag,18)}</span>${th(v)}<div class="mt"><b>${v.t}</b><span class="mu">${v.c} · ${fmt(v.d)}</span></div>${act}</li>`;
const ibtn=(a,i,l,d)=>`<button class="ib" data-a="${a}" data-i="${i}" aria-label="${l}" title="${l}">${ic(d,18)}</button>`;
const AP='YouTube’s automatic suggestions are now turned off while you listen.';
const erb=()=>S.perr?`<div class="er" role="alert">${S.perr}</div>`:'';
function pageH(){const c=S.cur,o=V.filter(v=>v!==c).slice(0,6);return `<div class="yt"><div class="ytl"><span class="ylogo">▶ YouTube</span><span class="mu">Mock page for the prototype</span></div>
<div class="vid">${S.audio?`<div class="ov">${cover()}</div>`:`<div class="vth" style="${c?g(c.h):'background:#333'}">${c?'':'Nothing playing'}</div>`}<div class="ovsw"><span>Audio-only</span>${sw('aud',S.audio,'Audio-only mode')}</div></div>
<h1 class="vt">${c?c.t:'Nothing playing'}</h1><div class="mu">${c?c.c:'Open a video below'}</div><h3>Up next</h3>
${o.map(v=>`<div class="pc">${th(v)}<div class="mt"><b>${v.t}</b><span class="mu">${v.c} · ${fmt(v.d)}</span></div><button class="bt2" data-a="addq" data-i="${v.id}">Add to queue</button><button class="bt2" data-a="now" data-i="${v.id}">Play</button></div>`).join('')}
<div class="tools"><b>Prototype tools</b><span class="mu">Simulate a failure:</span><button class="bt2" data-a="fail" data-i="unavail">Video unavailable</button><button class="bt2" data-a="fail" data-i="closed">Tab closed</button><button class="bt2" data-a="fail" data-i="offline">Offline</button></div></div>`}
const modeH=()=>`<div class="card ao" data-a="aud" role="switch" aria-checked="${!!S.audio}" aria-label="Audio only" tabindex="0">
  <div class="aol">
    <span class="aoi ${S.audio?'on':''}">${ic(S.audio?P.hp:P.vid,22)}</span>
    <div class="mt">
      <b>Audio only</b>
      <span class="mu">${S.audio?(S.st.save?'Video hidden · lowest quality requested':'Video hidden'):'Video visible on the YouTube tab'}</span>
    </div>
  </div>
  ${sw('aud',S.audio,'Audio only')}
</div>`;
const upH=()=>{const hint=S.st.autoOff?'Nothing queued. Playback stops when this video ends.':'Nothing queued. YouTube will choose what plays next.';return `<section><div class="row" style="margin-bottom:4px"><div class="row2" style="align-items:center"><h3 style="margin:0;color:var(--tx);font-size:15px;font-weight:500">Up next</h3><i class="bd">${S.q.length}</i></div>${S.q.length?`<button class="bt2" data-a="tab" data-i="queue">View queue</button>`:''}</div>${S.q.length?`<ul class="ls">${S.q.slice(0,3).map(v=>`<li><button class="it" data-a="now" data-i="${v.id}" title="Play now">${th(v)}<div class="mt"><b>${v.t}</b><span class="mu">${v.c} · ${fmt(v.d)}</span></div></button></li>`).join('')}</ul>`:`<div class="mu">${S.cur?hint:'The queue is empty. Add videos from YouTube or a playlist.'}</div>`}</section>`};
const actChips=()=>{const a=[],c=S.cur;if(S.speed!==1)a.push(S.speed+'×');if(S.sleep>0)a.push('Sleep '+fmt(S.sleepLeft));if(S.sleep===-1)a.push('Sleep: end of video');if(S.vb)a.push('Voice boost');if(S.st.autoOff)a.push('Autoplay off');if(c&&c.tr&&S.trk[c.id])a.push(c.tr[S.trk[c.id]]);return a.map(x=>`<button class="chip" data-a="opt" title="Playback options">${x}</button>`).join('')};
function playerH(){const c=S.cur,f=S.fail;
if(!c)return modeH()+`<div class="card empty"><b>Nothing playing</b><p class="mu">Open any YouTube video, or play your queue.</p><div class="row2" style="justify-content:center;margin-top:12px">${S.hist.length?`<button class="bt2" data-a="prev">${ic(P.prev,16)}Previous</button>`:''}${S.q.length?`<button class="bt2 pri" data-a="pp">${ic(P.play,16)}Play queue</button>`:''}</div></div>`+upH();
const nxtOff=!S.q.length&&S.st.autoOff&&S.loop!=='queue';
return modeH()+(f?`<div class="alert" role="alert"><span>${FM[f][0]}</span><button class="bt2" data-a="fix">${FM[f][1]}</button></div>`:'')+
`<div class="card pcd"><div class="np">${th(c)}<div class="mt"><h2 class="tt">${c.t}</h2><div class="mu">${c.c}</div></div>${ibtn('pmc','','Add to playlist',P.pla)}</div>
<div><input id="seek" data-s="seek" type="range" min="0" max="${c.d}" step="1" value="${S.pos|0}" aria-label="Seek"><div class="row mu"><span id="tc">${fmt(S.pos)}</span><span>${fmt(c.d)}</span></div></div>
<div class="ctl"><button class="ib" data-a="loop" aria-label="Loop: ${S.loop}" title="Loop: ${S.loop}" style="${S.loop!=='off'?'color:var(--ac)':''}">${ic(P.loop)}<small>${{off:'',queue:'Q',one:'1'}[S.loop]}</small></button><button class="ib" data-a="prev" aria-label="Previous">${ic(P.prev,26)}</button><button class="pp" data-a="pp" aria-label="${S.play?'Pause':'Play'}">${ic(S.play?P.pause:P.play,28)}</button><button class="ib" data-a="next" aria-label="Next" ${nxtOff?'disabled':''}>${ic(P.next,26)}</button><button class="ib" data-a="shuf" aria-label="Shuffle queue" title="Shuffle queue">${ic(P.shuf)}</button></div>
<div class="vl"><button class="ib" data-a="mute" aria-pressed="${!!S.muted}" aria-label="${S.muted?'Unmute':'Mute'}" title="${S.muted?'Unmute':'Mute'}">${ic(S.muted||!S.vol?P.mute:P.vol)}</button><input type="range" data-s="vol" min="0" max="100" value="${S.muted?0:S.vol}" aria-label="Volume"></div></div>
<div class="opb"><button class="bt2" data-a="opt">${ic(P.tune,16)}Playback options</button>${actChips()}</div>
<div class="row2"><button class="bt2" data-a="otab">Open playback tab</button><button class="bt2" data-a="oyt">Open on YouTube</button></div>`+upH()}
function queueH(){const n=S.q.length;return `<div class="row"><span class="mu">${n} video${n===1?'':'s'}${n?' · '+fmt(S.q.reduce((a,v)=>a+v.d,0)):''}</span><div class="row2"><button class="bt2" data-a="shuf" ${n<2?'disabled':''}>Shuffle</button><button class="bt2" data-a="clr" ${n?'':'disabled'}>Clear</button></div></div>
<div class="row2" style="flex-wrap:nowrap"><input type="text" id="u" placeholder="Paste a YouTube link" aria-label="YouTube link" style="flex:1;min-width:0"><button class="bt2" data-a="addurl">Add</button></div>${S.err?`<div class="er" role="alert">${S.err}</div>`:''}
<div class="row2"><button class="bt2" data-a="addyt">${ic(P.plus,16)}Add from YouTube</button><button class="bt2" data-a="saveq">Save as playlist</button></div>
${S.sq?`<div class="row2" style="flex-wrap:nowrap"><input type="text" id="sqn" value="${esc(S.nv)}" aria-label="Playlist name" style="flex:1;min-width:0"><button class="bt2 pri" data-a="sqc">Save</button><button class="bt2" data-a="sqx">Cancel</button></div>${erb()}`:''}
${n?`<ul class="ls">${S.q.map((v,i)=>item(v,i,'q',ibtn('pm',i,'Add '+v.t+' to playlist',P.pla)+ibtn('rm',i,'Remove '+v.t,P.x))).join('')}</ul><div class="mu">Drag to reorder, or focus a row and press Alt + ↑ / ↓. Videos leave the queue when they start playing.</div>`:`<div class="empty"><b>Your queue is empty</b><p class="mu">Add videos from YouTube or play a playlist.</p></div>`}`}
function plH(){if(S.open!==null)return plD();const full=S.pl.length>=25;return `<div class="row"><span class="mu">${S.pl.length} of 25 playlists</span><button class="bt2 pri" data-a="pln" ${full?'disabled':''}>${ic(P.plus,16)}New playlist</button></div>${full?'<div class="mu">Limit of 25 playlists reached. Delete one to add another.</div>':''}
${S.add?`<div class="row2" style="flex-wrap:nowrap"><input type="text" id="pn" value="${esc(S.nv)}" placeholder="Playlist name" aria-label="Playlist name" style="flex:1;min-width:0"><button class="bt2 pri" data-a="plc">Create</button><button class="bt2" data-a="plx">Cancel</button></div>${erb()}`:''}
<ul class="ls">${S.pl.map(p=>`<li><button class="it" data-a="plo" data-i="${p.id}">${p.i[0]?th(vb(p.i[0])):'<span class="th" style="background:var(--s2)"></span>'}<div class="mt"><b>${esc(p.n)}</b><span class="mu">${p.pin?'Pinned · ':''}${p.i.length} videos · ${fmt(p.i.reduce((a,id)=>a+vb(id).d,0))}</span></div></button></li>`).join('')}</ul>`}
function plD(){const p=PL(),l=p.i.map(vb),e=l.length?'':'disabled';return `<div class="row"><button class="bt2" data-a="plb">${ic(P.back,16)}Playlists</button><div class="row2" style="gap:0;align-items:center">${p.pin?'<span class="mu" style="margin-right:6px">Default · can’t be deleted</span>':''}${ibtn('ple','','Rename playlist',P.edit)}${p.pin?'':ibtn('pld','','Delete playlist',P.del)}</div></div>
${S.edit?`<div class="row2" style="flex-wrap:nowrap"><input type="text" id="pr" value="${esc(S.nv)}" aria-label="Playlist name" style="flex:1;min-width:0"><button class="bt2 pri" data-a="pls">Save</button><button class="bt2" data-a="plce">Cancel</button></div>${erb()}`:`<h2 class="tt">${esc(p.n)}</h2>`}
<div class="mu">${l.length} videos</div><div class="row2"><button class="bt2 pri" data-a="plp" ${e}>Play</button><button class="bt2" data-a="plh" ${e}>Play shuffled</button><button class="bt2" data-a="pla" ${e}>Add all to queue</button></div>
${l.length?`<ul class="ls">${l.map((v,i)=>item(v,i,'p',ibtn('plq',i,'Add to queue',P.plus)+ibtn('plr',i,'Remove from playlist',P.x))).join('')}</ul>`:'<div class="empty"><b>This playlist is empty</b><p class="mu">Save your queue here from the Queue tab.</p></div>'}`}
function setH(){const t=S.st,sr=(l,d,c)=>`<div class="srow"><div class="sl"><b>${l}</b>${d?`<span class="mu">${d}</span>`:''}</div><div class="sct">${c}</div></div>`,sec=(h,b)=>`<section><h3 class="sh">${h}</h3><div class="card">${b}</div></section>`,
seg=(a,cur,o)=>`<div class="seg" role="radiogroup">${o.map(([k,l])=>`<button role="radio" aria-checked="${cur===k}" data-a="${a}" data-i="${k}">${l}</button>`).join('')}</div>`,pre=[['#d93025','Red'],['#e8710a','Orange'],['#00897b','Teal']],cu=!pre.some(p=>p[0]===t.accent),
act=(a,l,c='')=>`<button class="act ${c}" data-a="${a}"><span>${l}</span><span class="ch" aria-hidden="true">›</span></button>`;
return `<div class="st">`+
sec('Audio-only',sr('Audio-only mode','Hide the video while you listen',sw('aud',S.audio,'Audio-only mode'))+sr('Save bandwidth','Ask YouTube for the lowest video quality',sw('tg',t.save,'Save bandwidth','save')))+
sec('Appearance',sr('Theme','',seg('th',t.theme,[['light','Light'],['dark','Dark'],['system','System']]))+sr('Accent','',`<div class="sws" role="radiogroup" aria-label="Accent">${pre.map(([c,n])=>`<button class="s" role="radio" aria-checked="${t.accent===c}" aria-label="${n}" title="${n}" data-a="ac" data-i="${c}" style="background:${c}"></button>`).join('')}<label class="s cu ${cu?'on':''}" title="Custom color" style="background:${cu?t.accent:'conic-gradient(#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)'}"><input type="color" data-s="accent" value="${t.accent}" aria-label="Custom accent color"></label></div>`))+
sec('Keyboard shortcuts',sr('Add current video to queue','Works on any YouTube page','<kbd>Alt+Shift+Q</kbd>')+act('kbd','Change shortcuts'))+
sec('Keep and reset',act('exp','Export settings')+act('imp','Import settings')+act('rst','Reset to defaults','dg'))+
sec('About and privacy',sr('AudioTube','','<span class="mu">Version 1.0 (prototype)</span>')+'<p class="mu" style="margin:8px 0">Your playlists, queue and settings stay on this device. Nothing about what you listen to is sent anywhere.</p>'+act('fb','Send feedback')+act('pol','Privacy policy'))+`</div>`}
const sheetH=()=>`<div class="sheet" role="dialog" aria-label="Add to playlist"><div class="row"><b>Add to playlist</b><button class="ib" data-a="pmx" aria-label="Close">${ic(P.x)}</button></div><div class="mu">${vb(S.menu).t}</div><ul class="ls">${S.pl.map(p=>`<li><button class="it" data-a="atp" data-i="${p.id}"><div class="mt"><b>${esc(p.n)}${p.i.includes(S.menu)?' ✓':''}</b><span class="mu">${p.i.length} videos</span></div></button></li>`).join('')}</ul><div class="row2" style="flex-wrap:nowrap"><input type="text" id="pmn" value="${esc(S.nv)}" placeholder="New playlist name" aria-label="New playlist name" style="flex:1;min-width:0"><button class="bt2 pri" data-a="pmn" ${S.pl.length>=25?'disabled':''}>Create</button></div>${erb()}</div>`;
const orw=(l,d,c)=>`<div class="orow"><div class="ol"><b>${l}</b>${d?`<span class="mu">${d}</span>`:''}</div><div class="oc">${c}</div></div>`;
const optH=()=>{const c=S.cur,sl=S.sleep>0?fmt(S.sleepLeft)+' left':S.sleep===-1?'Pauses at the end of the video':'';return `<div class="sheet opt" role="dialog" aria-label="Playback options"><div class="oh"><b>Playback options</b><button class="ib" data-a="optx" aria-label="Close">${ic(P.x)}</button></div>
<section><h3>Playback</h3><div class="card">${orw('Speed','',`<div class="step"><button class="ib" data-a="spdm" aria-label="Slower" ${S.speed<=SP[0]?'disabled':''}>−</button><b aria-live="polite">${S.speed}×</b><button class="ib" data-a="spdp" aria-label="Faster" ${S.speed>=SP[SP.length-1]?'disabled':''}>+</button></div>`)}${orw('Sleep timer',`<span id="sl">${sl}</span>`,`<select data-s="sleep" aria-label="Sleep timer">${[[0,'Off'],[15,'15 min'],[30,'30 min'],[45,'45 min'],[60,'60 min'],[-1,'End of video']].map(([v,l])=>`<option value="${v}" ${S.sleep===v?'selected':''}>${l}</option>`).join('')}</select>`)}</div></section>
<section><h3>Sound</h3><div class="card">${orw('Voice boost','Clearer speech',sw('vb',S.vb,'Voice boost'))}${c&&c.tr?orw('Audio track','',`<select data-s="trk" aria-label="Audio track">${c.tr.map((n,i)=>`<option value="${i}" ${(S.trk[c.id]||0)===i?'selected':''}>${n}</option>`).join('')}</select>`):''}</div></section>
<section><h3>YouTube</h3><div class="card">${orw('Turn off YouTube autoplay','Stops YouTube’s suggested videos while you listen',sw('tg',S.st.autoOff,'Turn off YouTube autoplay','autoOff'))}${S.st.autoOff?`<div class="ok" style="padding-bottom:9px">${AP}</div>`:''}</div></section>
<section><div class="card">${orw('Stop playback','Clears Now Playing. Your queue stays.',`<button class="bt2 dng2" data-a="stop">${ic(P.stop,14)}Stop</button>`)}</div></section></div>`};
const miniH=()=>`<div class="mini"><div class="mpw"><i id="mp" style="width:${S.pos/S.cur.d*100}%"></i></div>${th(S.cur)}<div class="mt"><b>${S.cur.t}</b><span class="mu">${S.cur.c}</span></div><button class="ib" data-a="prev" aria-label="Previous">${ic(P.prev)}</button><button class="ib" data-a="pp" aria-label="${S.play?'Pause':'Play'}">${ic(S.play?P.pause:P.play,24)}</button><button class="ib" data-a="next" aria-label="Next">${ic(P.next)}</button></div>`;
function panelH(){const s=S.set,hd=s?`<header class="ph"><div class="brand"><button class="ib" data-a="gear" aria-label="Back">${ic(P.back)}</button><b>Settings</b></div></header>`:`<header class="ph"><div class="brand">${logo(28)}<b>AudioTube</b></div><button class="ib" data-a="gear" aria-label="Settings">${ic(P.gear)}</button></header>`,
tabs=s?'':`<div class="tl" role="tablist">${['player','queue','playlists'].map(t=>`<button role="tab" id="t-${t}" aria-selected="${S.tab===t}" tabindex="${S.tab===t?0:-1}" data-a="tab" data-i="${t}">${t[0].toUpperCase()+t.slice(1)}${t==='queue'&&S.q.length?`<i class="bd">${S.q.length}</i>`:''}</button>`).join('')}</div>`,
b=s?setH():S.tab==='player'?playerH():S.tab==='queue'?queueH():plH();
return hd+tabs+`<div id="m" class="pm" ${s?'':`role="tabpanel" aria-labelledby="t-${S.tab}"`}>${b}</div>`+((s||S.tab!=='player')&&S.cur?miniH():'')+(S.menu?sheetH():'')+(S.opt?optH():'')+(S.toast?`<div class="toast" role="status"><span>${S.toast.m}</span>${S.toast.u?'<button data-a="undo">Undo</button>':''}</div>`:'')}
const pn=$('#panel');
function rp(){document.querySelectorAll('.panel input[type=range]').forEach(r=>r.style.setProperty('--p',((r.value-r.min)/((r.max-r.min)||1)*100)+'%'))}
function R(){applyTheme();const m=$('#m'),sc=m?m.scrollTop:0;pn.innerHTML=panelH();const n=$('#m');if(n&&!S.rs)n.scrollTop=sc;S.rs=0;rp();if(S.f){$(S.f)?.focus();S.f=null}}
function tk(){if(!S.cur)return;const l=$('#sl');if(l)l.textContent=S.sleep>0?fmt(S.sleepLeft)+' left':S.sleep===-1?'End of video':'Off';const s=$('#seek');if(s){s.value=S.pos;$('#tc').textContent=fmt(S.pos);rp()}const m=$('#mp');if(m)m.style.width=S.pos/S.cur.d*100+'%'}
document.addEventListener('click',e=>{const b=e.target.closest('[data-a]');if(!b||b.disabled)return;A[b.dataset.a]?.(b.dataset.i);R()});
document.addEventListener('input',e=>{const t=e.target,k=t.dataset.s;if(!k)return;const v=t.type==='range'||t.tagName==='SELECT'?+t.value:t.value;
if(k==='seek'){S.pos=v;tk()}else if(k==='vol'){S.vol=v;S.muted=0}else if(k==='speed')S.speed=v;else if(k==='sleep'){S.sleep=v;S.sleepLeft=v>0?v*60:0}else if(k==='dspeed'){S.st.speed=v;S.speed=v}else if(k==='dvol'){S.st.vol=v;S.vol=v}else if(k==='trk'){S.trk[S.cur.id]=v}else if(k==='accent'){S.st.accent=v;applyTheme()}});
document.addEventListener('change',e=>{if(['accent','sleep','speed','dspeed','vol','trk'].includes(e.target.dataset.s))R()});
document.addEventListener('keydown',e=>{const t=e.target;
if(e.key==='Escape'&&(S.menu||S.opt)){S.menu=null;S.opt=0;R()}if(e.key==='Enter'){const m={u:'addurl',pn:'plc',pr:'pls',pmn:'pmn',sqn:'sqc'}[t.id];if(m){A[m]();R()}}
if(t.getAttribute?.('role')==='tab'&&/Arrow(Left|Right)/.test(e.key)){const ts=['player','queue','playlists'];A.tab(ts[(ts.indexOf(S.tab)+(e.key==='ArrowRight'?1:2))%3]);S.f='#t-'+S.tab;R()}
const li=t.closest?.('.it[data-ix]');if(li&&e.altKey&&/Arrow(Up|Down)/.test(e.key)){e.preventDefault();const i=+li.dataset.ix,j=i+(e.key==='ArrowUp'?-1:1);mv(li.dataset.l,i,j);S.f=`.it[data-l="${li.dataset.l}"][data-ix="${Math.max(0,Math.min(j,li.parentNode.children.length-1))}"]`;R()}});
let dr=null;
document.addEventListener('dragstart',e=>{const l=e.target.closest?.('.it[data-ix]');if(l)dr={l:l.dataset.l,i:+l.dataset.ix}});
document.addEventListener('dragover',e=>{if(dr&&e.target.closest('.it[data-ix]'))e.preventDefault()});
document.addEventListener('drop',e=>{const l=e.target.closest('.it[data-ix]');if(!dr||!l||l.dataset.l!==dr.l)return;e.preventDefault();mv(dr.l,dr.i,+l.dataset.ix);dr=null;snap();R()});
document.addEventListener('dragend',()=>dr=null);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{if(S.st.theme==='system')R()});
setInterval(()=>{if(!S.cur||!S.play||S.fail)return;S.pos+=S.speed;if(S.sleep>0&&--S.sleepLeft<=0){S.sleep=0;S.play=0;T('Sleep timer ended. Playback paused.');R();return}if(S.pos>=S.cur.d){ended();R();return}tk()},1000);
document.addEventListener('input',e=>{if(e.target.type==='range')rp()});
R();