import {setupShow,observeShow,resetShow} from './show.mjs';
import {COLORS,NAMES,AVATARS,makeRoom,addPlayer,startGame,playCard,drawCard,passTurn,announceUno,catchUno,tease,playable,canPlay,cardText,handOf,currentCard,currentPlayer,botChoice,normalizeRules,DEFAULT_RULES,setRoomRules,newChampionship,standings,handPoints} from './rules.mjs';
import * as Net from './firebase-net-v053.mjs';
const AVATAR_INLINE=window.CC_ASSETS||null;const avatarSrc=a=>AVATAR_INLINE?.[a]||`assets/${a}.webp`;
const $=id=>document.getElementById(id);
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const validCode=/^[A-HJ-NP-Z2-9]{8}$/;
const names={stephane:'Stéphane',franck:'Franck',mathias:'Mathias'};
let avatar='stephane',capacity=3,room=null,uid='',code='',mode='menu',stopListen=null,busy=false,botTimer=null,pendingWild=null;
let lastRenderedEvent=0,toastTimer=null,lastFxSeq=0,prevRulesSignature='',prevRematchSignature='';
function notify(msg){const el=$('toast');el.textContent=msg;el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),3500);}
function view(name){for(const id of ['setup','lobby','match'])$(id).classList.toggle('hidden',id!==name);}
function selectAvatar(a){if(!AVATARS.includes(a))return;avatar=a;
  document.querySelectorAll('.avatar-option').forEach(e=>{const selected=e.dataset.avatar===a;e.classList.toggle('selected',selected);e.setAttribute('aria-pressed',String(selected));});
  $('nickname').value=names[a];}
for(const el of document.querySelectorAll('.avatar-option'))el.addEventListener('click',()=>selectAvatar(el.dataset.avatar));
for(const el of document.querySelectorAll('[data-capacity]'))el.addEventListener('click',()=>{capacity=Number(el.dataset.capacity);document.querySelectorAll('[data-capacity]').forEach(b=>b.classList.toggle('active',Number(b.dataset.capacity)===capacity));});
function editor(scope){return document.querySelector(`[data-settings-form="${scope}"]`);}
function editorValues(scope){const root=editor(scope);return normalizeRules({
 stackMode:root.querySelector('.stack-mode').value,
 stackPairs:Object.fromEntries([...root.querySelectorAll('.stack-pair')].map(x=>[x.dataset.pair,x.checked])),
 specials:Object.fromEntries([...root.querySelectorAll('.special-flag')].map(x=>[x.dataset.special,x.checked])),
 targetScore:Number(root.querySelector('.target-score').value)});}
function fillEditor(scope,rules){const root=editor(scope),r=normalizeRules(rules);root.querySelector('.stack-mode').value=r.stackMode;
 root.querySelectorAll('.stack-pair').forEach(x=>x.checked=!!r.stackPairs[x.dataset.pair]);
 root.querySelectorAll('.special-flag').forEach(x=>x.checked=!!r.specials[x.dataset.special]);
 root.querySelector('.target-score').value=r.targetScore;refreshEditor(scope);}
function refreshEditor(scope){const root=editor(scope);root.querySelector('.stack-matrix').classList.toggle('hidden',root.querySelector('.stack-mode').value!=='custom');}
for(const scope of ['setup','lobby','rematch']){editor(scope).querySelector('.stack-mode').addEventListener('change',()=>refreshEditor(scope));refreshEditor(scope);}
function rulesDescription(rules){const r=normalizeRules(rules),names={off:'Aucun cumul',same:'Cumul même valeur',higher:'Cumul égal ou supérieur',any:'Tous les cumuls',custom:'Cumuls au choix'};
 const extra=[['wild6','+6'],['wild10','+10'],['skipall','Passe-tous'],['discardall','Défausse-couleur']].filter(([id])=>r.specials[id]).map(([,label])=>label);
 return `Objectif ${r.targetScore} pts • `+names[r.stackMode]+' • Cartes ajoutées : '+(extra.join(', ')||'aucune');}
