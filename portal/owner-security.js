(function(){
 'use strict';
 let pending;
 function openAccount(clerk){clerk.openUserProfile();}
 function addStyles(){
  if(document.getElementById('seana-security-styles'))return;
  const style=document.createElement('style');style.id='seana-security-styles';style.textContent=`
  dialog.seana-security{position:fixed;inset:0;margin:auto;width:calc(100% - 32px);max-width:440px;max-height:calc(100dvh - 32px);overflow:auto;box-sizing:border-box;padding:28px;border:1px solid #555b65;border-radius:20px;background:#1a1d23;color:#fff;text-align:left;font:15px/1.5 system-ui;box-shadow:0 24px 80px #0009;color-scheme:dark}
  dialog.seana-security::backdrop{background:rgba(0,0,0,.72)}
  .seana-security h2{font-size:24px;line-height:1.25;margin:0 0 12px;color:#fff}
  .seana-security p{margin:0 0 20px;color:#e3e5e8}
  .seana-security label{display:block;color:#fff;font-weight:600;margin:0 0 18px}
  .seana-security input,.seana-security select{display:block;box-sizing:border-box;width:100%;min-height:48px;margin:8px 0 0;padding:12px;border:1px solid #777f8a;border-radius:10px;background:#0f1114;color:#fff;font:inherit}
  .seana-security input{font-size:22px;letter-spacing:3px}
  .seana-security input:focus-visible,.seana-security select:focus-visible,.seana-security button:focus-visible{outline:3px solid #ffb580;outline-offset:3px}
  .seana-security .security-status{color:#ffb5aa;min-height:24px;margin:0 0 16px;overflow-wrap:anywhere}
  .seana-security .security-actions{display:flex;gap:12px;flex-wrap:wrap}
  .seana-security button{flex:1;min-height:48px;padding:12px;border:1px solid #626975;border-radius:10px;background:#292f38;color:#fff;font:600 15px system-ui;cursor:pointer}
  .seana-security button[type=submit]{background:#a94c26;border-color:#a94c26}
  .seana-security button:disabled{opacity:.6;cursor:wait}
  @media(max-width:480px){dialog.seana-security{padding:22px}}
  `;document.head.append(style);
 }
 async function verify(clerk){
  const session=clerk.session;if(!session)throw Error('Sign in first.');
  await clerk.user.reload();
  if(!clerk.user.twoFactorEnabled){openAccount(clerk);throw Error('In Account security, add an authenticator app. Save your backup codes, then return here and verify again.');}
  const verification=await session.startVerification({level:'second_factor'});
  if(clerk.session?.id!==session.id)throw Error('Your account changed. Please reload.');
  if(verification.status==='complete'){await session.getToken({skipCache:true});return;}
  const factors=verification.supportedSecondFactors||[];
  const supported=['totp','phone_code','backup_code'].filter(strategy=>factors.some(f=>f.strategy===strategy));
  if(!supported.length)throw Error('No verification method is available. Open Account security to check your setup.');
  addStyles();const previousFocus=document.activeElement;
  const dialog=document.createElement('dialog');dialog.className='seana-security';dialog.setAttribute('aria-labelledby','security-heading');dialog.setAttribute('aria-describedby','security-help');
  const heading=document.createElement('h2');heading.id='security-heading';heading.textContent='Verify your account';
  const help=document.createElement('p');help.id='security-help';
  const form=document.createElement('form'),methodLabel=document.createElement('label'),label=document.createElement('label'),select=document.createElement('select'),input=document.createElement('input'),status=document.createElement('p'),actions=document.createElement('div'),submit=document.createElement('button'),cancel=document.createElement('button');
  methodLabel.textContent='Verification method';methodLabel.append(select);methodLabel.hidden=supported.length===1;
  label.textContent='Verification code';input.autocomplete='one-time-code';input.autocapitalize='off';input.spellcheck=false;input.required=true;input.setAttribute('aria-describedby','security-help security-status');label.append(input);
  status.id='security-status';status.className='security-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  submit.textContent='Verify code';submit.type='submit';cancel.textContent='Cancel';cancel.type='button';actions.className='security-actions';actions.append(submit,cancel);
  for(const strategy of supported){const option=document.createElement('option');option.value=strategy;option.textContent={totp:'Authenticator app',phone_code:'Text message',backup_code:'Backup code'}[strategy];select.append(option);}
  form.append(methodLabel,label,status,actions);dialog.append(heading,help,form);document.body.append(dialog);
  let prepared,closed=false,busy=false;
  async function prepare(){
   input.value='';status.textContent='';input.removeAttribute('aria-invalid');
   const backup=select.value==='backup_code';input.inputMode=backup?'text':'numeric';input.maxLength=backup?32:6;input.pattern=backup?'[A-Za-z0-9-]{6,32}':'[0-9]{6}';
   help.textContent=backup?'Enter one unused backup code you saved when setting up two-factor authentication.':select.value==='phone_code'?'Enter the six-digit code sent to your verified phone number.':'Open your authenticator app and enter the six-digit code for seána.';
   if(select.value==='phone_code'){const f=factors.find(f=>f.strategy==='phone_code');await session.prepareSecondFactorVerification({strategy:'phone_code',phoneNumberId:f.phoneNumberId});}
  }
  try{
   await new Promise((resolve,reject)=>{
    const cancelled=()=>{closed=true;reject(Error('Verification cancelled. No action was submitted.'));};
    cancel.onclick=cancelled;dialog.oncancel=e=>{e.preventDefault();cancelled();};
    function startPreparation(){submit.disabled=true;prepared=prepare();prepared.then(()=>{if(!closed)submit.disabled=false;},()=>{if(!closed){status.textContent='Could not send a code. Switch methods or cancel and try again.';submit.disabled=true;}});}
    select.onchange=()=>{if(!busy)startPreparation();};
    input.oninput=()=>{input.removeAttribute('aria-invalid');if(select.value!=='backup_code')input.value=input.value.replace(/\D/g,'').slice(0,6);};
    form.onsubmit=async e=>{
     e.preventDefault();if(submit.disabled||busy||closed)return;
     busy=true;submit.disabled=true;select.disabled=true;submit.textContent='Verifying…';status.textContent='';
     try{
      await prepared;if(clerk.session?.id!==session.id)throw Error('Your account changed. Please reload.');
      const result=await session.attemptSecondFactorVerification({strategy:select.value,code:input.value.trim()});input.value='';
      if(closed)return;
      if(result.status!=='complete')throw Error('Verification is incomplete. Please try again.');
      await session.getToken({skipCache:true});if(closed)return;
      if(clerk.session?.id!==session.id)throw Error('Your account changed. Please reload.');resolve();
     }catch(error){if(!closed){input.value='';input.setAttribute('aria-invalid','true');status.textContent=error.errors?.[0]?.longMessage||error.message||'That code could not be verified. Try the current code from your authenticator app.';input.focus();}}
     finally{busy=false;if(!closed){submit.disabled=false;select.disabled=false;submit.textContent='Verify code';}}
    };
    dialog.showModal();input.focus();startPreparation();
   });
  }finally{closed=true;input.value='';dialog.close();dialog.remove();if(previousFocus?.isConnected)previousFocus.focus();}
 }
 window.SeanaOwnerSecurity={openAccount,verify(clerk){if(!pending)pending=verify(clerk).finally(()=>{pending=null;});return pending;}};
})();
