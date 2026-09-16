'use strict';
/** Shared setup overview; all completion flags come from authenticated server checks. */
function createOwnerSetupPanel({place, onPage, onRefresh, onLaunch, canManage=true, application=null}) {
  const el=(tag,text,cls)=>{const n=document.createElement(tag);n.textContent=text||'';if(cls)n.className=cls;return n;};
  const panel=el('section','','panel owner-setup');
  const checks=place?.checks||[
    {id:'account',label:'Owner account and email verified',done:true},
    {id:'location',label:'Add your sauna for review',done:Boolean(application)},
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
  const reviewStatus=place?.reviewStatus||application?.status||'';
  const rejected=reviewStatus==='rejected';
  const awaiting=place ? checks.some(c=>['verification','publication'].includes(c.id)&&!c.done) : Boolean(application);
  const state=launched?'live':rejected?'changes':place?.ready?'ready':awaiting?'review':place?'setup':'draft';
  const messages={
    live:['Live on seána','Your sauna is published. Guests can discover your listing and book available sessions.'],
    changes:['Your application needs attention','Read the review feedback below. Contact seána if you need help correcting your submission.'],
    ready:['Approved and ready to launch','Your required checks are complete. Select Launch my sauna to make your listing available to guests.'],
    review:['Application under review','Your submission is saved. We’re checking your sauna and ownership. Your listing stays private until approval and setup are complete.'],
    setup:['Approved — finish your setup','Your sauna review is complete. Finish the remaining steps below before accepting customers.'],
    draft:['Let’s introduce your sauna','Find your existing listing or add a new sauna. We’ll review it before it appears in the app.']
  };
  const banner=el('div','','application-summary');banner.setAttribute('role','status');
  const badge=el('span',{live:'Live',changes:'Action needed',ready:'Ready to launch',review:'Under review',setup:'Setup in progress',draft:'Not submitted'}[state],'application-badge application-'+state);
  banner.append(el('p','YOUR SAUNA APPLICATION','eyebrow'),badge,el('h2',messages[state][0]),el('p',messages[state][1],'application-description'));
  panel.append(banner);
  const stages=el('ol','','application-stages');
  const current=state==='draft'?0:state==='review'||state==='changes'?1:state==='live'?3:2;
  ['Submit your sauna','seána review','Complete setup','Go live'].forEach((text,index)=>{const stage=el('li','','application-stage'+(index<current?' is-complete':index===current?' is-current':''));if(index===current)stage.setAttribute('aria-current','step');stage.append(el('span',index<current?'✓':String(index+1),'stage-number'),el('span',text));stages.append(stage);});
  panel.append(stages);
  if(state==='review')panel.append(el('p','Next: wait for the review decision. Use Refresh setup status to check for an update; you do not need to submit again.','application-next'));
  else if(state==='changes')panel.append(el('p','Next: review the feedback and contact hello@seana.ie to resolve it.','application-next'));
  const progress=el('progress');progress.max=required.length||1;progress.value=completed;progress.setAttribute('aria-label','Required setup progress');panel.append(progress,el('p',`${completed} of ${required.length||1} required steps complete`,'setup-count'));
  const actions={profile:['Add details','profile'],map:['Set map pin','profile'],pricing:['Set price & capacity','profile'],schedule:['Set bookable times','profile'],policies:['Add booking terms','profile'],payments:['Set up Stripe','payments'],booking_mode:['Choose in-app bookings','setup']};
  const list=el('ol','','setup-steps');
  for(const check of checks){const row=el('li','','setup-step');const marker=el('span',check.done?'✓':'○','setup-marker');marker.setAttribute('aria-hidden','true');const copy=el('div');copy.append(el('strong',check.label),el('p',check.done?'Complete':check.recommended?'Optional':check.id==='verification'||check.id==='publication'?(rejected?'Review needs attention':awaiting?'Waiting for seána review':'Submit your sauna first'):'Required','muted small'));row.append(marker,copy);
    if(!check.done){let target=actions[check.id];if(check.id==='location')target=['Add your sauna','setup'];if(check.id==='photos')target=['Add a photo','profile'];if(target){const button=el('button',target[0],'secondary');button.type='button';button.disabled=!canManage||(target[1]!=='setup'&&(!place||place.checks.some(c=>c.id==='verification'&&!c.done)));button.onclick=()=>onPage(target[1]);row.append(button);}}
    list.append(row);
  }
  if(launched){const details=el('details');details.append(el('summary','View completed setup'),list);panel.append(details);}else panel.append(list);
  const reviewFeedback=place?.reviewFeedback||application?.rejection_reason;
  if(reviewFeedback){const feedbackCard=el('div','','application-feedback');feedbackCard.append(el('h3','Feedback from seána'),el('p',reviewFeedback));panel.append(feedbackCard);}
  if(place&&!place.ready)panel.append(el('p','Approval confirms your sauna and ownership. It does not skip the remaining setup steps. Photos and memberships are optional.','muted small'));
  const feedback=el('p');feedback.setAttribute('role','status');panel.append(feedback);
  const controls=el('div','','actions'),refresh=el('button','Refresh setup status','secondary');refresh.type='button';refresh.onclick=async()=>{refresh.disabled=true;try{await onRefresh();}catch(e){feedback.textContent=e.message||'Could not refresh. Please retry.';}finally{refresh.disabled=false;}};controls.append(refresh);
  if(place?.ready&&!place.launched){const launch=el('button','Launch my sauna');launch.type='button';launch.disabled=!canManage;launch.onclick=async()=>{if(launch.disabled)return;launch.disabled=true;try{await onLaunch(place.saunaId);}catch(e){feedback.textContent=e.message||'Could not launch. Please retry.';launch.disabled=!canManage;}};controls.append(launch);}
  panel.append(controls,el('p','Status checked '+new Date().toLocaleTimeString('en-IE',{hour:'2-digit',minute:'2-digit'})+' · Refresh to check for changes.','application-updated'));return panel;
}
