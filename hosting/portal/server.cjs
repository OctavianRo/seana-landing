'use strict';
const express=require('express'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ORIGIN='https://portal.seana.ie';
function policy(html=''){
 const hashes=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)].filter(m=>!(/\bsrc\s*=/i.test(m[1]))&&m[2].trim()).map(m=>"'sha256-"+crypto.createHash('sha256').update(m[2]).digest('base64')+"'");
 return ["default-src 'self'","base-uri 'none'","object-src 'none'","frame-ancestors 'none'","form-action 'self' https://accounts.seana.ie https://clerk.seana.ie",`script-src 'self' ${hashes.join(' ')} https://clerk.seana.ie https://accounts.seana.ie https://js.stripe.com https://*.js.stripe.com https://challenges.cloudflare.com https://*.protect.clerk.com`,"script-src-attr 'none'","style-src 'self' 'unsafe-inline' https://fonts.googleapis.com","font-src 'self' data: https://fonts.gstatic.com","img-src 'self' data: blob: https:","connect-src 'self' https://saunaapp-production.up.railway.app https://clerk.seana.ie https://accounts.seana.ie https://api.stripe.com https://link.com https://*.link.com https://r.stripe.com https://m.stripe.network https://clerk-telemetry.com https://*.clerk-telemetry.com https://*.protect.clerk.com:* https://img.clerk.com https://*.supabase.co","frame-src https://clerk.seana.ie https://accounts.seana.ie https://js.stripe.com https://hooks.stripe.com https://*.js.stripe.com https://link.com https://*.link.com https://connect.stripe.com https://challenges.cloudflare.com https://*.protect.clerk.com","worker-src 'self' blob:","manifest-src 'self'"].join('; ');
}
function createPortal(root){
 const app=express(),policies=new Map();app.disable('x-powered-by');
 app.use((_req,res,next)=>{res.set({'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer','Strict-Transport-Security':'max-age=31536000','Cross-Origin-Opener-Policy':'same-origin-allow-popups','Permissions-Policy':'camera=(), microphone=(), geolocation=(self), payment=(self "https://js.stripe.com")','Content-Security-Policy':policy(),'Cache-Control':'no-store'});next();});
 app.get('/healthz',(_req,res)=>{const ready=fs.existsSync(path.join(root,'portal/dashboard.html'));res.status(ready?200:503).json({ready});});
 app.get('/',(_req,res)=>res.redirect(302,'/portal/dashboard.html'));
 app.get('/robots.txt',(_req,res)=>res.type('text').send('User-agent: *\nDisallow: /\n'));
 app.get('/portal/secure-origin.js',(_req,res)=>res.type('js').send("window.SeanaPortalCanonicalOrigin="+JSON.stringify(ORIGIN)+";\n"+fs.readFileSync(path.join(root,'portal/secure-origin.js'),'utf8')));
 // Only public portal assets are copied into this image. No backend, API,
 // credential files, database drivers, session storage or payment keys exist.
 app.use('/portal',express.static(path.join(root,'portal'),{dotfiles:'deny',index:false,redirect:false,fallthrough:true,setHeaders(res,file){if(path.extname(file)==='.html'){if(!policies.has(file))policies.set(file,policy(fs.readFileSync(file,'utf8')));res.setHeader('Content-Security-Policy',policies.get(file));res.setHeader('Cache-Control','no-store');}else res.setHeader('Cache-Control','public, max-age=300');}}));
 for(const name of ['privacy','cookies'])app.get(['/'+name,'/'+name+'/'],(_req,res)=>res.redirect(302,'https://www.seana.ie/'+name+'/'));
 app.use((_req,res)=>res.status(404).type('text').send('Not found'));
 app.use((_error,_req,res,_next)=>res.status(500).type('text').send('Portal temporarily unavailable'));
 return app;
}
if(require.main===module){const port=Number(process.env.PORT||8080);if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid portal port');createPortal(process.env.PORTAL_STATIC_ROOT||'/srv').listen(port,'0.0.0.0');}
module.exports={createPortal,policy};
