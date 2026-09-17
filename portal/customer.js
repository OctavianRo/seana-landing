(() => {
 'use strict';
 const $=id=>document.getElementById(id),local=['localhost','127.0.0.1'].includes(location.hostname);
 if(window.SeanaPortalRedirecting)return;
 if(!local&&location.protocol!=='https:'){location.replace('https://'+location.host+location.pathname);return;}
 const API=local?'':'https://saunaapp-production.up.railway.app';
 let clerk,security,sessionKey=null,view='upcoming',generation=0,offset=null,busy=false;
 const el=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;};
 const money=n=>new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR'}).format(Number(n)/100);
 const date=v=>v?new Date(String(v).slice(0,10)+'T12:00:00Z').toLocaleDateString('en-IE',{day:'numeric',month:'short',year:'numeric'}):'Not available';
 function clear(){generation++;$('cards').replaceChildren();$('name').textContent='';$('workspace').hidden=true;$('more').hidden=true;offset=null;busy=false;}
 async function api(path,method='GET',payload={}){
  const current=sessionKey,token=await clerk.session?.getToken();if(!token||current!==sessionKey)throw Error('Please sign in again.');
  const response=await fetch(API+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(15000),...(method!=='GET'?{body:JSON.stringify(payload)}:{})});
  if(current!==sessionKey)throw Error('Your account changed. Please refresh.');
  if(response.status===401||response.status===403){clear();$('workspace').hidden=false;throw Error('Sign in with a verified account to view your information. Use Sign out to change accounts.');}
  const body=await response.json();if(!response.ok)throw Object.assign(Error(body.error||'This could not be completed. Please try again.'),{status:response.status});return body;
 }
 function action(card,label,work){const button=el('button',label);button.className='secondary';button.onclick=async()=>{if(button.disabled)return;button.disabled=true;const current=sessionKey;try{await work();}catch(error){if(current===sessionKey)$('status').textContent=error.message;}finally{button.disabled=false;}};card.append(button);}
 function safeLink(value,kind){const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||!(kind==='billing'?url.hostname==='billing.stripe.com':url.origin==='https://saunaapp-production.up.railway.app'&&url.pathname.startsWith('/join/')))throw Error('This secure link is unavailable.');if(kind!=='billing'){for(const key of [...url.searchParams.keys()])if(!['date','slotId','sessionTypeId'].includes(key))url.searchParams.delete(key);url.hash='';}return url.href;}
 function render(item){const card=el('article');card.className='card';
  if(view==='memberships'){
   card.append(el('span',String(item.status).replace(/_/g,' ')),el('h3',item.name),el('p',item.sauna_name),el('strong',money(item.amount_cents)+' / '+item.interval),el('p',item.benefits));
   if(item.sessions_per_period)card.append(el('p',`${item.used_sessions} of ${item.sessions_per_period} included sessions used this period`));
   card.append(el('p',item.cancel_at_period_end?'Renewal cancelled · ends '+date(item.period_end):'Current period ends '+date(item.period_end)));
   action(card,'Manage billing',async()=>{const result=await api('/api/customer/memberships/'+encodeURIComponent(item.id)+'/billing','POST');location.assign(safeLink(result.url,'billing'));});
   if(!item.cancel_at_period_end&&!['canceled','expired','incomplete_expired'].includes(item.status))action(card,'Cancel renewal',async()=>{if(!confirm('Cancel this membership’s renewal? Paid access remains until the end of the billing period.'))return;await api('/api/customer/memberships/'+encodeURIComponent(item.id)+'/cancel','POST');await load();});
  }else if(view==='following'){
   card.append(el('span',item.alerts?'Event alerts on':'Following'),el('h3',item.name),el('p',item.county||'Ireland'));
   const open=el('a','Open sauna in app');open.className='button';open.href='saunafinder://detail/'+encodeURIComponent(item.saunaId);card.append(open);
   action(card,'Unfollow',async()=>{if(!confirm('Stop following this sauna?'))return;await api('/api/customer/event-follows/'+encodeURIComponent(item.saunaId),'DELETE');await load();});
  }else{
   card.append(el('span',item.status),el('h3',item.saunaName),el('p',date(item.date)+' · '+(item.startTime||'')+'–'+(item.endTime||'')+' · Ireland time'),el('p',item.county||''),el('strong',item.reward?'Included session':money(item.price)));
   if(item.canShare&&item.inviteUrl)action(card,'Invite a friend',async()=>{const url=safeLink(item.inviteUrl,'invite'),text=`Join me at ${item.saunaName} on ${date(item.date)} at ${item.startTime}. Book your own place in seána.`;if(navigator.share)await navigator.share({title:item.saunaName,text,url});else{await navigator.clipboard.writeText(text+' '+url);$('status').textContent='Invitation copied. Send it on WhatsApp or Messages.';}await api('/api/customer/sessions/'+encodeURIComponent(item.id)+'/share','POST');});
  }
  card.querySelector('span').className='badge';return card;
 }
 function saunaCard(sauna){
  const card=el('article');card.className='sauna-card';
  const photo=el('div');photo.className='sauna-photo';const fallback=el('span','Photo coming soon');photo.append(fallback);
  const img=el('img');img.alt=sauna.name||'Sauna';img.loading='lazy';img.decoding='async';img.referrerPolicy='no-referrer';img.onload=()=>{fallback.hidden=true;};img.onerror=()=>{img.remove();fallback.hidden=false;};img.src=API+'/api/photo/'+encodeURIComponent(sauna.id);photo.append(img);
  const body=el('div');body.className='sauna-card-body';body.append(el('h3',sauna.name||'Sauna'),el('p',[sauna.location,sauna.county].filter(Boolean).join(' · ')));
  if(Number(sauna.session_price)>0)body.append(el('p','Sessions from '+money(Number(sauna.session_price)*100)));
  card.append(photo,body);return card;
 }
 async function load(more=false){if(!clerk?.session||busy)return;busy=true;const version=++generation;const currentView=view;if(!more){$('cards').replaceChildren();}$('status').textContent='Loading…';$('more').hidden=true;$('refresh').disabled=true;
  try{const page=more?offset:0,path=currentView==='explore'?'/api/directory?limit=24&offset='+page:currentView==='memberships'?'/api/customer/memberships':currentView==='following'?'/api/customer/following?offset='+page:'/api/customer/sessions?view='+currentView+'&offset='+page;let data;try{data=await api(path);}catch(error){if(currentView!=='following'||error.status!==404)throw error;const legacy=await api('/api/customer/event-follows');const follows=legacy.follows||[];const selected=follows.slice(page,page+20);data={follows:await Promise.all(selected.map(async item=>{try{const sauna=await api('/api/sauna/'+encodeURIComponent(item.saunaId));return {...item,name:sauna.name,county:sauna.county};}catch{return {...item,name:'Sauna currently unavailable',county:''};}})),nextOffset:page+20<follows.length?page+20:null};}if(version!==generation)return;if(currentView==='explore'){const saunas=data.saunas||[];for(const sauna of saunas)$('cards').append(saunaCard(sauna));if(!more&&!saunas.length){const empty=el('div');empty.className='empty';empty.append(el('h3','A little space for something good'),el('p','Approved saunas will appear here as they join seána.'));$('cards').append(empty);}offset=data.nextOffset??null;$('more').hidden=offset===null;$('status').textContent='Approved saunas on seána';return;}const items=data.memberships||data.follows||data.sessions||[];for(const item of items)$('cards').append(render(item));if(!more&&!items.length){const empty=el('div');empty.className='empty';empty.append(el('h3',currentView==='following'?'Find your favourites':currentView==='memberships'?'Your next ritual awaits':'Room for a new ritual'),el('p',currentView==='past'?'Your completed and cancelled bookings will appear here.':'Discover saunas and book your next session in the seána app.'));$('cards').append(empty);}offset=data.nextOffset??null;$('more').hidden=offset===null;$('status').textContent=data.stale?'Some billing information could not be refreshed. Try again shortly.':'Up to date · '+new Date().toLocaleTimeString('en-IE',{hour:'2-digit',minute:'2-digit'});
  }catch(error){if(version===generation)$('status').textContent=error.message;}finally{if(version===generation){busy=false;$('refresh').disabled=false;}}
 }
 async function changed({session}){security?.refresh();const key=session?.status==='active'?session.id:null;if(key===sessionKey&&key!==null)return;clear();sessionKey=key;$('signin').hidden=!!key;if(!key){$('status').textContent='';const signup=new URLSearchParams(location.search).get('auth')==='signup';const options={forceRedirectUrl:location.origin+location.pathname,signInUrl:location.origin+location.pathname+'?auth=signin',signUpUrl:location.origin+location.pathname+'?auth=signup'};if(signup)clerk.mountSignUp($('clerk-signin'),options);else clerk.mountSignIn($('clerk-signin'),{...options,withSignUp:false,transferable:false});return;}clerk.unmountSignIn?.($('clerk-signin'));clerk.unmountSignUp?.($('clerk-signin'));$('workspace').hidden=false;$('name').textContent=clerk.user?.firstName?', '+clerk.user.firstName:'';try{await api('/api/accounts/register','POST',{accountType:'customer',source:'website'});await load();}catch(error){$('status').textContent=error.message;}}
 for(const button of document.querySelectorAll('[data-view]'))button.onclick=()=>{view=button.dataset.view;generation++;busy=false;for(const b of document.querySelectorAll('[data-view]'))b.setAttribute('aria-current',b===button?'page':'false');$('title').textContent=button.textContent;void load();};
 $('refresh').onclick=()=>void load();$('more').onclick=()=>void load(true);$('security').onclick=()=>clerk.openUserProfile();$('signout').onclick=async()=>{clear();sessionKey=null;try{await clerk.signOut({redirectUrl:location.origin+location.pathname});}catch{$('workspace').hidden=false;$('status').textContent='Could not sign out. Please retry.';}};
 async function boot(){$('retry').hidden=true;try{const response=await fetch(API+'/api/public-config',{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('Sign-in is temporarily unavailable.');const config=await response.json();clerk=await window.SeanaAuth.load(config.clerkPublishableKey);security=window.SeanaCustomerSecurity?.init(clerk);clerk.addListener(changed);await changed({session:clerk.session});document.querySelector('[data-view=upcoming]').setAttribute('aria-current','page');}catch(error){$('status').textContent=error.message;$('retry').hidden=false;}}
 $('retry').onclick=boot;void boot();
})();
