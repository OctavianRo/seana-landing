(()=>{'use strict';if(window.SeanaPortalRedirecting)return;
 const $=id=>document.getElementById(id),local=['localhost','127.0.0.1'].includes(location.hostname),API=local?'':'https://saunaapp-production.up.railway.app';
 const el=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
 let offset=null,venue=null,version=0,searchVersion=0;
 async function get(path){const r=await fetch(API+path,{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('These details are temporarily unavailable. Please try again.');return r.json();}
 async function browse(more=false){const current=++searchVersion;$('browse-status').textContent='Finding your next sauna…';$('browse-more').hidden=true;
  try{const data=await get('/api/directory?'+new URLSearchParams({q:$('query').value,offset:more?offset:0}));if(current!==searchVersion)return;if(!more)$('venues').replaceChildren();
   for(const s of data.saunas){const card=el('article','');card.className='card';const img=document.createElement('img');img.src=API+'/api/photo/'+encodeURIComponent(s.id);img.alt=s.name;img.loading='lazy';img.style.cssText='width:100%;height:200px;object-fit:cover;border-radius:16px';img.onerror=()=>img.remove();const b=el('button','Choose a session');b.onclick=()=>{venue=s;version++;$('slots').replaceChildren();$('slot-status').textContent='';$('venue-title').textContent=s.name;$('venue-description').textContent=s.location||s.county||'';$('sessions').hidden=false;$('sessions').scrollIntoView({behavior:'smooth'});};card.append(img,el('h2',s.name),el('p',s.county||''),b);$('venues').append(card);}
   offset=data.nextOffset;$('browse-more').hidden=offset===null;$('browse-status').textContent=data.total?`${data.total} saunas to explore`:'Our approved saunas will appear here when they are ready for bookings.';
  }catch(e){if(current===searchVersion)$('browse-status').textContent=e.message;}
 }
 $('search').onsubmit=e=>{e.preventDefault();void browse();};$('browse-more').onclick=()=>void browse(true);
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Dublin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());$('session-date').min=today;$('session-date').value=today;
 $('session-date').onchange=()=>{version++;$('slots').replaceChildren();$('slot-status').textContent='Choose Show available sessions for this date.';};
 $('show-slots').onclick=async()=>{if(!venue)return;const current=++version,id=venue.id,date=$('session-date').value;$('slots').replaceChildren();$('slot-status').textContent='Checking live availability…';try{
 const data=await get('/api/sauna/'+encodeURIComponent(id)+'/slots?date='+encodeURIComponent(date));if(current!==version)return;
 const slots=[...(data.slots||[]),...(data.sessionSlots||[])].filter(s=>s.available);
 for(const s of slots){const a=el('a',`${s.name||s.sessionTypeName||'Sauna session'} · ${s.startTime}–${s.endTime} · €${(Number(s.price)/100).toFixed(2)}`);a.className='button';a.href='/portal/book.html?'+new URLSearchParams({saunaId:id,date,slotId:s.id,...(s.sessionTypeId?{sessionTypeId:s.sessionTypeId}:{})});$('slots').append(a);}
 $('slot-status').textContent=slots.length?'Times are in Ireland time. One place per booking. Availability is checked again before payment.':'No sessions available on this date. Try another date.';
 }catch(e){if(current===version)$('slot-status').textContent=e.message;}};
 void browse();
})();
