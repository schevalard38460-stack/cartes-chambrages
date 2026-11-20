/** Présentateur local des événements de la salle : même journal Firebase pour tous.
 * Aucune modification des coups, du tour ou du score. */
const $=id=>document.getElementById(id);
const avatars={franck:'Franck',mathias:'Mathias',stephane:'Stéphane'};
let getAvatarSrc=a=>`assets/${a}.webp`;
let initialized=false,lastSeen=0,queue=[],presenting=false,activeTimer=null,ctx=null;
let soundOn=true,voiceOn=true,localMuted=false;
try{soundOn=localStorage.getItem('cc-show-sound')!=='off';voiceOn=localStorage.getItem('cc-show-voice')!=='off';localMuted=localStorage.getItem('cc-show-mute')==='on';}catch{}
function save(){try{localStorage.setItem('cc-show-sound',soundOn?'on':'off');localStorage.setItem('cc-show-voice',voiceOn?'on':'off');localStorage.setItem('cc-show-mute',localMuted?'on':'off');}catch{}}
function labels(){if($('sound-switch')){$('sound-switch').textContent=soundOn?'🔊 Effets : ON':'🔇 Effets : OFF';$('sound-switch').setAttribute('aria-pressed',String(soundOn));}
  if($('voice-switch')){$('voice-switch').textContent=voiceOn?'🗣️ Voix : ON':'🤐 Voix : OFF';$('voice-switch').setAttribute('aria-pressed',String(voiceOn));}
  if($('local-mute-switch')){$('local-mute-switch').textContent=localMuted?'🔇 Mon son : OFF':'🔊 Mon son : ON';$('local-mute-switch').setAttribute('aria-pressed',String(localMuted));$('local-mute-switch').setAttribute('aria-label',localMuted?'Réactiver les sons de ce téléphone uniquement':'Couper les sons et les voix de ce téléphone uniquement');}}
function stopLocalAudio(){try{window.speechSynthesis?.cancel();}catch{}if(ctx){const old=ctx;ctx=null;try{old.close().catch(()=>{});}catch{}}}
function fitAfterShow(){if(!$('match')?.classList.contains('hidden'))requestAnimationFrame(()=>window.dispatchEvent(new Event('resize')));}
/** Pendant une manche, les répliques sont placées dans une rangée dédiée
 * AU-DESSUS du tableau : aucune carte n'est recouverte ni déplacée par superposition. */
function dockShow(){const shell=$('show-stage'),match=$('match');if(!shell||!match)return;
 if(!match.classList.contains('hidden')){const title=match.querySelector('.game-title');if(title?.nextElementSibling!==shell)title?.after(shell);match.classList.add('show-active');}
 else{document.body.appendChild(shell);match.classList.remove('show-active');}}
