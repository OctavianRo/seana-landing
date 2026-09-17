/* Passwords and verification codes go directly to Clerk, never to the sauna API. */
window.SeanaCustomerSecurity={init(clerk){
 'use strict';
 const $=id=>document.getElementById(id);
 let step='email',pending=false,version=0,lastSent=0,attempt=null,resetRequested=false;
 function refresh(){
  const enabled=clerk.user?.twoFactorEnabled;
  $('mfa-status').textContent=clerk.localDemo?'Local preview: two-factor authentication is simulated.':enabled?'Two-factor authentication is enabled for your account.':'Two-factor authentication is optional. Protect your account with an authenticator app and backup codes.';
  $('setup-mfa').textContent=enabled?'Manage two-factor authentication':'Set up two-factor authentication';
  if(clerk.session&& !$('recovery').hidden)close();
 }
 function show(next){step=next;for(const name of ['email','reset','mfa'])$('recovery-'+(name==='mfa'?'mfa':name)+'-fields').hidden=name!==next;
  $('recovery-email').required=next==='email';
  for(const id of ['code','password','confirm'])$('recovery-'+id).required=next==='reset';
  $('recovery-mfa-code').required=next==='mfa';
  $('recovery-submit').textContent=next==='email'?'Send reset code':next==='reset'?'Reset password':'Verify security code';
 }
 function close(){version++;attempt=null;resetRequested=false;$('recovery-form').reset();$('recovery').hidden=true;$('clerk-signin').hidden=false;$('forgot-password').hidden=false;}
 function message(text){$('recovery-status').textContent=text;}
 function errorMessage(error){const code=error?.errors?.[0]?.code;
  if(code==='form_code_incorrect'||code==='verification_failed')return 'That code is incorrect. Please check it and try again.';
  if(code==='verification_expired')return 'This code has expired. Go back and request a new reset code.';
  if(code==='too_many_requests')return 'Too many attempts. Please wait before trying again.';
  if(code==='form_password_pwned')return 'This password has appeared in a data breach. Choose a different password.';
  return error?.errors?.[0]?.longMessage||error?.message||'This could not be completed. Please try again.';
 }
 async function result(value){attempt=value;
  if(value.status==='complete'){
   close();$('status').textContent='Your password has been reset. Sign in with your new password to continue.';
   // Do not bypass the normal sign-in or any required session tasks.
   return;
  }
  if(value.status==='needs_second_factor'){
   const methods=(value.supportedSecondFactors||[]).filter(f=>['totp','backup_code','phone_code'].includes(f.strategy));
   if(!methods.length)throw Error('Additional verification is required. Return to sign in to continue securely.');
   $('recovery-method').replaceChildren(...methods.map(f=>{const option=document.createElement('option');option.value=f.strategy;option.textContent=f.strategy==='totp'?'Authenticator app':f.strategy==='backup_code'?'Backup code':'Text message '+(f.safeIdentifier||'');return option;}));
   show('mfa');$('recovery-password').value='';$('recovery-confirm').value='';$('recovery-code').value='';
   await prepare();return;
  }
  throw Error('Additional verification is required. Return to sign in to continue securely.');
 }
 async function prepare(){const strategy=$('recovery-method').value;
  if(strategy==='phone_code'){const factor=attempt.supportedSecondFactors.find(f=>f.strategy===strategy);await clerk.client.signIn.prepareSecondFactor({strategy,phoneNumberId:factor.phoneNumberId});message('Enter the security code sent to your verified phone.');}
  else message(strategy==='backup_code'?'Enter one of your unused backup codes.':'Enter the code from your authenticator app.');
 }
 $('forgot-password').disabled=false;
 $('forgot-password').onclick=()=>{
  if(clerk.localDemo){$('status').textContent='This local preview does not send email or change passwords. Use a Clerk development account to test email recovery.';return;}
  $('clerk-signin').hidden=true;$('forgot-password').hidden=true;$('recovery').hidden=false;show('email');message('');$('recovery-email').focus();
 };
 $('recovery-back').onclick=close;
 $('recovery-method').onchange=async()=>{if(pending)return;pending=true;$('recovery-submit').disabled=true;try{await prepare();}catch(e){message(errorMessage(e));}finally{pending=false;$('recovery-submit').disabled=false;}};
 $('recovery-form').onsubmit=async e=>{
  e.preventDefault();if(pending)return;
  const current=version;pending=true;$('recovery-submit').disabled=true;$('recovery-back').disabled=true;$('recovery-method').disabled=true;
  try{
   if(step==='email'){
    if(Date.now()-lastSent<30000)throw Error('Please wait 30 seconds before requesting another code.');
    lastSent=Date.now();
    resetRequested=false;try{await clerk.client.signIn.create({strategy:'reset_password_email_code',identifier:$('recovery-email').value.trim()});resetRequested=true;}
    catch(error){if(!['form_identifier_not_found','form_param_nil','strategy_for_user_invalid'].includes(error?.errors?.[0]?.code))throw error;}
    if(current!==version)return;show('reset');message('If this email has a password account, a reset code is on its way. Check your inbox and spam folder. If you use Google or Apple, sign in with that option.');$('recovery-code').focus();
   }else if(step==='reset'){
    if($('recovery-password').value!==$('recovery-confirm').value)throw Error('Your passwords do not match.');
    if(!resetRequested)throw Error('Unable to verify this reset code. Check your details or return to sign in with Google or Apple.');
    const value=await clerk.client.signIn.attemptFirstFactor({strategy:'reset_password_email_code',code:$('recovery-code').value.trim(),password:$('recovery-password').value});
    if(current===version)await result(value);
   }else{
    const value=await clerk.client.signIn.attemptSecondFactor({strategy:$('recovery-method').value,code:$('recovery-mfa-code').value.trim()});
    if(current===version)await result(value);
   }
  }catch(error){if(current===version)message(errorMessage(error));}
  finally{pending=false;$('recovery-submit').disabled=false;$('recovery-back').disabled=false;$('recovery-method').disabled=false;}
 };
 $('setup-mfa').onclick=()=>clerk.openUserProfile();
 window.addEventListener('focus',()=>{if(clerk.user)void clerk.user.reload().then(refresh).catch(()=>{});});
 refresh();return {refresh};
}};
