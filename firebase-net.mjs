/** Synchronisation Firebase Realtime Database : 1 transaction atomique par action.
 * Les mains sont lisibles au niveau de la base : solution pour parties entre amis de confiance.
 */
import {makeRoom,addPlayer,startGame,playCard,drawCard,passTurn,announceUno,catchUno,tease,setRoomRules,newChampionship} from './rules.mjs';
import {transactionOnExistingRoom} from './firebase-transaction.mjs';
let sessionPromise=null;
export function firebaseConfigured(){const c=window.CARTES_FIREBASE_CONFIG;return !!(c?.apiKey&&c.apiKey!=='A_REMPLACER'&&c.projectId&&c.projectId!=='VOTRE-PROJET'&&c.databaseURL&&!c.databaseURL.includes('VOTRE-BASE'));}
export async function connectFirebase(){
  if(sessionPromise)return sessionPromise;
  sessionPromise=(async()=>{
    if(!firebaseConfigured())throw Error('Firebase n’est pas configuré. Lis le guide du fichier ZIP.');
    const [app,auth,database]=await Promise.all([
      import('https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/13.3.0/firebase-database.js')
    ]);
    const fb=app.initializeApp(window.CARTES_FIREBASE_CONFIG);
    const a=auth.getAuth(fb);await auth.authStateReady(a);
    if(!a.currentUser)await auth.signInAnonymously(a);
    return {uid:a.currentUser.uid,db:database.getDatabase(fb),api:database};
  })();
  try{return await sessionPromise;}catch(e){sessionPromise=null;throw e;}
}
const roomPath=code=>'cardRooms/'+code;
function codeRandom(){const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',raw=new Uint8Array(8);crypto.getRandomValues(raw);return [...raw].map(i=>alphabet[i%alphabet.length]).join('');}
function randomSeed(){const a=new Uint32Array(1);crypto.getRandomValues(a);return a[0];}
export async function createRoom(name,avatar,capacity,rules={}){const{uid,db,api}=await connectFirebase();
  for(let i=0;i<8;i++){
    const code=codeRandom(),r=api.ref(db,roomPath(code));
    const result=await api.runTransaction(r,old=>old===null?makeRoom(uid,name,avatar,capacity,rules):undefined,{applyLocally:false});
    if(result.committed)return{code,uid};
  }
  throw Error('Impossible de créer un salon. Réessaie.');
}
export async function joinRoom(code,name,avatar){
  const {uid,db,api}=await connectFirebase();
  const target=api.ref(db,roomPath(code));
  await transactionOnExistingRoom(api,target,old=>addPlayer(old,uid,name,avatar));
  return {code,uid};
}
async function update(code,fn){
  const {uid,db,api}=await connectFirebase();
  const target=api.ref(db,roomPath(code));
  return transactionOnExistingRoom(api,target,old=>fn(old,uid));
}
export const configureRules=(code,rules)=>update(code,(s,uid)=>setRoomRules(s,uid,rules));
export const start=(code)=>{const seed=randomSeed();return update(code,(s,uid)=>startGame(s,uid,seed));};
export const replay=(code)=>{const seed=randomSeed();return update(code,(s,uid)=>startGame(s,uid,seed));};
export const newMatch=(code)=>{const seed=randomSeed();return update(code,(s,uid)=>newChampionship(s,uid,seed));};
export const play=(code,cardId,color,declare)=>update(code,(s,uid)=>playCard(s,uid,cardId,color,declare));
export const draw=(code)=>update(code,(s,uid)=>drawCard(s,uid));
export const pass=(code)=>update(code,(s,uid)=>passTurn(s,uid));
export const uno=(code)=>update(code,(s,uid)=>announceUno(s,uid));
export const catchUnoOnline=(code)=>update(code,(s,uid)=>catchUno(s,uid));
export const teaseOnline=(code,target)=>update(code,(s,uid)=>tease(s,uid,target));
export function listenRoom(code,onChange,onError){let un=()=>{},closed=false;
  connectFirebase().then(({db,api})=>{
    if(closed)return;
    un=api.onValue(api.ref(db,roomPath(code)),snapshot=>onChange(snapshot.val()),err=>onError(err));
  }).catch(onError);
  return()=>{closed=true;un();};
}