function nickname(){return $('nickname').value.trim().slice(0,18)||names[avatar];}
function leave(){resetShow();if(stopListen){stopListen();stopListen=null;}clearTimeout(botTimer);room=null;uid='';code='';mode='menu';pendingWild=null;lastRenderedEvent=0;lastFxSeq=0;prevRulesSignature='';prevRematchSignature='';busy=false;view('setup');}
$('leave-lobby').onclick=leave;$('return').onclick=()=>{if(confirm('Quitter l’écran de jeu ? Tu pourras revenir avec le code de salle.'))leave();};
const roomParam=new URL(location.href).searchParams.get('room')||'';if(validCode.test(roomParam.toUpperCase()))$('room-input').value=roomParam.toUpperCase();
try{const s=localStorage.getItem('cc-avatar');if(AVATARS.includes(s))selectAvatar(s);}catch{}
function startListening(){if(stopListen)stopListen();stopListen=Net.listenRoom(code,next=>{
    if(!next){notify('Cette salle est introuvable.');leave();return;}
    const previous=room?.lastEvent?.seq||0;
    room=next;if(next.lastEvent?.seq!==previous&&previous>0&&!next.lastEvent?.quip)notify(next.lastEvent?.label||'');
    render();
  },e=>notify('Connexion : '+(e?.message||e)));
}
async function connect(fn){if(busy)return;busy=true;
  $('create').disabled=true;$('join').disabled=true;$('setup-note').textContent='Connexion à la salle…';
  try{localStorage.setItem('cc-avatar',avatar);const result=await fn();uid=result.uid;code=result.code;room=null;lastRenderedEvent=0;mode='online';startListening();}
  catch(e){notify(e.message);$('setup-note').textContent=e.message;}
  finally{busy=false;$('create').disabled=false;$('join').disabled=false;}
}
$('create').onclick=()=>connect(()=>Net.createRoom(nickname(),avatar,capacity,editorValues('setup')));
$('join').onclick=()=>connect(()=>{
  const c=$('room-input').value.trim().toUpperCase();if(!validCode.test(c))throw Error('Entre un code de huit caractères.');
  return Net.joinRoom(c,nickname(),avatar);
});
$('demo').onclick=()=>{
  leave();mode='demo';uid='human';let s=makeRoom(uid,nickname(),avatar,capacity,editorValues('setup'));let n=0;
  for(const a of AVATARS.filter(a=>a!==avatar).slice(0,capacity-1))s=addPlayer(s,'bot-'+(++n),names[a],a);
  room=startGame(s,uid,123456789);render();
};
function person(p,active=false){return `<div class="score-player ${active?'active':''}" data-player-uid="${safe(p.uid)}"><img src="${avatarSrc(p.avatar)}" alt=""><div class="score-data"><strong>${safe(p.name)}</strong><small>${active?'🎯 À SON TOUR':(p.uid===uid?'C’EST TOI':'EN ATTENTE')}</small></div><span class="points-total" title="Score cumulé">${p.points||0} <small>pts</small></span><span class="card-count">🂠 ${(p.hand||[]).length}</span></div>`;}
function lobbyPerson(p){return `<div class="lobby-slot"><img src="${avatarSrc(p.avatar)}" alt=""><div><strong>${safe(p.name)}</strong><small>${p.uid===room.host?'Organisateur':'Invité'} ${p.uid===uid?'• toi':''}</small></div></div>`;}
function cardSymbol(c){if(!c)return'?';return ({reverse:'⇄',skip:'⊘',skipall:'⊘⊘',discardall:'▧',draw2:'+2',wild4:'+4',wild6:'+6',wild10:'+10',wild:'★'})[c.v]||c.v;}
function cardMarkup(c,classes=''){const val=cardSymbol(c),special=['draw2','skip','reverse','wild','wild4','wild6','wild10','skipall','discardall'].includes(c.v),name=cardText(c);
  return `<div class="card ${c.c==='wild'?'wild':safe(c.c)} ${classes}" data-card-id="${safe(c.id)}" title="${safe(name)}" role="button" aria-label="Carte ${safe(name)}"><span class="card-corner">${safe(val)}</span><span class="card-inner ${special?'card-special':''}">${safe(val)}</span><span class="card-corner bottom">${safe(val)}</span></div>`;
}
function render(){if(!room){view('setup');return;}
  if(room.phase==='lobby'){view('lobby');renderLobby();return;}
  view('match');renderMatch();if(mode==='demo')maybeBot();
}
function renderLobby(){
  $('room-code').textContent=code||'DÉMO';$('lobby-counter').textContent=`${room.players.length}/${room.capacity}`;
  $('lobby-players').innerHTML=room.players.map(lobbyPerson).join('');
  if(room.players.length<room.capacity){$('lobby-players').innerHTML+=`<div class="lobby-slot"><div style="width:60px;height:60px;border-radius:12px;background:#50615b;display:grid;place-items:center">…</div><div><strong>Place libre</strong><small>En attente d'un ami</small></div></div>`;}
  $('lobby-message').textContent=room.players.length===room.capacity?'Tout le monde est là. À vous de jouer !':`En attente : ${room.capacity-room.players.length} joueur(s) manquant(s)…`;
  $('start').classList.toggle('hidden',!(room.host===uid&&room.players.length===room.capacity));
  $('rules-summary').textContent=rulesDescription(room.rules);
  $('lobby-rules').classList.toggle('hidden',room.host!==uid);
  const signature=JSON.stringify(room.rules||{});if(prevRulesSignature!==signature){prevRulesSignature=signature;fillEditor('lobby',room.rules);}
}
function renderMatch(){
  const s=room,player=currentPlayer(s),mine=s.players.find(p=>p.uid===uid),myTurn=s.phase==='playing'&&player?.uid===uid;
  $('game-capacity').textContent=`${s.capacity} JOUEURS`;
  $('round-meter').textContent=`Manche ${s.roundNumber||1} • Objectif ${s.rules?.targetScore||500} pts`;
  $('ranking').innerHTML=standings(s).map((p,i)=>`<span class="rank-entry ${p.uid===uid?'my-rank':''}">${i+1}. ${safe(p.name)} <b>${p.points} pts</b></span>`).join('');
  $('match-pill').textContent=mode==='demo'?'DÉMO HORS LIGNE':`SALLE ${code}`;
  $('players').classList.toggle('two',s.capacity===2);
  $('players').innerHTML=s.players.map(p=>person(p,s.phase==='playing'&&p.uid===player?.uid)).join('');
  $('direction-text').textContent=s.direction===1?'↻ Sens horaire':'↺ Sens inverse';
  $('penalty-banner').classList.toggle('hidden',!s.pendingPenalty);
  $('penalty-banner').textContent=s.pendingPenalty?`⚡ +${s.pendingPenalty.total} CARTES EN ATTENTE · Tu peux contrer avec une carte + ou encaisser.`:'';
  $('rules-live').textContent=rulesDescription(s.rules);
  $('turn-text').textContent=s.phase!=='playing'?'Manche terminée':myTurn?(s.pendingPenalty?'⚡ À TOI : CONTRER OU PIOCHER':'🎯 À TOI DE JOUER'):`Au tour de ${player?.name||'…'}`;
  $('deck-count').textContent=`(${(s.deck||[]).length})`;
  const card=currentCard(s);$('discard').outerHTML=`<div id="discard" class="card discard-card ${card?.c==='wild'?'wild':safe(card?.c)}" aria-label="Dernière carte posée"><span class="card-corner">${safe(cardSymbol(card))}</span><span class="card-inner ${['draw2','skip','reverse','wild','wild4','wild6','wild10','skipall','discardall'].includes(card?.v)?'card-special':''}">${safe(cardSymbol(card))}</span><span class="card-corner bottom">${safe(cardSymbol(card))}</span></div>`;
  $('active-color').className=`active-color ${safe(s.activeColor)}`;$('active-color').textContent=NAMES[s.activeColor]||'—';
  observeShow(s);
  const e=s.lastEvent,sp=s.players.find(p=>p.uid===(e?.speaker||e?.by));
  $('reaction-face').innerHTML=sp?`<img src="${avatarSrc(sp.avatar)}" alt="">`:'';
  $('reaction-name').textContent=e?.quip?(sp?.name||'Quelqu’un'):e?.by?(s.players.find(p=>p.uid===e.by)?.name||'À la table'):'Autour de la table';
  $('reaction-phrase').textContent=e?.quip||e?.label||'À vous de jouer !';
  const winner=s.players.find(p=>p.uid===s.winner);
  const roundOver=['finished','match_complete'].includes(s.phase);
  $('winner-box').classList.toggle('hidden',!roundOver);
  $('winner-name').textContent=winner?(s.phase==='match_complete'?`🏆 ${winner.name} gagne le championnat !`:`🥇 Manche ${s.roundNumber} : ${winner.name} gagne !`):'Victoire !';
  $('winner-points').textContent=s.lastRound?`+${s.lastRound.awarded} points gagnés • ${winner?.points||0} / ${s.rules?.targetScore||500} points` : '';
  $('round-recap').innerHTML=s.lastRound? s.lastRound.balances.map(p=>`<span>${safe(p.name)} : ${p.cards} carte(s), ${p.points} point(s) en main</span>`).join('') : '';
  $('replay').classList.toggle('hidden',!(s.phase==='finished'&&(mode==='demo'||uid===s.host)));
  $('new-championship').classList.toggle('hidden',!(roundOver&&(mode==='demo'||uid===s.host)));
  $('rematch-details').classList.toggle('hidden',!(s.phase==='finished'&&(mode==='demo'||uid===s.host)));
  const sig=JSON.stringify(s.rules||{});if(prevRematchSignature!==sig){prevRematchSignature=sig;fillEditor('rematch',s.rules);}
  const hand=mine?.hand||[];
  $('hand-status').textContent=s.phase==='finished'?'Fin de manche':myTurn?`${hand.length} cartes — ${s.drawnId?'carte piochée ou passer':'joue ou pioche'}`:`${hand.length} cartes — attends ton tour`;
  $('hand').innerHTML=hand.length?hand.map(c=>cardMarkup(c,canPlay(s,uid,c.id)?'playable':'unplayable')).join(''):'<p class="small-muted">Tu n’as pas de carte.</p>';
  requestAnimationFrame(fitMatchScreen);
  if(e?.seq!==lastFxSeq){const shouldAnimate=lastFxSeq>0&&!!(e?.forced>0);lastFxSeq=e?.seq||0;if(shouldAnimate)requestAnimationFrame(()=>penaltyEffect(e));}
  for(const el of $('hand').querySelectorAll('.playable'))el.onclick=()=>chooseCard(el.dataset.cardId);
  $('draw').disabled=!myTurn||!!s.drawnId||busy;
  $('draw').textContent=s.pendingPenalty?`⚡ Encaisser +${s.pendingPenalty.total}`:'Piocher 1 carte';
  $('pass').disabled=!myTurn||!s.drawnId||!!s.pendingPenalty||busy;
  $('uno-precall').parentElement.classList.toggle('hidden',!(myTurn&&hand.length===2));
  $('announce-uno').classList.toggle('hidden',!(s.unoPending?.uid===uid));
  $('catch-uno').classList.toggle('hidden',!(s.unoPending&&s.unoPending.uid!==uid&&s.phase==='playing'));
  const other=s.players.filter(p=>p.uid!==uid);const prev=$('tease-target').value;
  $('tease-target').innerHTML=other.map(p=>`<option value="${safe(p.uid)}">${safe(p.name)}</option>`).join('');
  if(other.some(p=>p.uid===prev))$('tease-target').value=prev;
  $('tease').disabled=s.phase!=='playing'||!other.length||busy;
}
function layoutHand(){
 const el=$('hand');if(!el||el.offsetParent===null)return;
 const count=el.children.length;if(count===0)return;
 const width=el.clientWidth||350,small=window.innerWidth<=530;
 const holder=$('hand-area')?.getBoundingClientRect(),head=$('hand-heading')?.getBoundingClientRect(),controls=$('controls')?.getBoundingClientRect();
 const freeHeight=holder&&head&&controls?holder.height-head.height-controls.height-20:Math.min(210,window.innerHeight*.24);
 const availableH=Math.max(12,freeHeight);
 // Plusieurs rangées, sans barre de défilement. Les cartes restent toutes présentes, y compris après +10.
 let best=null;
 for(let cols=1;cols<=Math.min(24,count);cols++){
  const rows=Math.ceil(count/cols),gap=3;
  const w=(width-(cols-1)*gap-10)/cols;
  const h=Math.min(w*1.43,(availableH-(rows-1)*gap)/rows,small?128:133);
  const aspectDeviation=Math.abs(Math.log((w/Math.max(h,1))/.70));
  const score=(w*h)/(1+aspectDeviation*6)-Math.max(0,rows-6)*1500;
  if(h>=9&&(!best||score>best.score))best={cols,rows,w,h,score};
 }
 if(!best){best={cols:Math.min(count,20),h:10,w:Math.max(13,width/20)};}
 const h=Math.max(9,Math.floor(best.h)),w=Math.max(12,Math.floor(best.w));
 el.style.setProperty('--hand-cols',best.cols);
 el.style.setProperty('--hand-card-h',h+'px');
 el.style.setProperty('--hand-font',Math.max(6,Math.min(39,Math.floor(h*.40),Math.floor(w*.65)))+'px');
 el.style.setProperty('--hand-corner',Math.max(6,Math.min(13,Math.floor(h*.16)))+'px');
 el.classList.toggle('very-compact',h<55);
}
window.addEventListener('resize',()=>requestAnimationFrame(fitMatchScreen));
window.addEventListener('orientationchange',()=>requestAnimationFrame(fitMatchScreen));
window.visualViewport?.addEventListener('resize',()=>requestAnimationFrame(fitMatchScreen));
function fitMatchScreen(){
 if($('match').classList.contains('hidden'))return;
 const viewport=window.visualViewport?.height||window.innerHeight;
 document.documentElement.style.setProperty('--match-vh',viewport+'px');
 // La main reçoit exactement la place libre après en-têtes, table et commandes.
 layoutHand();
}
function penaltyEffect(e){
 if(!e||!e.forced)return;
 const layer=$('penalty-fx'),origin=$('draw-pile')?.getBoundingClientRect(),target=[...document.querySelectorAll('.score-player')].find(x=>x.dataset.playerUid===e.affected)?.getBoundingClientRect();
 if(!layer||!origin||!target)return;
 const startX=origin.left+origin.width/2,startY=origin.top+origin.height/2,endX=target.left+target.width/2,endY=target.top+target.height/2;
 const msg=document.createElement('div');msg.className='penalty-explosion';msg.textContent=`+${e.forced} CARTES !`;layer.appendChild(msg);
 msg.style.left=`${endX}px`;msg.style.top=`${endY}px`;
 msg.animate([{opacity:0,transform:'translate(-50%,-50%) scale(.4)'},{opacity:1,transform:'translate(-50%,-50%) scale(1.2)',offset:.5},{opacity:0,transform:'translate(-50%,-85%) scale(1.15)'}],{duration:1650,easing:'ease-out'}).onfinish=()=>msg.remove();
 for(let i=0;i<Math.min(7,e.forced);i++){
  const card=document.createElement('div');card.className='penalty-fly-card';card.textContent='C&C';layer.appendChild(card);
  const x=endX-startX+(i-3)*9,y=endY-startY+(i%3)*6;
  card.style.left=`${startX}px`;card.style.top=`${startY}px`;
  card.animate([{opacity:0,transform:'translate(-50%,-50%) rotate(-10deg) scale(.5)'},{opacity:1,offset:.15},{opacity:1,transform:`translate(calc(-50% + ${x}px),calc(-50% + ${y}px)) rotate(${(i-3)*12}deg) scale(.72)`,offset:.82},{opacity:0,transform:`translate(calc(-50% + ${x}px),calc(-50% + ${y}px)) scale(.2)`}],{duration:900+i*80,delay:i*90,easing:'ease-in-out'}).onfinish=()=>card.remove();
 }
}
function chooseCard(id){if(!room||!canPlay(room,uid,id))return;
  const card=handOf(room,uid).find(c=>c.id===id);if(card?.c==='wild'){
    pendingWild=id;$('color-modal').classList.remove('hidden');return;
  }
  playSelected(id,null);
}
$('cancel-color').onclick=()=>{$('color-modal').classList.add('hidden');pendingWild=null;};
for(const b of document.querySelectorAll('[data-color]'))b.onclick=()=>{
  const id=pendingWild;pendingWild=null;$('color-modal').classList.add('hidden');if(id)playSelected(id,b.dataset.color);
};
async function action(onlineFn,localFn){if(busy||!room)return;busy=true;
  try{
    if(mode==='demo'){room=localFn(room,uid);render();}
    else await onlineFn(code);
  }catch(e){notify(e.message);}finally{busy=false;if(mode==='demo')render();}
}
function playSelected(cardId,color){const declare=$('uno-precall').checked;$('uno-precall').checked=false;
  return action(c=>Net.play(c,cardId,color,declare),(s,uid)=>playCard(s,uid,cardId,color,declare));}
