/** Cartes & Chambrages V0.5 — Dictionnaire modifiable de répliques.
 * Chaque événement est répliqué via Firebase. L'effet est purement cosmétique. */
export const VICTORY_LINES={
  franck:'Ah ah ah ! Bien joué !',
  mathias:'Et voila! Trop de talent!',
  stephane:'Eh vous voila gniardisés'
};
export const PHRASES={
  draw2:'Oups...vraiment désolé...ou pas !',
  wild4:'Dans ton gniard ! Et quatre cartes pour toi !',
  bigDraw:'Ça va piquer !',
  stack:'Aie ! alors là ca pique!',
  penalty:'Miskine !',
  skip:'Bah voila , pioche',
  reverse:"Comme quand t'es buré Saturne !",
  skipall:'Chuut!',
  discardall:'Et hop, tout dégage !',
  wild:'Hi hi hi !',
  one:'Atila, roi des uns !',
  draw:'Miskine !',
  catch:'Miskine ! Deux cartes pour toi !',
  uno:'UNO !',
  tease:'Tocar !'
};
export function attachReaction(state,evt){
  const players=state.players||[];
  const speakerOther=()=>players.find(p=>p.uid!==evt.by)?.uid||evt.by;
  const actor=players.find(p=>p.uid===evt.by);
  let text='',speaker=evt.by,fx='none';
  switch(evt.type){
    case 'play':
      if(evt.card==='draw2'){text=PHRASES.draw2;fx='plus2';}
      else if(evt.card==='wild4'){text=PHRASES.wild4;fx='plus4';}
      else if(evt.card==='wild6'||evt.card==='wild10'){text=PHRASES.bigDraw;fx=evt.card==='wild10'?'plus10':'plus6';}
      else if(evt.card==='skip'){text=PHRASES.skip;fx='skip';}
      else if(evt.card==='reverse'){text=PHRASES.reverse;fx='reverse';}
      else if(evt.card==='skipall'){text=PHRASES.skipall;fx='skipall';}
      else if(evt.card==='discardall'){text=PHRASES.discardall;fx='discard';}
      else if(evt.card==='wild'){text=PHRASES.wild;fx='joker';}
      else if(evt.card==='1'){text=PHRASES.one;speaker=speakerOther();fx='tease';}
      break;
    case 'stack':text=PHRASES.stack;fx='stack';break;
    case 'penalty':text=PHRASES.penalty;speaker=speakerOther();fx='penalty';break;
    case 'draw':text=PHRASES.draw;speaker=speakerOther();fx='draw';break;
    case 'catch':text=PHRASES.catch;fx='catch';break;
    case 'uno':text=PHRASES.uno;fx='uno';break;
    case 'tease':text=PHRASES.tease;speaker=evt.target;fx='tease';break;
    case 'win':case 'champion':
      text=VICTORY_LINES[actor?.avatar]||'Bravo !';
      fx=evt.type==='champion'?'champion':'win';break;
    default:break;
  }
  if(text){evt.quip=text;evt.speaker=speaker;evt.fx=fx;}
  return evt;
}
