export async function encodeFeedCache(text) {
  if(text.length<500000)return text;
  const bytes=new Uint8Array(await new Response(new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer());
  let binary="";for(let i=0;i<bytes.length;i+=16384)binary+=String.fromCharCode(...bytes.subarray(i,i+16384));
  return "gzip:"+btoa(binary);
}
export async function decodeFeedCache(text) {
  if(!text.startsWith("gzip:"))return text;
  const bytes=Uint8Array.from(atob(text.slice(5)),c=>c.charCodeAt(0));
  return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
}
