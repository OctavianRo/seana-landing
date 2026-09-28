const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync('portal/customer.js','utf8');
async function fixture(signup=false){
 const nodes=new Map();const node=id=>{if(!nodes.has(id))nodes.set(id,{hidden:true,textContent:'',replaceChildren(){},setAttribute(){}});return nodes.get(id);};
 let listener,mounts=0,unmounts=0,securityRefreshes=0;
 const clerk={session:null,user:null,addListener(fn){listener=fn;fn({session:null});},mountSignIn(){mounts++;},mountSignUp(){mounts++;},unmountSignIn(){unmounts++;},unmountSignUp(){},async signOut(){this.session=null;await listener({session:null});}};
 const window={SeanaAuth:{load:async()=>clerk},SeanaCustomerSecurity:{init:()=>({refresh(){securityRefreshes++;}})}};
 vm.runInNewContext(source,{window,document:{getElementById:node,querySelectorAll:()=>[],querySelector:()=>node('upcoming')},location:{hostname:'www.seana.ie',protocol:'https:',origin:'https://www.seana.ie',pathname:'/portal/customer.html',search:signup?'?auth=signup':''},fetch:async()=>({ok:true,json:async()=>({clerkPublishableKey:'fixture',sessions:[]})}),URL,URLSearchParams,AbortSignal,Intl,Date});
 await new Promise(resolve=>setImmediate(resolve));
 return {clerk,node,get mounts(){return mounts;},get unmounts(){return unmounts;},get refreshes(){return securityRefreshes;},emit:s=>listener({session:s})};
}
for(const signup of [false,true])test(`Clerk ${signup?'signup':'signin'} is not remounted during factor/reset updates`,async()=>{
 const f=await fixture(signup);assert.equal(f.mounts,1);
 for(let i=0;i<8;i++)await f.emit(null);
 assert.equal(f.mounts,1);assert.equal(f.node('signin').hidden,false);assert.ok(f.refreshes>=9);
});
test('pending session cannot expose customer workspace or restart verification',async()=>{
 const f=await fixture();await f.emit({id:'pending',status:'pending'});assert.equal(f.mounts,1);assert.equal(f.node('workspace').hidden,true);
});
test('active account followed by sign out mounts sign-in exactly once',async()=>{
 const f=await fixture();f.clerk.session={id:'active',status:'active',getToken:async()=>'test-token'};
 // Skip API rendering: reject the data request without changing authentication.
 f.clerk.session.getToken=async()=>{throw Error('fixture data unavailable');};
 await f.emit(f.clerk.session);assert.equal(f.unmounts,1);assert.equal(f.node('signin').hidden,true);
 await f.node('signout').onclick();assert.equal(f.mounts,2);assert.equal(f.node('signin').hidden,false);assert.equal(f.node('workspace').hidden,true);
 await f.emit(null);assert.equal(f.mounts,2);
});
