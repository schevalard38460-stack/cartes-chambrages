import {attachReaction} from './reactions.mjs';
/** Cartes & Chambrages — moteur de règles pur, aucune dépendance Firebase. */
export const COLORS=['red','yellow','green','blue'];
export const NAMES={red:'Rouge',yellow:'Jaune',green:'Vert',blue:'Bleu'};
export const AVATARS=['franck','stephane','mathias'];
export const MAX_NAME=18;
const ACTIONS=['skip','reverse','draw2'];
const VALID_VALUES=['0','1','2','3','4','5','6','7','8','9',...ACTIONS,'wild','wild4','wild6','wild10','skipall','discardall'];
export const DRAW_VALUES=[2,4,6,10];
export const DEFAULT_TARGET_SCORE=500;
export function normalizeTargetScore(value){const n=Number(value);if(!Number.isInteger(n)||n<50||n>5000)return DEFAULT_TARGET_SCORE;return n;}
export function cardPoints(card){if(!card)return 0;if(/^\d$/.test(card.v))return Number(card.v);if(['wild','wild4'].includes(card.v))return 50;if(card.v==='wild6')return 60;if(card.v==='wild10')return 100;return 20;}
export function handPoints(hand=[]){return hand.reduce((sum,c)=>sum+cardPoints(c),0);}
export function standings(state){return [...(state.players||[])].map(p=>({uid:p.uid,name:p.name,avatar:p.avatar,points:p.points||0,wins:p.wins||0})).sort((a,b)=>b.points-a.points||b.wins-a.wins);}
export const DEFAULT_RULES={stackMode:'off',stackPairs:{},specials:{wild6:false,wild10:false,skipall:false,discardall:false},targetScore:DEFAULT_TARGET_SCORE};
export function normalizeRules(input={}){
  const stackMode=['off','same','higher','any','custom'].includes(input?.stackMode)?input.stackMode:'off';
  const specials=Object.fromEntries(['wild6','wild10','skipall','discardall'].map(k=>[k,input?.specials?.[k]===true]));
  const stackPairs=Object.fromEntries(DRAW_VALUES.flatMap(a=>DRAW_VALUES.map(b=>[`${a}:${b}`,input?.stackPairs?.[`${a}:${b}`]===true])));
  return {stackMode,stackPairs,specials,targetScore:normalizeTargetScore(input?.targetScore)};
}
export function mayStack(settings,previous,incoming){
  const r=normalizeRules(settings);if(!DRAW_VALUES.includes(previous)||!DRAW_VALUES.includes(incoming))return false;
  if(incoming===6&&!r.specials.wild6||incoming===10&&!r.specials.wild10)return false;
  if(r.stackMode==='same')return incoming===previous;
  if(r.stackMode==='higher')return incoming>=previous;
  if(r.stackMode==='any')return true;
  if(r.stackMode==='custom')return r.stackPairs[`${incoming}:${previous}`]===true;
  return false;
}
export function drawValue(card){return ({draw2:2,wild4:4,wild6:6,wild10:10})[card?.v]||0;}
const fail=(s)=>{throw new Error(s)};
const clone=x=>JSON.parse(JSON.stringify(x));
export const handOf=(s,uid)=>s.players.find(p=>p.uid===uid)?.hand||[];
export const currentPlayer=s=>s.players[s.turn];
export const currentCard=s=>(s.discard||[]).at(-1);
export const cardText=(c)=>({wild:'Joker',wild4:'+4',wild6:'+6',wild10:'+10',draw2:'+2',reverse:'Inversion',skip:'Passer',skipall:'Tous passent',discardall:'Vide couleur'})[c?.v]||c?.v||'—';
export const isSpecial=c=>['wild','wild4','wild6','wild10'].includes(c?.v);
export function makeDeck(settings={}){
  const {specials}=normalizeRules(settings);
  const cards=[];
  for(const c of COLORS){
    cards.push({id:`${c}-0-0`,c,v:'0'});
    for(let v=1;v<=9;v++)for(let i=0;i<2;i++)cards.push({id:`${c}-${v}-${i}`,c,v:String(v)});
    for(const v of ACTIONS)for(let i=0;i<2;i++)cards.push({id:`${c}-${v}-${i}`,c,v});
    if(specials.skipall)cards.push({id:`${c}-skipall-0`,c,v:'skipall'});
    if(specials.discardall)cards.push({id:`${c}-discardall-0`,c,v:'discardall'});
  }
  for(let i=0;i<4;i++){
    cards.push({id:`wild-${i}`,c:'wild',v:'wild'});
    cards.push({id:`wild4-${i}`,c:'wild',v:'wild4'});
  }
  if(specials.wild6)for(let i=0;i<2;i++)cards.push({id:`wild6-${i}`,c:'wild',v:'wild6'});
  if(specials.wild10)for(let i=0;i<2;i++)cards.push({id:`wild10-${i}`,c:'wild',v:'wild10'});
  return cards;
}
export function rngFor(seed){let a=seed>>>0;return ()=>{a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t^=t+Math.imul(t^(t>>>7),61|t);return ((t^(t>>>14))>>>0)/4294967296;};}
export function shuffle(deck,seed=123){let a=[...deck],r=rngFor(seed);for(let i=a.length-1;i>0;i--){let j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function cleanName(s){return String(s||'').trim().slice(0,MAX_NAME)||'Joueur';}
function checkAvatar(a){if(!AVATARS.includes(a))fail('Personnage inconnu');}
function event(s,type,by,label,extras={}){
  s.seq=(s.seq||0)+1;s.lastEvent={seq:s.seq,type,by,label,...extras};return s;
}
export function makeRoom(uid,name,avatar,capacity=3,settings={}){
  if(!uid)fail('Identifiant manquant');checkAvatar(avatar);
  if(![2,3].includes(Number(capacity)))fail('Choisir 2 ou 3 joueurs');
  return{version:1,host:uid,capacity:Number(capacity),rules:normalizeRules(settings),phase:'lobby',roundNumber:0,roundHistory:[],champion:null,players:[{uid,name:cleanName(name),avatar,points:0,wins:0}],turn:0,direction:1,seq:1,createdAt:Date.now(),lastEvent:{seq:1,type:'join',by:uid,label:`${cleanName(name)} est arrivé·e`}};
}
export function addPlayer(state,uid,name,avatar){
  if(!state)fail('Salle introuvable');checkAvatar(avatar);
  const s=clone(state);if(s.players.some(p=>p.uid===uid))return s;
  if(s.phase!=='lobby')fail('La partie a déjà commencé');
  if(s.players.length>=s.capacity)fail('La salle est complète');
  if(s.players.some(p=>p.avatar===avatar))fail('Ce personnage est déjà choisi');
  s.players.push({uid,name:cleanName(name),avatar,points:0,wins:0});
  return event(s,'join',uid,`${cleanName(name)} rejoint la table`);
}
export function setRoomRules(state,uid,settings){
  if(!state||state.host!==uid)fail('Seul l’organisateur peut régler les règles');
  if(!['lobby','finished'].includes(state.phase))fail('Les règles sont verrouillées pendant la manche');
  const s=clone(state);const next=normalizeRules(settings);
  if(state.phase==='finished'&&Math.max(...s.players.map(p=>p.points||0))>=next.targetScore)fail('Le score cible doit dépasser le meilleur score actuel');
  s.rules=next;return event(s,'rules',uid,'Règles de la salle mises à jour');
}
export const turnIndex=(s,steps=1)=>((s.turn+steps*s.direction)%s.players.length+s.players.length)%s.players.length;
export function startGame(state,uid,seed=123456){
  if(!state||state.host!==uid)fail('Seul l’organisateur peut lancer la partie');
  if(!(state.phase==='lobby'||state.phase==='finished'))fail(state.phase==='match_complete'?'Le championnat est terminé : démarre un nouveau championnat':'La manche est déjà en cours');
  if(state.players.length!==state.capacity)fail(`Il faut ${state.capacity} joueurs pour commencer`);
  const s=clone(state);const cards=shuffle(makeDeck(s.rules),seed>>>0);
  s.players=s.players.map(p=>({...p,hand:Array.from({length:7},()=>cards.pop()),wins:p.wins||0,points:p.points||0}));
  s.roundNumber=(s.roundNumber||0)+1;s.champion=null;s.lastRound=null;
  const numeric=cards.findIndex(c=>/^\d$/.test(c.v));
  if(numeric<0)fail('Paquet invalide');
  const initial=cards.splice(numeric,1)[0];
  s.deck=cards;s.seed=seed>>>0;s.discard=[initial];s.activeColor=initial.c;s.direction=1;
  s.turn=0;s.drawnId=null;s.pendingPenalty=null;s.unoPending=null;s.winner=null;s.phase='playing';s.startedAt=Date.now();
  return event(s,'start',uid,`C'est parti ! Premier joueur : ${s.players[0].name}`);
}
export function newChampionship(state,uid,seed=123456){
  if(!state||uid!==state.host)fail('Seul l’organisateur peut démarrer un nouveau championnat');
  if(!['finished','match_complete'].includes(state.phase))fail('Il faut terminer la manche');
  const s=clone(state);s.players=s.players.map(p=>({...p,points:0,wins:0}));s.roundNumber=0;s.roundHistory=[];s.champion=null;s.lastRound=null;s.phase='lobby';
  return startGame(s,uid,seed);
}
export function playable(card,top,color,hand=[]){
  if(!card||!top)return false;
  if(card.v==='wild4')return !(hand||[]).some(c=>c.c===color);
  if(['wild6','wild10'].includes(card.v))return true;
  if(card.v==='wild')return true;
  return card.c===color||(top.c!=='wild'&&card.v===top.v);
}
export function canPlay(state,uid,cardId){
  const p=state.players.find(p=>p.uid===uid);if(!p)return false;
  const hand=p.hand||[],card=hand.find(c=>c.id===cardId);if(!card)return false;
  if(state.phase!=='playing'||currentPlayer(state).uid!==uid)return false;
  if(state.pendingPenalty)return mayStack(state.rules,state.pendingPenalty.last,drawValue(card));
  return (!state.drawnId||state.drawnId===cardId)&&playable(card,currentCard(state),state.activeColor,hand.filter(c=>c.id!==cardId));
}
function ensureTurn(s,uid){if(!s||s.phase!=='playing')fail('La partie n’est pas en cours');if(!s.players[s.turn]||s.players[s.turn].uid!==uid)fail('Ce n’est pas ton tour');}
function recycle(s){
  if((s.deck||[]).length)return;
  if((s.discard||[]).length<=1)return;
  const top=s.discard.pop(),pool=s.discard;s.discard=[top];s.deck=shuffle(pool,((s.seed||1)*1664525+1013904223)>>>0);s.seed=((s.seed||1)*1664525+1013904223)>>>0;
}
function takeCards(s,ix,n){const taken=[];for(let i=0;i<n;i++){recycle(s);if(!(s.deck||[]).length)break;taken.push(s.deck.pop());}s.players[ix].hand.push(...taken);return taken.length;}
function playerById(s,uid){const ix=s.players.findIndex(p=>p.uid===uid);if(ix===-1)fail('Joueur introuvable');return ix;}
// Les événements cosmétiques sont conservés dans un journal court commun aux appareils.
// Les règles et le score restent exactement identiques à la V0.4.
function emit(s,type,by,label,extras={}){
  event(s,type,by,label,extras);
  attachReaction(s,s.lastEvent);
  if(s.lastEvent.quip){
    const {seq,type,by,quip,speaker,fx,card,affected,forced,target}=s.lastEvent;
    const entry={seq,type,by,quip,speaker,fx};
    if(card!==undefined)entry.card=card;
    if(affected!==undefined)entry.affected=affected;
    if(forced!==undefined)entry.forced=forced;
    if(target!==undefined)entry.target=target;
    s.showLog=[...(s.showLog||[]),entry].slice(-16);
  }
  return s;
}
function finishRound(s,uid,extras={}){
 const player=s.players.find(p=>p.uid===uid);
 const balances=s.players.map(p=>({uid:p.uid,name:p.name,cards:p.hand.length,points:handPoints(p.hand)}));
 const awarded=balances.filter(p=>p.uid!==uid).reduce((sum,p)=>sum+p.points,0);
 player.points=(player.points||0)+awarded;player.wins=(player.wins||0)+1;
 s.winner=uid;s.unoPending=null;s.pendingPenalty=null;s.drawnId=null;
 const target=normalizeTargetScore(s.rules?.targetScore);
 const hasWon=player.points>=target;s.phase=hasWon?'match_complete':'finished';s.champion=hasWon?uid:null;
 s.lastRound={round:s.roundNumber||1,winner:uid,awarded,balances,totals:s.players.map(p=>({uid:p.uid,points:p.points||0,wins:p.wins||0}))};
 s.roundHistory=[...(s.roundHistory||[]),s.lastRound].slice(-30);
 return emit(s,hasWon?'champion':'win',uid,hasWon?`${player.name} remporte le championnat avec ${player.points} points !`:`${player.name} gagne ${awarded} points (${player.points}/${target}) !`,{awarded,target,champion:hasWon,...extras});
}
export function playCard(state,uid,cardId,color=null,declared=false){
  const s=clone(state);ensureTurn(s,uid);const ix=playerById(s,uid),p=s.players[ix];
  const i=p.hand.findIndex(c=>c.id===cardId);if(i<0)fail('Carte absente de ta main');const card=p.hand[i];
  if(!canPlay(s,uid,cardId))fail(s.pendingPenalty?'Cette carte ne peut pas cumuler la pénalité':'Cette carte ne peut pas être jouée');
  if(isSpecial(card)&&!COLORS.includes(color))fail('Choisis une nouvelle couleur');
  const wasStacking=!!s.pendingPenalty;
  p.hand.splice(i,1);
  // Une défausse complète enlève toutes les autres cartes de la couleur, puis laisse la spéciale au-dessus.
  let discardedExtra=0;
  if(card.v==='discardall'){
    const removed=p.hand.filter(x=>x.c===card.c);discardedExtra=removed.length;
    p.hand=p.hand.filter(x=>x.c!==card.c);s.discard.push(...removed);
  }
  s.discard.push(card);s.activeColor=isSpecial(card)?color:card.c;
  s.unoPending=null;s.drawnId=null;
  let steps=1,forced=0;
  if(card.v==='reverse'){s.direction*=-1;if(s.players.length===2)steps=2;}
  if(card.v==='skip')steps=2;
  if(card.v==='skipall')steps=s.players.length;
  const amount=drawValue(card);
  const affectedIx=turnIndex(s,1);
  if(p.hand.length===0){
    // Une dernière carte +2 / +4 / +6 / +10 est appliquée directement avant le calcul des points.
    // La manche se termine immédiatement, même lorsque les cumuls sont autorisés.
    const forcedFinal=amount?takeCards(s,affectedIx,amount):0;
    s.turn=ix;return finishRound(s,uid,{card:card.v,color:s.activeColor,discardedExtra,affected:s.players[affectedIx]?.uid,forced:forcedFinal});
  }
  if(amount){
    if(s.rules?.stackMode&&s.rules.stackMode!=='off'){
      const total=(s.pendingPenalty?.total||0)+amount;
      s.pendingPenalty={total,last:amount};s.turn=affectedIx;
      if(p.hand.length===1&&!declared)s.unoPending={uid,at:s.seq+1};
      return emit(s,wasStacking?'stack':'play',uid,`${p.name} pose +${amount} : pénalité cumulée +${total} !`,{card:card.v,affected:s.players[affectedIx].uid,pendingTotal:total,color:s.activeColor});
    }
    forced=takeCards(s,affectedIx,amount);steps=2;
  }
  if(p.hand.length===1&&!declared)s.unoPending={uid,at:s.seq+1};
  s.turn=turnIndex(s,steps);
  return emit(s,'play',uid,`${p.name} joue ${cardText(card)}${card.c==='wild'?' — '+NAMES[s.activeColor]:''}`,{card:card.v,affected:s.players[affectedIx]?.uid,forced,discardedExtra,unoPending:!!s.unoPending,color:s.activeColor});
}
export function drawCard(state,uid){
  const s=clone(state);ensureTurn(s,uid);if(s.drawnId)fail('Tu as déjà pioché : joue cette carte ou passe');
  s.unoPending=null;
  if(s.pendingPenalty){
    const amount=s.pendingPenalty.total,ix=playerById(s,uid);
    const drawn=takeCards(s,ix,amount);s.pendingPenalty=null;s.turn=turnIndex(s);
    return emit(s,'penalty',uid,`${s.players[ix].name} encaisse +${drawn} cartes !`,{affected:uid,forced:drawn});
  }
  recycle(s);
  if(!(s.deck||[]).length){s.turn=turnIndex(s);return emit(s,'pass',uid,'Pioche vide : tour suivant');}
  const i=playerById(s,uid),card=s.deck.pop();s.players[i].hand.push(card);s.drawnId=card.id;
  return emit(s,'draw',uid,`${s.players[i].name} pioche une carte`);
}
export function passTurn(state,uid){const s=clone(state);ensureTurn(s,uid);if(!s.drawnId)fail('Tu dois d’abord piocher');s.drawnId=null;s.unoPending=null;s.turn=turnIndex(s);return emit(s,'pass',uid,`${s.players.find(p=>p.uid===uid).name} passe`);}
export function announceUno(state,uid){const s=clone(state);if(s.phase!=='playing'||s.unoPending?.uid!==uid)fail('Pas de UNO à annoncer');s.unoPending=null;return emit(s,'uno',uid,`${s.players.find(p=>p.uid===uid).name} annonce UNO !`);}
export function catchUno(state,uid){const s=clone(state);if(s.phase!=='playing'||!s.unoPending)fail('Personne à prendre en défaut');if(s.unoPending.uid===uid)fail('Tu ne peux pas te dénoncer');playerById(s,uid);const guilty=s.unoPending.uid;takeCards(s,playerById(s,guilty),2);s.unoPending=null;return emit(s,'catch',uid,`${s.players.find(p=>p.uid===guilty).name} a oublié UNO ! +2 cartes`,{target:guilty});}
export function tease(state,uid,target){const s=clone(state);if(!['playing','lobby','finished'].includes(s.phase))fail('Salle indisponible');playerById(s,uid);if(uid===target)fail('Choisis un ami');playerById(s,target);if(s.lastTease&&s.lastTease.uid===uid&&Date.now()-s.lastTease.at<8000)fail('Attends un peu avant de chambrer encore');s.lastTease={uid,at:Date.now()};return emit(s,'tease',uid,`${s.players.find(p=>p.uid===uid).name} chambre ${s.players.find(p=>p.uid===target).name}`,{target});}
export function botChoice(s,uid){const hand=handOf(s,uid);const candidates=hand.filter(c=>canPlay(s,uid,c.id));if(!candidates.length)return null;const priority={wild10:18,wild6:16,draw2:13,wild4:12,skipall:11,skip:10,discardall:9,reverse:8,wild:1};candidates.sort((a,b)=>(priority[b.v]||2)-(priority[a.v]||2));const card=candidates[0];const counts=Object.fromEntries(COLORS.map(c=>[c,hand.filter(x=>x.c===c).length]));const color=COLORS.reduce((a,b)=>counts[a]>=counts[b]?a:b);return {cardId:card.id,color,declared:true};}
export const validValues=VALID_VALUES;
