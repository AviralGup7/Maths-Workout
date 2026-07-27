import { describe, it } from 'vitest';
import { buildQuestion, installRng, srand } from '../harness';
installRng(); srand(5);
describe('x',()=>{it('numsense.reasonable at ceiling',()=>{
 const t:Record<string,number>={}; let numeric=0;
 for(let i=0;i<3000;i++){
  const q=buildQuestion('1st','hard','number_sense','numsense.reasonable',0.80);
  if(!q)continue; const k=q.interaction?.kind??'choice'; t[k]=(t[k]??0)+1;
  if(typeof q.answer==='number'&&Number.isFinite(q.answer)) numeric++;
 }
 console.log('interaction mix:',JSON.stringify(t),'numericAnswers=',numeric);
});});
