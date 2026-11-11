import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {serializeSignedCookie} from 'better-call';
import path from 'node:path';

// Isolated synthetic sessions; this script never connects to a hosted database.
const base='http://127.0.0.1:8791';
const directory='.stock/auth-test';
const secret='stock-standalone-test-secret-not-a-real-credential-00000000';
mkdirSync(directory,{recursive:true});
const config=JSON.parse(readFileSync('.stock/wrangler.json','utf8'));
assert.equal(config.vars.STOCK_AUTH_MODE,'standalone','build the standalone target first');
config.main='../../dist/server/index.js';
config.assets.directory='../../dist/client';
config.vars={STOCK_AUTH_MODE:'standalone',BETTER_AUTH_URL:base,BETTER_AUTH_SECRET:secret,GOOGLE_CLIENT_ID:'local-fixture.apps.googleusercontent.com',GOOGLE_CLIENT_SECRET:'local-fixture-not-real'};
config.d1_databases=config.d1_databases.map(d=>({...d,migrations_dir:'../../drizzle'}));
writeFileSync(`${directory}/wrangler.json`,JSON.stringify(config));
const wrangler=path.resolve('node_modules/wrangler/bin/wrangler.js');
const args=['--import','./scripts/sites-env.mjs',wrangler];
function run(extra){const p=spawnSync(process.execPath,[...args,...extra],{encoding:'utf8',windowsHide:true});if(p.status!==0)throw new Error(p.stderr||p.stdout||'Local database command failed');}
run(['d1','migrations','apply','DB','--local','--config',`${directory}/wrangler.json`,'--persist-to',`${directory}/state`]);
const now=Date.now(),future=now+3600000,past=now-60000;
const sql=`DELETE FROM auth_sessions; DELETE FROM auth_accounts; DELETE FROM auth_users; DELETE FROM auth_verifications; DELETE FROM auth_rate_limits; DELETE FROM preferences;
INSERT INTO auth_users(id,name,email,email_verified,created_at,updated_at) VALUES ('test-a','User A','a@example.invalid',1,${now},${now}),('test-b','User B','b@example.invalid',1,${now},${now});
INSERT INTO auth_sessions(id,token,expires_at,created_at,updated_at,user_id) VALUES ('session-a','token-a',${future},${now},${now},'test-a'),('session-b','token-b',${future},${now},${now},'test-b'),('session-expired','token-expired',${past},${now},${now},'test-a');
INSERT INTO preferences(user_id,watchlist,daily_limit,updated_at) VALUES ('test-a','["IBM"]',25,'2026-11-10'),('test-b','["MSFT"]',25,'2026-11-10');`;
writeFileSync(`${directory}/seed.sql`,sql);
run(['d1','execute','DB','--local','--config',`${directory}/wrangler.json`,'--persist-to',`${directory}/state`,'--file',`${directory}/seed.sql`]);
const child=spawn(process.execPath,[...args,'dev','--config',`${directory}/wrangler.json`,'--local','--persist-to',`${directory}/state`,'--ip','127.0.0.1','--port','8791','--inspector-port','0'],{windowsHide:true,stdio:['ignore','pipe','pipe']});
let logs='';child.stdout.on('data',b=>{logs+=b});child.stderr.on('data',b=>{logs+=b});
let checks=0;
function eq(a,b,label){checks++;assert.deepEqual(a,b,label);}
async function cookie(token){return (await serializeSignedCookie('better-auth.session_token',token,secret,{path:'/'})).split(';')[0];}
async function call(route,{token,body,extra={}}={}){const r=await fetch(base+route,{method:body?'POST':'GET',redirect:'manual',headers:{Origin:base,Connection:'close','Content-Type':'application/json',...(token?{Cookie:await cookie(token)}:{}),...extra},...(body?{body:JSON.stringify(body)}:{})});const raw=await r.text();let data;try{data=JSON.parse(raw);}catch{data=raw;}return {r,data};}
try{
  let ready=false;for(let i=0;i<80;i++){try{if((await fetch(base+'/api/auth/get-session')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}
  if(!ready)throw new Error('Local Worker did not start: '+logs.slice(-3000));
  const auth=await call('/api/auth/config');eq(auth.data,{mode:'standalone',providers:['google']},'only public auth configuration');
  for(const route of ['/api/workspace','/api/portfolio','/api/settings','/api/forecasts','/api/paper'])eq((await call(route)).r.status,401,'anonymous rejected: '+route);
  const spoof={'oai-authenticated-user-id':'test-a','oai-authenticated-user-email':'a@example.invalid'};
  eq((await call('/api/workspace',{extra:spoof})).r.status,401,'Sites header spoof rejected');
  eq((await call('/api/workspace',{token:'forged'})).r.status,401,'forged session rejected');
  eq((await call('/api/workspace',{token:'token-expired'})).r.status,401,'expired session rejected');
  eq((await call('/api/workspace',{token:'token-a'})).data.watchlist,['IBM'],'signed session accepted');
  eq((await call('/api/workspace',{token:'token-b',extra:spoof})).data.watchlist,['MSFT'],'session B cannot be replaced by header A');
  eq((await call('/api/workspace',{token:'token-a'})).r.headers.get('cache-control'),'no-store','private data is not cacheable');
  const rejected=await call('/api/auth/sign-in/social',{body:{provider:'google',callbackURL:'/'},extra:{Origin:'https://attacker.invalid'}});eq(rejected.r.status,403,'cross-origin sign-in rejected: '+JSON.stringify(rejected.data));
  eq((await call('/api/auth/sign-in/social',{body:{provider:'google',callbackURL:'https://attacker.invalid/'}})).r.status,403,'external callback rejected');
  const start=await call('/api/auth/sign-in/social',{body:{provider:'google',callbackURL:'/'}});eq(start.r.status,200,'Google sign-in starts');
  const url=new URL(start.data.url);eq(url.origin,'https://accounts.google.com','Google authorization origin');eq(url.searchParams.get('redirect_uri'),base+'/api/auth/callback/google','exact callback');assert.ok(url.searchParams.get('state'),'OAuth state');checks++;assert.ok(url.searchParams.get('code_challenge'),'PKCE');checks++;
  eq((await call('/api/auth/get-session',{token:'token-a'})).data.user.id,'test-a','session endpoint agrees');
  eq((await call('/api/auth/sign-out',{token:'token-a',body:{}})).r.status,200,'sign-out accepted');
  eq((await call('/api/workspace',{token:'token-a'})).r.status,401,'revoked session rejected');
  const guest=await call('/api/auth/sign-in/anonymous',{body:{}});eq(guest.r.status,200,'guest starts without Google');
  eq(guest.data.user.isAnonymous,true,'guest identity is explicit');
  const guestCookie=guest.r.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');
  assert.ok(guestCookie.includes('session_token'),'guest receives a session cookie');checks++;
  assert.ok(guest.r.headers.getSetCookie().some(x=>/HttpOnly/i.test(x)),'session cookie is HttpOnly');checks++;
  const guestWorkspace=await call('/api/workspace',{extra:{Cookie:guestCookie}});eq(guestWorkspace.r.status,200,'guest private APIs work');eq(guestWorkspace.data.watchlist,null,'guest never inherits other accounts');
  const guestAgain=await call('/api/auth/sign-in/anonymous',{body:{},extra:{Cookie:guestCookie}});eq(guestAgain.r.status,400,'existing guest cannot mint another guest');
  // Last: Miniflare's proxy can corrupt its next request after an unread rejected body.
  eq((await call('/api/portfolio',{token:'token-b',body:{action:'remove',id:'unknown'},extra:{Origin:'https://attacker.invalid'}})).r.status,403,'cross-origin mutations rejected');
  console.log(`PASS: ${checks} standalone authentication and account-isolation checks.`);
}catch(error){console.error(logs.slice(-5000));throw error;}finally{
  if(process.platform==='win32')spawnSync('taskkill',['/PID',String(child.pid),'/T','/F'],{stdio:'ignore',windowsHide:true});else child.kill('SIGTERM');
}
