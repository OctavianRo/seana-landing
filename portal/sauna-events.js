(function(global){
 'use strict';
 const text=(el,value)=>{el.textContent=value;return el;};
 const node=(tag,value,className)=>{const el=document.createElement(tag);if(value)text(el,value);if(className)el.className=className;return el;};
 const localDate=value=>{const date=new Date(value);return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}T${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;};
 global.createSaunaEventsPanel=function({api,saunaId,canWrite}){
  const panel=node('section',null,'panel events-panel');panel.style.marginTop='16px';
  const heading=node('h2','Host a sauna social'),intro=node('p','Bring your community together. Publish a gathering, update the details, or let everyone know if plans change.','muted');
  const feedback=node('p');feedback.setAttribute('role','status');
  const list=node('div'),editor=node('div');let items=[],busy=false,current=null,requestId=crypto.randomUUID();
  const path='/api/business/'+encodeURIComponent(saunaId)+'/events';
  const reload=node('button','Reload events','secondary');reload.type='button';reload.onclick=()=>void load();
  panel.append(heading,intro,feedback,reload,list,editor);
  async function load(){text(feedback,'Loading events…');try{const r=await api(path);if(!r.ok)throw Error(r.body?.error||'Could not load events.');items=r.body.events;renderList();text(feedback,'');}catch(e){text(feedback,e.message);}}
  function renderList(){list.replaceChildren();if(!items.length)list.append(node('p','Your first gathering starts here.','empty'));
   for(const event of items){const row=node('article',null,'event-row');row.append(node('strong',event.title),node('p',`${event.status.toUpperCase()} · ${new Date(event.startsAt).toLocaleString()} · ${event.location}`,'muted'));
    if(canWrite&&event.status!=='cancelled'){
     const edit=node('button',event.status==='draft'?'Edit draft':'Edit event','secondary');edit.type='button';edit.disabled=busy;edit.onclick=()=>showEditor(event);
     const cancel=node('button',event.status==='draft'?'Discard draft':'Cancel event','secondary');cancel.type='button';cancel.disabled=busy;
     cancel.onclick=async()=>{if(busy||!confirm(event.status==='draft'?'Discard this private draft?':'Cancel this event? Followers with alerts enabled will be notified.'))return;await mutate(path+'/'+encodeURIComponent(event.id)+'/cancel',{revision:event.revision},'POST');};row.append(edit,cancel);
    }list.append(row);
   }
   if(canWrite){const create=node('button','Create an event');create.type='button';create.disabled=busy;create.onclick=()=>showEditor(null);list.append(create);}
  }
  async function mutate(url,body,method){busy=true;for(const button of panel.querySelectorAll('button'))button.disabled=true;text(feedback,'Saving…');
   try{const r=await api(url,{method,body:JSON.stringify(body)});if(!r.ok)throw Error(r.body?.error||'Could not save event.');editor.replaceChildren();current=null;requestId=crypto.randomUUID();await load();text(feedback,r.body.event?.status==='draft'?'Draft saved. Only your team can see it.':'Saved. Event updates are visible in the app; opted-in follower alerts are queued.');}
   catch(e){text(feedback,e.message);}finally{busy=false;for(const button of panel.querySelectorAll('button'))button.disabled=false;}
  }
  function showEditor(event){if(busy)return;current=event;requestId=crypto.randomUUID();editor.replaceChildren();
   const form=node('form',null,'form-grid');form.append(node('h3',event?'Edit event':'Plan something together'));
   form.append(node('p',`Enter dates in your device timezone (${Intl.DateTimeFormat().resolvedOptions().timeZone}). The app displays Ireland time.`,'muted small'));
   const values={title:event?.title,description:event?.description,location:event?.location,starts_at:event?localDate(event.startsAt):'',ends_at:event?localDate(event.endsAt):'',price_text:event?.priceText,booking_url:event?.bookingUrl};
   for(const [key,label,type,max] of [['title','Event name','text',120],['description','What to expect','textarea',4000],['starts_at','Starts','datetime-local'],['ends_at','Ends','datetime-local'],['location','Meeting place / address','text',300],['price_text','Price details (e.g. Free, or €25 per person)','text',100],['booking_url','Host booking link (optional, HTTPS)','url',2000]]){
    const wrapper=node('label',label),input=node(type==='textarea'?'textarea':'input');if(type!=='textarea')input.type=type;else input.rows=5;
    input.name=key;input.value=values[key]||'';input.required=!['price_text','booking_url'].includes(key);if(max)input.maxLength=max;wrapper.append(input);form.append(wrapper);
   }
   form.append(node('p','Publishing or saving changes to a live event notifies followers who chose event alerts. Following does not reserve a place.','muted small'));
   const actions=node('div',null,'actions');
   if(!event||event.status==='draft'){const draft=node('button','Save private draft','secondary');draft.type='submit';draft.value='draft';actions.append(draft);}
   const publish=node('button',event?.status==='published'?'Save & notify followers':'Publish & notify followers');publish.type='submit';publish.value='published';actions.append(publish);
   const close=node('button','Close editor','secondary');close.type='button';close.onclick=()=>editor.replaceChildren();actions.append(close);form.append(actions);
   form.onsubmit=e=>{e.preventDefault();if(busy)return;try{
     const input=Object.fromEntries(new FormData(form));for(const key of ['starts_at','ends_at']){if(localDate(input[key])!==input[key])throw Error('Choose a valid local time; that time may not exist during a daylight-saving change.');input[key]=new Date(input[key]).toISOString();}
     input.status=e.submitter?.value||event?.status||'draft';input.requestId=requestId;if(event)input.revision=event.revision;
     if(input.status==='published'&&!confirm('Publish these details and notify followers who opted into event alerts?'))return;
     void mutate(path+(event?'/'+encodeURIComponent(event.id):''),input,event?'PUT':'POST');
   }catch(error){text(feedback,error.message);}};
   editor.append(form);
  }
  void load();return panel;
 };
})(window);
