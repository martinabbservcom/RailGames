const mkCtx = () => new Proxy({}, { get(t,k){ if(k in t) return t[k]; if(k==='createLinearGradient'||k==='createRadialGradient') return ()=>({addColorStop(){}}); if(k==='measureText') return ()=>({width:50}); return ()=>{}; }, set(t,k,v){t[k]=v;return true;} });
const mkEl = (id) => {
  const el = { id, style:{}, dataset:{}, children:[], hidden:false, textContent:'', innerHTML:'', title:'', disabled:false, width:0, height:0, _h:{},
    classList:{ _s:new Set(), add(c){this._s.add(c)}, remove(c){this._s.delete(c)}, toggle(c,f){ if(f===undefined) f=!this._s.has(c); f?this._s.add(c):this._s.delete(c); return f;}, contains(c){return this._s.has(c)} },
    addEventListener(t,f){ (el._h[t]=el._h[t]||[]).push(f); }, setAttribute(){}, appendChild(c){this.children.push(c)}, replaceChildren(...c){this.children=c}, remove(){},
    querySelector(){ return mkEl('q'); }, querySelectorAll(){ return []; }, getContext(){ return mkCtx(); }, getBoundingClientRect(){ return {left:0,top:0,width:1100,height:720}; },
    toDataURL(){ return 'data:'; }, scrollIntoView(){}, get clientWidth(){return 1100}, get clientHeight(){return 720}, get firstChild(){ const self=this; return { remove(){ self.children.shift(); } }; }, compareDocumentPosition(){return 0}, scrollLeft:0, scrollTop:0 };
  return el;
};
const els = {};
const speedBtns = [1,2,4,8].map(v=>{ const b=mkEl('sp'+v); b.dataset.speed=String(v); return b; });
global.Node = { DOCUMENT_POSITION_FOLLOWING: 4 };
global.window = { devicePixelRatio:1, addEventListener(){}, AudioContext: undefined };
global.document = { getElementById(id){ return els[id] || (els[id]=mkEl(id)); }, createElement(t){ return mkEl(t); }, querySelector(){ return mkEl('q'); }, querySelectorAll(sel){ return sel==='.speed button' ? speedBtns : []; }, documentElement: mkEl('html') };
global.navigator = { userAgent: 'node', platform: 'x', maxTouchPoints: 0 };
global.localStorage = { _d:{}, getItem(k){ return this._d[k] ?? null }, setItem(k,v){ this._d[k]=String(v) } };
let raf = null; global.requestAnimationFrame = f => { raf = f; }; global.window.requestAnimationFrame = global.requestAnimationFrame;
global.performance = { now: () => 0 };
for (const f of ['levels','yard','sound','render']) require('./'+f+'.js');
require('./main.js');
let now = 0; const run = n => { for (let i=0;i<n;i++){ now += 33; raf(now); } };
run(30);
els['levels'].children[Number(process.argv[2]||0)]._h.click[0]();
if (els['tut-skip']) els['tut-skip']._h.click[0]();
speedBtns[3]._h.click[0]();
const dbg = window.Yard.debug();
let frames=0;
while (!dbg.game.finished && frames < 400000) {
  run(1); frames++;
  const g = dbg.game;
  if (frames % 10 === 0 && !g.busy() && !g.finished) {
    const h = g.hint();
    if (h && h.track !== undefined) { try { g.startMove(h.track, h.idx, h.to); } catch (e) { console.log('startMove error', e.message); } }
  }
}
console.log('finished after frames', frames, '| game.finished', dbg.game.finished, '| minute', (dbg.game.minute-480).toFixed(1));
run(5);
setTimeout(()=>{ console.log('results hidden?', els['results'].classList.contains('hidden'), '| title:', els['results-title'].textContent, '| text:', els['results-text'].textContent); process.exit(0); }, 2500);
