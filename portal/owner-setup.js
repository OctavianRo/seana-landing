'use strict';
/** Shared setup overview; all completion flags come from authenticated server checks. */
function createOwnerSetupPanel({place, onPage, onRefresh, onLaunch, canManage=true}) {
  const el=(tag,text,cls)=>{const n=document.createElement(tag);n.textContent=text||'';if(cls)n.className=cls;return n;};
  const panel=el('section','','panel owner-setup');
  const checks=place?.checks||[
    {id:'account',label:'Owner account and email verified',done:true},
    {id:'location',label:'Add your sauna for review',done:false},
    {id:'verification',label:'Ownership verified',done:false},
    {id:'publication',label:'Sauna review approved',done:false},
    {id:'profile',label:'Address, description and contact details',done:false},
    {id:'map',label:'Map coordinates saved',done:false},
    {id:'pricing',label:'Session price, capacity and opening hours',done:false},
    {id:'schedule',label:'Regular booking timetable saved',done:false},
    {id:'policies',label:'Sauna rules and booking terms',done:false},
    {id:'payments',label:'Stripe payments and payouts enabled',done:false},
    {id:'booking_mode',label:'In-app bookings selected',done:false},
    {id:'photos',label:'Location photo added',done:false,recommended:true},
  ];
  const required=checks.filter(c=>!c.recommended),completed=required.filter(c=>c.done).length;
  const launched=place?.ready&&place?.launched;
  panel.append(el('p','YOUR PATH TO YOUR FIRST GUEST','eyebrow'),el('h2',launched?'You’re ready to welcome guests':'Let’s get your sauna ready'),el('p',launched?'Your required setup is complete. Your sauna is listed and ready for bookings.':'Complete the required steps below to launch your listing and accept customers. Your setup tools stay available while you work.','muted'));
  const progress=el('progress');progress.max=required.length||1;progress.value=completed;progress.setAttribute('aria-label','Required setup progress');panel.append(progress,el('p',`${completed} of ${required.length||1} required steps complete`,'setup-count'));
  const actions={profile:['Add details','profile'],map:['Set map pin','profile'],pricing:['Set price & capacity','profile'],schedule:['Set bookable times','profile'],policies:['Add booking terms','profile'],payments:['Set up Stripe','payments'],booking_mode:['Choose in-app bookings','setup']};
  const list=el('ol','','setup-steps');
  for(const check of checks){const row=el('li','','setup-step');const marker=el('span',check.done?'✓':'○','setup-marker');marker.setAttribute('aria-hidden','true');const copy=el('div');copy.append(el('strong',check.label),el('p',check.done?'Complete':check.recommended?'Optional':check.id==='verification'||check.id==='publication'?'Waiting for seána review':'Required','muted small'));row.append(marker,copy);
    if(!check.done){let target=actions[check.id];if(check.id==='location')target=['Add your sauna','setup'];if(check.id==='photos')target=['Add a photo','profile'];if(target){const button=el('button',target[0],'secondary');button.type='button';button.disabled=!canManage||(target[1]!=='setup'&&(!place||place.checks.some(c=>c.id==='verification'&&!c.done)));button.onclick=()=>onPage(target[1]);row.append(button);}}
    list.append(row);
  }
  if(launched){const details=el('details');details.append(el('summary','View completed setup'),list);panel.append(details);}else panel.append(list);
  if(place?.reviewFeedback)panel.append(el('p',place.reviewFeedback,'notice'));
  if(place&&!place.ready)panel.append(el('p','Approval confirms your sauna and ownership. It does not skip the remaining setup steps. Photos and memberships are optional.','muted small'));
  const feedback=el('p');feedback.setAttribute('role','status');panel.append(feedback);
  const controls=el('div','','actions'),refresh=el('button','Refresh setup status','secondary');refresh.type='button';refresh.onclick=async()=>{refresh.disabled=true;try{await onRefresh();}catch(e){feedback.textContent=e.message||'Could not refresh. Please retry.';}finally{refresh.disabled=false;}};controls.append(refresh);
  if(place?.ready&&!place.launched){const launch=el('button','Launch my sauna');launch.type='button';launch.disabled=!canManage;launch.onclick=async()=>{if(launch.disabled)return;launch.disabled=true;try{await onLaunch(place.saunaId);}catch(e){feedback.textContent=e.message||'Could not launch. Please retry.';launch.disabled=!canManage;}};controls.append(launch);}
  panel.append(controls);return panel;
}
