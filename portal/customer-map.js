'use strict';
window.createCustomerMap=({container,saunas})=>{
 const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 const venues=saunas.filter(s=>typeof s.id==='string'&&Number.isFinite(s.lat)&&Number.isFinite(s.lng)&&Math.abs(s.lat)<=90&&Math.abs(s.lng)<=180&&!(s.lat===0&&s.lng===0));
 const root=el('section');root.className='customer-map';
 const label=el('label','Find a sauna on the map'),input=el('input');input.type='search';input.placeholder='Sauna name or county';input.setAttribute('aria-label','Search sauna map');label.append(input);
 const status=el('p');status.setAttribute('role','status');const canvas=el('div');canvas.className='customer-map-canvas';canvas.setAttribute('aria-label','Map of approved saunas');
 const list=el('div');list.className='map-venue-list';root.append(el('p','Explore the saunas available on seána. Only approved locations appear here.'),label,status,canvas,list);container.append(root);
 if(!window.L){status.textContent='The map could not load. Refresh this page to try again.';return ()=>root.remove();}
 const map=L.map(canvas,{preferCanvas:true,scrollWheelZoom:false}).setView([53.4,-8],6);
 L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).on('tileerror',()=>{status.textContent='Map imagery is unavailable. You can still search the sauna list below.';}).addTo(map);
 const layer=L.layerGroup().addTo(map);
 function popup(s){const box=el('div');box.append(el('strong',s.name),el('p',[s.location,s.county].filter(Boolean).join(' · ')));if(Number(s.session_price)>0)box.append(el('p','Sessions from €'+Number(s.session_price).toFixed(2)));return box;}
 function paint(){const query=input.value.trim().toLocaleLowerCase('en-IE');const filtered=venues.filter(s=>`${s.name} ${s.county} ${s.location}`.toLocaleLowerCase('en-IE').includes(query));layer.clearLayers();list.replaceChildren();const bounds=[];
 for(const [index,s]of filtered.entries()){const pin=L.circleMarker([s.lat,s.lng],{radius:8,color:'#ff9b59',weight:2,fillColor:'#ff9b59',fillOpacity:.85}).bindPopup(popup(s)).addTo(layer);bounds.push([s.lat,s.lng]);if(index<50){const button=el('button',`${s.name} · ${s.county||s.location||'View on map'}`);button.className='secondary';button.onclick=()=>{map.setView([s.lat,s.lng],13);pin.openPopup();};list.append(button);}}
 status.textContent=!venues.length?'Approved saunas will appear on your map as they join seána.':!filtered.length?'No saunas match your search.':`${filtered.length} saunas on the map${filtered.length>50?' · showing the first 50 in the list; search to narrow it down':''}`;
 if(bounds.length)map.fitBounds(bounds,{padding:[30,30],maxZoom:12});
 }
 input.oninput=paint;paint();requestAnimationFrame(()=>{if(root.isConnected)map.invalidateSize();});return()=>{map.remove();root.remove();};
};
