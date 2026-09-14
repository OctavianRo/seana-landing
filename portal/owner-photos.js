/* Shared owner photo API. Refresh this section without replacing profile drafts. */
function createOwnerPhotoPanel({saunaId,api,preview,allowed,enabled,initialPhotos=[]}) {
  const node=(tag,text)=>Object.assign(document.createElement(tag),{textContent:text||''});
  const panel=node('section');panel.className='photo-section';panel.dataset.ownerPhotos='';
  const heading=node('h3','Sauna photos'),help=node('p','Upload here or in the mobile owner dashboard. Every new photo stays private until the platform reviewer approves it.'),status=node('p'),list=node('div'),refresh=node('button','Refresh photos');
  status.setAttribute('role','status');refresh.type='button';refresh.className='secondary';
  panel.append(heading,help,status,refresh,list);
  let photos=initialPhotos,busy=false,disposed=false;const urls=new Set();
  const clearUrls=()=>{for(const url of urls)URL.revokeObjectURL(url);urls.clear();};
  const controls=()=>{refresh.disabled=busy;for(const input of list.querySelectorAll('button,input'))input.disabled=busy||!allowed||(input.type==='file'&&(!enabled||photos.length>=5));};
  async function load(){const response=await api(`/api/business/${encodeURIComponent(saunaId)}/photos`,{cache:'no-store'});if(!response.ok)throw Error(response.body?.error||'Could not refresh photos.');if(disposed)return;photos=response.body.photos||[];enabled=response.body.uploadsEnabled===true;draw();}
  async function refreshPhotos(){if(busy||disposed)return;busy=true;controls();status.textContent='Refreshing photos…';try{await load();if(!disposed)status.textContent='Photo status is up to date.';}catch(error){if(!disposed)status.textContent=error.message;}finally{busy=false;if(!disposed)controls();}}
  async function update(options){if(busy||disposed||!allowed)return;busy=true;controls();status.textContent='Saving photo…';let saved=false;
    try{const response=await api(`/api/business/${encodeURIComponent(saunaId)}/upload-photo`,options);if(!response.ok)throw Error(response.body?.error||'Could not update photo.');saved=true;if(disposed)return;await load();if(!disposed)status.textContent=options.method==='POST'?'Photo submitted for review. It stays private until approved.':'Photo removed. It is no longer available in the app.';}
    catch(error){if(!disposed)status.textContent=saved?'Your change was saved. Refresh photos to update the list.':error.message;}
    finally{busy=false;if(!disposed)controls();}
  }
  function draw(){clearUrls();list.replaceChildren();
    if(!photos.length)list.append(node('p','No photos yet. Show guests what makes your sauna special.'));
    for(const photo of photos){const card=node('div');card.className='owner-photo-card';
      card.append(node('p',photo.status==='approved'?'Approved · visible in the app':photo.status==='rejected'?'Not approved · private':'Awaiting review · private'));
      if(photo.rejectionReason)card.append(node('p',photo.rejectionReason));
      const image=node('img');image.alt='Your private submitted sauna photo';image.style.cssText='width:100%;max-width:480px;max-height:280px;object-fit:contain;border-radius:12px';card.append(image);
      void preview(photo.id).then(blob=>{if(disposed||!image.isConnected)return;const url=URL.createObjectURL(blob);urls.add(url);image.src=url;}).catch(()=>{image.alt='Preview unavailable. Tap Refresh photos to retry.';});
      const remove=node('button','Remove photo');remove.type='button';remove.className='secondary';remove.onclick=()=>{if(confirm('Remove this photo? Approved photos will stop appearing in the app.'))void update({method:'DELETE',body:JSON.stringify({photoId:photo.id})});};card.append(remove);list.append(card);
    }
    list.append(node('p',`${photos.length}/5 photos · JPEG, PNG or WebP · up to 5 MB each. Remove a rejected photo to make room for its replacement.`));
    if(enabled){const upload=node('input');upload.type='file';upload.accept='image/jpeg,image/png,image/webp';upload.setAttribute('aria-label','Add a sauna photo');upload.onchange=()=>{const file=upload.files?.[0];if(!file)return;if(file.size>5*1024*1024){status.textContent='Choose a photo smaller than 5 MB.';upload.value='';return;}const body=new FormData();body.append('photo',file);void update({method:'POST',body});};list.append(upload);}
    else list.append(node('p','Photo uploads will open once private photo storage is configured.'));
    controls();
  }
  const onFocus=()=>{if(panel.isConnected&&!document.hidden&&!panel.closest('[data-page]')?.classList.contains('hidden'))void refreshPhotos();};
  window.addEventListener('focus',onFocus);refresh.onclick=()=>void refreshPhotos();panel.refreshPhotos=()=>void refreshPhotos();
  panel.dispose=()=>{disposed=true;clearUrls();window.removeEventListener('focus',onFocus);};draw();return panel;
}
