import {readFile,writeFile,readdir,unlink} from "node:fs/promises";
const rows=[];
for(const f of await readdir("feed"))if(/^status-\d+\.json$/.test(f)){rows.push(...JSON.parse(await readFile("feed/"+f,"utf8")));await unlink("feed/"+f);}
const directory=JSON.parse(await readFile("feed-directory.json","utf8"));
for(const r of rows){try{const model=JSON.parse(await readFile(`feed/models/${r.symbol}-1.json`,"utf8"));r.pythonMae=model.mae;r.pythonBaselineMae=model.baselineMae;r.pythonAsOf=model.asOf;r.pythonTarget=model.targetWeekEnding;}catch{}}
const available=rows.filter(r=>r.price!==null).length;
if(available<30)throw Error("No usable market update; refuse to replace the published feed");
await writeFile("feed/directory.json",JSON.stringify(directory));
await writeFile("feed/index.json",JSON.stringify({generatedAt:new Date().toISOString(),source:"Yahoo Finance",directoryAsOf:directory.fetchedAt,total:directory.rows.length,available,rows:rows.filter(r=>r.symbol!=="SPY").sort((a,b)=>a.symbol.localeCompare(b.symbol))}));
await writeFile("feed/README.md",`# Public market research data\n\nUpdated ${new Date().toISOString()}. ${available} price histories available. Each file retains its own observation and retrieval dates; an update does not guarantee fresh data for every listing. Prices: Yahoo Finance. Directory: Nasdaq Trader. No user data or API keys. Experimental Python models; forecasts are not guaranteed.\n`);
console.log(`Published feed prepared: ${available} histories out of ${directory.rows.length} listings.`);
