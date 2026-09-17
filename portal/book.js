(async()=>{'use strict';if(window.SeanaPortalRedirecting)return;
 const query=new URLSearchParams(location.search),root=document.getElementById('session');
 const id=query.get('saunaId'),date=query.get('date'),slotId=query.get('slotId'),sessionTypeId=query.get('sessionTypeId');
 if(!id||!/^[-a-zA-Z0-9_]{1,160}$/.test(id)||!/^\d{4}-\d{2}-\d{2}$/.test(date||'')||!/^[-a-zA-Z0-9_:]{1,160}$/.test(slotId||'')||(sessionTypeId&&!/^[-a-zA-Z0-9_]{1,100}$/.test(sessionTypeId))){document.getElementById('message').textContent='This session link is invalid. Return to Find a sauna and choose a session.';return;}
 Object.assign(root.dataset,{saunaId:id,date,slotId,sessionTypeId:sessionTypeId||''});
 const API=['localhost','127.0.0.1'].includes(location.hostname)?'':'https://saunaapp-production.up.railway.app';
 try{const r=await fetch(API+'/api/sauna/'+encodeURIComponent(id),{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('This sauna is not available for booking.');const sauna=await r.json();
 document.getElementById('venue-name').textContent=sauna.name;document.getElementById('venue-location').textContent=(sauna.location||sauna.county||'')+' · '+date;
 document.getElementById('venue-rules').textContent=sauna.sauna_rules||'Contact the sauna for arrival instructions and what to bring.';document.getElementById('venue-terms').textContent=sauna.terms_conditions||'Contact the sauna to confirm its cancellation policy before booking.';
 const script=document.createElement('script');script.src='/portal/session-checkout.js';document.head.append(script);
 }catch(error){document.getElementById('message').textContent=error.message;}
})();
