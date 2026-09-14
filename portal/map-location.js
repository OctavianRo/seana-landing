(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.SeanaMapLocation=factory();})(typeof window==='undefined'?this:window,function(){
  function point(lat,lng){if(lat==null||lng==null||String(lat).trim()===''||String(lng).trim()==='')return null;lat=Number(lat);lng=Number(lng);return Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180&&(lat!==0||lng!==0)?{lat,lng}:null;}
  function fromLink(text){
    let url;try{url=new URL(String(text).trim());}catch{return null;}
    const host=url.hostname.toLowerCase();
    if(url.protocol!=='https:'||url.username||url.password||!['google.com','www.google.com','maps.google.com','google.ie','www.google.ie','maps.google.ie','maps.apple.com','www.openstreetmap.org','openstreetmap.org'].includes(host))return null;
    let full;try{full=decodeURIComponent(url.pathname+url.search+url.hash);}catch{return null;}
    // Google's actual selected place takes priority over its viewport centre.
    const place=full.match(/!3d(-?[\d.]+)!4d(-?[\d.]+)/);if(place)return point(place[1],place[2]);
    for(const key of ['query','q','ll','center']){const match=(url.searchParams.get(key)||'').match(/^\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*$/);if(match)return point(match[1],match[2]);}
    const marker=point(url.searchParams.get('mlat'),url.searchParams.get('mlon'));if(marker)return marker;
    const centre=full.match(/@(-?[\d.]+),(-?[\d.]+),/)||url.hash.match(/map=\d+\/(-?[\d.]+)\/(-?[\d.]+)/);return centre?point(centre[1],centre[2]):null;
  }
  return {point,fromLink};
});
