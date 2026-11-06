const mean=xs=>xs.reduce((a,b)=>a+b,0)/xs.length;
export function evaluatePredictions(rows,horizon=1) {
  const data=rows.filter(r=>Number.isFinite(r.predictedReturn)&&Number.isFinite(r.actualReturn));
  if(!data.length)return {count:0,mae:null,baselineMae:null,improvement:null,interval:null,periods:[],verdict:"No settled predictions yet"};
  const error=r=>Math.abs(r.predictedReturn-r.actualReturn);
  const benefits=data.map(r=>Math.abs(r.actualReturn)-error(r));
  const periods=[];
  for(let i=0;i<data.length;i+=13){const chunk=data.slice(i,i+13);periods.push({from:chunk[0].origin||chunk[0].asOf,to:chunk.at(-1).date||chunk.at(-1).target,count:chunk.length,mae:mean(chunk.map(error)),baselineMae:mean(chunk.map(r=>Math.abs(r.actualReturn)))});}
  let interval=null;
  if(data.length>=26){
    // Circular moving-block bootstrap preserves nearby/overlapping forecast errors.
    // Fixed seed gives stable displays, not model selection or investment certainty.
    let seed=1729;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    const length=Math.max(4,horizon),samples=[];
    for(let b=0;b<2000;b++){let sum=0,n=0;while(n<data.length){const start=Math.floor(random()*data.length);for(let j=0;j<length&&n<data.length;j++,n++)sum+=benefits[(start+j)%data.length];}samples.push(sum/data.length);}
    samples.sort((a,b)=>a-b);interval={low:samples[49],high:samples[1949],blockLength:length};
  }
  const mae=mean(data.map(error)),baselineMae=mean(data.map(r=>Math.abs(r.actualReturn)));
  return {count:data.length,mae,baselineMae,improvement:baselineMae-mae,interval,periods,verdict:!interval?"Too few observations to assess consistency":interval.low>0?"Lower error than baseline across bootstrap samples":interval.high<0?"Higher error than baseline across bootstrap samples":"No clear evidence of a consistent advantage"};
}