function undockShow(){const match=$('match');match?.classList.remove('show-active');fitAfterShow();}
function getContext(){try{const C=window.AudioContext||window.webkitAudioContext;if(!C)return null;if(!ctx)ctx=new C();if(ctx.state==='suspended')ctx.resume().catch(()=>{});return ctx;}catch{return null;}}
export function unlockSound(){getContext();}
function note(c,freq,duration,delay=0,type='sine',volume=.12,endFreq=null){
 const t=c.currentTime+delay,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);if(endFreq)o.frequency.exponentialRampToValueAtTime(Math.max(15,endFreq),t+duration);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(volume,.002),t+.025);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g).connect(c.destination);o.start(t);o.stop(t+duration+.03);
}
function noise(c,dur,delay=0,vol=.09){const t=c.currentTime+delay,buffer=c.createBuffer(1,Math.floor(c.sampleRate*dur),c.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*(1-i/data.length);const src=c.createBufferSource(),g=c.createGain();src.buffer=buffer;g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.0001,t+dur);src.connect(g).connect(c.destination);src.start(t);src.stop(t+dur+.01);}
function sound(fx,character){if(localMuted||!soundOn)return;const c=getContext();if(!c)return;
 try{switch(fx){
  case 'plus2':note(c,650,.14,0,'square',.055,340);note(c,250,.16,.16,'triangle',.1,180);break;
  case 'plus4':case 'plus6':case 'plus10':case 'penalty':
    noise(c,.24,0,.15);note(c,165,.36,0,'sawtooth',.11,62);note(c,94,.38,.20,'triangle',.17,55);if(['plus10','plus6'].includes(fx))note(c,850,.26,.31,'square',.055,150);break;
  case 'stack':note(c,290,.16,0,'square',.07,380);note(c,410,.18,.17,'square',.08,260);note(c,130,.34,.32,'sawtooth',.08,70);break;
  case 'reverse':noise(c,.16,0,.08);note(c,190,.25,.07,'sawtooth',.1,580);note(c,570,.22,.28,'sawtooth',.07,120);break;
  case 'skip':case 'skipall':note(c,460,.16,0,'triangle',.09,190);note(c,220,.14,.15,'square',.06,100);break;
  case 'joker':note(c,500,.11,0,'sine',.08);note(c,730,.12,.12,'sine',.08);note(c,960,.14,.24,'sine',.09);break;
  case 'catch':note(c,880,.12,0,'square',.075);note(c,660,.12,.15,'square',.075);note(c,880,.16,.32,'square',.075);break;
  case 'uno':note(c,784,.16,0,'sine',.1);note(c,1046,.30,.16,'sine',.15);break;
  case 'win':case 'champion':
    [[392,0],[494,.15],[587,.30],[784,.45],[1046,.66]].forEach(([f,at])=>note(c,f,fx==='champion'?.35:.23,at,'triangle',.12));if(fx==='champion')noise(c,.5,.9,.07);break;
  case 'tease':case 'draw':note(c,340,.12,0,'square',.065,200);note(c,220,.20,.13,'triangle',.09,135);break;
  case 'discard':note(c,540,.2,0,'triangle',.09,300);note(c,290,.18,.17,'sine',.09,190);break;
  default:note(c,380,.1,0,'sine',.055);break;
 }}catch{}
}
function talk(text,character){if(localMuted||!voiceOn||!('speechSynthesis'in window)||!text)return;
 try{window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang='fr-FR';const voices=window.speechSynthesis.getVoices();const fr=voices.filter(v=>v.lang.toLowerCase().startsWith('fr'));if(fr.length)u.voice=fr[character==='mathias'?Math.min(1,fr.length-1):0];u.rate=character==='mathias'?1.17:character==='franck'?.93:1.04;u.pitch=character==='mathias'?.80:character==='franck'?1.15:1;u.volume=.9;window.speechSynthesis.speak(u);}catch{}
}
function makeParticles(fx){const el=$('show-particles');if(!el)return;el.replaceChildren();const heavy=['plus4','plus6','plus10','penalty','stack','champion','win'].includes(fx),count=heavy?15:7;
 const glyphs=fx==='champion'||fx==='win'?['🏆','✨','🎉','☕']:fx==='penalty'||fx.startsWith('plus')||fx==='stack'?['🃏','💥','⚡','🃏']:['✨','😏','🎴','★'];
 for(let i=0;i<count;i++){const sp=document.createElement('span');sp.textContent=glyphs[i%glyphs.length];sp.style.setProperty('--sx',`${(i*67)%295-147}px`);sp.style.setProperty('--sy',`${-55-(i*27)%180}px`);sp.style.setProperty('--rot',`${i*39-180}deg`);sp.style.animationDelay=(i%5)*50+'ms';el.appendChild(sp);}}