$('draw').onclick=()=>action(c=>Net.draw(c),(s,uid)=>drawCard(s,uid));
$('pass').onclick=()=>action(c=>Net.pass(c),(s,uid)=>passTurn(s,uid));
$('announce-uno').onclick=()=>action(c=>Net.uno(c),(s,uid)=>announceUno(s,uid));
$('catch-uno').onclick=()=>action(c=>Net.catchUnoOnline(c),(s,uid)=>catchUno(s,uid));
$('tease').onclick=()=>{const target=$('tease-target').value;action(c=>Net.teaseOnline(c,target),(s,uid)=>tease(s,uid,target));};
$('save-rules').onclick=()=>action(c=>Net.configureRules(c,editorValues('lobby')),(s,uid)=>s);
$('save-rematch').onclick=()=>action(c=>Net.configureRules(c,editorValues('rematch')),(s,uid)=>setRoomRules(s,uid,editorValues('rematch')));
$('start').onclick=()=>action(c=>Net.start(c),(s,uid)=>startGame(s,uid,123456));
$('replay').onclick=()=>action(c=>Net.replay(c),(s,uid)=>startGame(s,uid,(Date.now()>>>0)));
$('new-championship').onclick=()=>action(c=>Net.newMatch(c),(s,uid)=>newChampionship(s,uid,(Date.now()>>>0)));
$('draw-pile').onclick=()=>{if(room?.phase==='playing'&&currentPlayer(room)?.uid===uid&&!room.drawnId)$('draw').click();};
function maybeBot(){clearTimeout(botTimer);if(mode!=='demo'||room?.phase!=='playing'||!currentPlayer(room)?.uid.startsWith('bot-'))return;
  const expected=room.seq;
  botTimer=setTimeout(()=>{
    if(mode!=='demo'||!room||room.seq!==expected||room.phase!=='playing')return;
    const b=currentPlayer(room).uid;
    try{const choice=botChoice(room,b);
      if(choice){room=playCard(room,b,choice.cardId,choice.color,true);}
      else if(room.drawnId){room=passTurn(room,b);}
      else{room=drawCard(room,b);}
      render();
    }catch(e){notify('Bot : '+e.message);}
  },850);
}
$('copy-link').onclick=async()=>{
  const url=new URL(location.href);url.searchParams.set('room',code);
  const value=`Rejoins-nous sur Cartes & Chambrages ! Salle ${code} : ${url.toString()}`;
  try{if(navigator.share)await navigator.share({title:'Cartes & Chambrages',text:`Rejoins notre salle ${code}`,url:url.toString()});else await navigator.clipboard.writeText(value);notify('Invitation prête à partager !');}
  catch{try{await navigator.clipboard.writeText(value);notify('Lien copié !');}catch{prompt('Copie ce lien :',value);}}
};
// La configuration de la revanche est intégrée à la fenêtre de scores pour éviter les superpositions.
$('winner-box').appendChild($('rematch-details'));
if(!Net.firebaseConfigured())$('setup-note').textContent='Mode en ligne : il faut d’abord compléter firebase-config.js et publier le jeu (voir guide). La démo contre les bots fonctionne sans compte.';
setupShow(avatarSrc);
view('setup');
if('serviceWorker'in navigator&&location.protocol==='https:')navigator.serviceWorker.register('./sw.js?v=053',{updateViaCache:'none'}).catch(()=>{});
