(function(){
 'use strict';
 let pending;
 function openAccount(clerk){clerk.openUserProfile();}
 async function verify(clerk){
  const session=clerk.session;if(!session)throw Error('Sign in first.');
  await clerk.user.reload();
  if(!clerk.user.twoFactorEnabled){openAccount(clerk);throw Error('In Account security, add an authenticator app or second-factor phone number. Then return here and verify again.');}
  const verification=await session.startVerification({level:'second_factor'});
  if(clerk.session?.id!==session.id)throw Error('Your account changed. Please reload.');
  if(verification.status==='complete'){await session.getToken({skipCache:true});return;}
  const dialog=document.createElement('dialog');dialog.className='card';dialog.style.cssText='max-width:440px;width:90%;background:#1a1d23;color:#fff;border:1px solid #555;border-radius:12px;padding:24px';
  const heading=document.createElement('h2');heading.textContent='Verify account security';
  const form=document.createElement('form'),label=document.createElement('label'),select=document.createElement('select'),input=document.createElement('input'),status=document.createElement('p'),submit=document.createElement('button'),cancel=document.createElement('button');
  label.textContent='Verification code';input.autocomplete='one-time-code';input.required=true;input.maxLength=32;label.append(input);status.setAttribute('role','status');submit.textContent='Verify';cancel.textContent='Cancel';cancel.type='button';
  const factors=verification.supportedSecondFactors||[];
  for(const strategy of ['totp','phone_code','backup_code'])if(strategy==='backup_code'||factors.some(f=>f.strategy===strategy)){const option=document.createElement('option');option.value=strategy;option.textContent={totp:'Authenticator app',phone_code:'Text message',backup_code:'Backup code'}[strategy];select.append(option);}
  form.append(select,label,status,submit,cancel);dialog.append(heading,form);document.body.append(dialog);
  let prepared;
  async function prepare(){if(select.value==='phone_code'){const f=factors.find(f=>f.strategy==='phone_code');await session.prepareSecondFactorVerification({strategy:'phone_code',phoneNumberId:f?.phoneNumberId});status.textContent='Enter the code sent to your phone.';}}
  try{
   await new Promise((resolve,reject)=>{
    const cancelled=()=>reject(Error('Verification cancelled. No action was submitted.'));
    cancel.onclick=cancelled;dialog.oncancel=e=>{e.preventDefault();cancelled();};
    select.onchange=()=>{prepared=prepare().catch(e=>{status.textContent=e.message;throw e;});prepared.catch(()=>{});};
    form.onsubmit=async e=>{e.preventDefault();if(submit.disabled)return;submit.disabled=true;try{await prepared;if(clerk.session?.id!==session.id)throw Error('Your account changed. Please reload.');const result=await session.attemptSecondFactorVerification({strategy:select.value,code:input.value.trim()});input.value='';if(result.status!=='complete')throw Error('Verification is incomplete. Please try again.');await session.getToken({skipCache:true});if(clerk.session?.id!==session.id)throw Error('Your account changed. Please reload.');resolve();}catch(error){status.textContent=error.errors?.[0]?.longMessage||error.message||'Could not verify. Please try again.';}finally{submit.disabled=false;}};
    dialog.showModal();input.focus();prepared=prepare();prepared.catch(e=>{status.textContent=e.message;});
   });
  }finally{input.value='';dialog.remove();}
 }
 window.SeanaOwnerSecurity={openAccount,verify(clerk){if(!pending)pending=verify(clerk).finally(()=>{pending=null;});return pending;}};
})();
