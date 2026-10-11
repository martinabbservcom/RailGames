const { createCanvas } = require('C:/Users/marti/AppData/Local/Temp/claude/c--Users-marti-Documents-ShuntingGame/3e538239-ceb4-4e0b-8b84-ce9317cdcb6a/scratchpad/cv/node_modules/@napi-rs/canvas');
global.window = { devicePixelRatio:1 }; global.document = { createElement:()=>createCanvas(10,10) }; global.performance={now:()=>0};
for (const f of ['levels','yard','sound','render']) require('./'+f+'.js');
const Y = window.Yard; let errs=0;
for (let idx=0; idx<Y.LEVELS.length; idx++) {
  const game = Y.createGame(Y.LEVELS[idx]); const c=createCanvas(1100,720);
  const r = Y.createRenderer(c, game); r.resize(1100); let t=0;
  for (let i=0;i<30*60*5;i++){ game.update(1/30); t+=33; for (const e of game.events.splice(0)) if (e.type==='derail') game.callRecovery(e.track);
    if(i%4===0){ try{ r.draw(t,0.033,{targets:[],hoverTrack:null,selected:null,hoverCar:null,hoverPilot:false,highlight:null}); }catch(e){ console.log(idx, e.stack.split('\n').slice(0,3).join(' | ')); errs++; break; } } if (game.finished) break; }
}
console.log(errs? 'FAIL':'real-canvas smoke ok');