function startNext(){if(presenting||!queue.length)return;presenting=true;const {evt,players}=queue.shift();const shell=$('show-stage'),face=$('show-face'),text=$('show-quip'),who=$('show-who'),badge=$('show-category');if(!shell){presenting=false;return;}
 const speaker=players.find(p=>p.uid===(evt.speaker||evt.by))||players[0];const actor=players.find(p=>p.uid===evt.by)||speaker;const style=['plus4','plus6','plus10','penalty','stack'].includes(evt.fx)?'danger':['win','champion','uno'].includes(evt.fx)?'victory':'normal';
 dockShow();shell.className='show-stage show-'+style+' show-'+(evt.fx||'tease');face.src=getAvatarSrc(speaker?.avatar||'stephane');face.alt=speaker?.name||'Joueur';who.textContent=speaker?.name||'À la table';text.textContent=evt.quip||evt.label||'';
 badge.textContent=evt.fx==='champion'?'🏆 CHAMPION !':evt.fx==='win'?'🥇 MANCHE GAGNÉE':evt.fx==='stack'?'⚡ CUMUL !':evt.fx==='uno'?'🎤 UNO !':['plus10','plus6','plus4','plus2','penalty'].includes(evt.fx)?'💥 COUP BAS !':evt.fx==='tease'?'😏 CHAMBRAGE !':'🎭 À LA TABLE';
 makeParticles(evt.fx||'tease');shell.classList.remove('hidden');shell.classList.remove('show-pop');void shell.offsetWidth;shell.classList.add('show-pop');
 sound(evt.fx||'tease',speaker?.avatar);talk(evt.quip,speaker?.avatar);
 const duration=['champion','win'].includes(evt.fx)?2700:evt.fx==='plus10'?2250:1800;
 clearTimeout(activeTimer);fitAfterShow();activeTimer=setTimeout(()=>{shell.classList.add('hidden');presenting=false;if(!queue.length)undockShow();startNext();},duration);
}
export function resetShow(){initialized=false;lastSeen=0;queue=[];presenting=false;clearTimeout(activeTimer);$('show-stage')?.classList.add('hidden');undockShow();try{window.speechSynthesis.cancel();}catch{}}
export function observeShow(s){if(!s)return;
 const log=(Array.isArray(s.showLog)?s.showLog:Object.values(s.showLog||{})).filter(Boolean).sort((a,b)=>a.seq-b.seq);
 if(!initialized){initialized=true;lastSeen=Math.max(Number(s.seq||0),...log.map(e=>Number(e.seq||0)));return;}
 const newEvents=log.filter(e=>Number(e.seq)>lastSeen&&e.quip);
 // Compatibilité avec les salles ouvertes avant V0.5.
 if(!newEvents.length&&s.lastEvent?.quip&&Number(s.lastEvent.seq)>lastSeen)newEvents.push(s.lastEvent);
 lastSeen=Math.max(lastSeen,Number(s.seq||0));
 const players=(s.players||[]).map(p=>({uid:p.uid,name:p.name,avatar:p.avatar}));
 for(const evt of newEvents.slice(-12))queue.push({evt,players});
 if(queue.length>12)queue=queue.slice(-12);
 startNext();
}
export function demoReaction(character='franck'){
 const entries={franck:{quip:'Ah ah ah ! Bien joué !',fx:'win'},mathias:{quip:'Et voila! Trop de talent!',fx:'champion'},stephane:{quip:'Eh vous voila gniardisés',fx:'tease'}};
 const item=entries[character]||entries.franck;const people=Object.entries(avatars).map(([avatar,name])=>({uid:avatar,name,avatar}));queue.push({evt:{...item,seq:Date.now(),type:'preview',by:character,speaker:character},players:people});startNext();
}
export function setupShow(getSrc){getAvatarSrc=getSrc||getAvatarSrc;labels();
 $('local-mute-switch')?.addEventListener('click',()=>{localMuted=!localMuted;save();labels();if(localMuted)stopLocalAudio();else if(soundOn)unlockSound();});
 $('sound-switch')?.addEventListener('click',()=>{soundOn=!soundOn;save();labels();if(soundOn&&!localMuted)unlockSound();if(!soundOn&&!voiceOn)stopLocalAudio();});
 $('voice-switch')?.addEventListener('click',()=>{voiceOn=!voiceOn;save();labels();if(voiceOn&&!localMuted){unlockSound();talk('Tocar !','mathias');}else try{window.speechSynthesis.cancel();}catch{}});
 for(const btn of document.querySelectorAll('[data-preview-show]'))btn.addEventListener('click',()=>{unlockSound();demoReaction(btn.dataset.previewShow);});
 document.addEventListener('pointerdown',()=>{if(!localMuted&&soundOn)unlockSound();},{once:true,passive:true});
}
