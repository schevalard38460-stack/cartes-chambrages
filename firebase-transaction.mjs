/** Mise à jour atomique d'une salle existante.
 * Firebase peut appeler runTransaction avec null avant d'avoir reçu le serveur.
 * Un abonnement actif procure un instantané initial ; le moteur SDK utilise
 * sa vérification de version serveur pour rejouer la transaction en cas de conflit.
 */
export async function transactionOnExistingRoom(api, target, transform) {
  let stop=()=>{};
  let latest=null;
  let settled=false;
  const firstSnapshot=new Promise((resolve,reject)=>{
    stop=api.onValue(target, snap=>{
      latest=snap.val();
      if(!settled){settled=true;resolve(latest);}
    }, err=>{
      if(!settled){settled=true;reject(err);}
    });
  });
  try{
    if(!await firstSnapshot)throw Error('Salle introuvable sur Firebase. Vérifie le code.');
    let first=true, problem='';
    const result=await api.runTransaction(target,current=>{
      const value=(current===null&&first)?latest:current;
      first=false;
      if(!value){problem='La salle a été fermée ou supprimée.';return undefined;}
      try{problem='';return transform(value);}
      catch(e){problem=e?.message||String(e);return undefined;}
    },{applyLocally:false});
    if(!result.committed)throw Error(problem||'La modification de la salle a échoué. Réessaie.');
    return result.snapshot.val();
  }finally{stop();}
}
