/* Bank details stay on Stripe. This panel uses only authenticated owner APIs. */
function createStripeConnectPanel({api,saunaId,canManage,enabled,feePercent}) {
  const el=(tag,text)=>Object.assign(document.createElement(tag),{textContent:text||''});
  const panel=el('section');panel.className='panel connect-panel';
  const heading=el('h2','Get paid through Stripe'),copy=el('p','Connect your Stripe Express account to accept bookings and receive payouts to your bank account. Stripe securely collects your business and bank details.'),status=el('p'),actions=el('div'),connect=el('button','Connect with Stripe'),refresh=el('button','Check status');
  status.setAttribute('role','status');actions.className='actions';connect.type=refresh.type='button';refresh.className='secondary';let busy=false;
  panel.append(heading,copy);if(Number.isFinite(feePercent))panel.append(el('p',`Platform fee: ${feePercent}% of each booking. Stripe processing fees also apply.`));panel.append(status,actions);actions.append(connect,refresh);
  if(!enabled){status.textContent='Payment setup will open once the platform’s Stripe configuration is ready.';connect.disabled=refresh.disabled=true;return panel;}
  async function load(){if(busy)return;busy=true;connect.disabled=refresh.disabled=true;status.textContent='Checking your Stripe account…';
    try{const response=await api('/api/business/stripe-connect/status?saunaId='+encodeURIComponent(saunaId));if(!response.ok)throw Error(response.body?.error||'Could not check Stripe.');const state=response.body;
      status.textContent=stripeConnectStatusMessage(state);
      connect.textContent=state.status==='not_connected'?'Connect with Stripe':state.status==='connected'?'Manage Stripe details':'Continue Stripe setup';
    }catch(error){status.textContent=error.message;}finally{busy=false;connect.disabled=!canManage;refresh.disabled=false;}
  }
  connect.onclick=async()=>{if(busy||!canManage)return;busy=true;connect.disabled=refresh.disabled=true;status.textContent='Opening secure Stripe setup…';
    try{const response=await api('/api/business/stripe-connect/start',{method:'POST',body:JSON.stringify({saunaId})});if(!response.ok)throw Error(response.body?.error||'Could not start Stripe setup.');const url=new URL(response.body.url);if(url.protocol!=='https:'||url.hostname!=='connect.stripe.com')throw Error('Stripe returned an unexpected setup link. Please try again.');window.location.assign(url.href);}
    catch(error){status.textContent=error.message;busy=false;connect.disabled=!canManage;refresh.disabled=false;}
  };
  refresh.onclick=()=>void load();if(!canManage)panel.append(el('p','Only the verified sauna owner can change payout details.'));
  void load();return panel;
}
function stripeConnectStatusMessage(state) {
  if(state.status==='connected')return 'Payments and bank payouts are enabled.';
  if(state.status==='not_connected')return 'Connect your account to get started.';
  if(state.requirementsDue===0 && state.requirementsPending>0)return 'Your details have been submitted. Stripe verification is in progress. Check status again once Stripe has finished reviewing them.';
  if(state.chargesEnabled)return 'Payments are enabled. Stripe still needs to enable bank payouts.';
  return 'Your Stripe setup needs attention. Continue to review the remaining steps.';
}
