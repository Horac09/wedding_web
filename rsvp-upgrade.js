/* Nacist AZ ZA puvodnim hlavnim skriptem, tesne pred </body>. */
(() => {
  'use strict';
  const form=document.getElementById('rsvp-form');
  if(!form) return;
  const btn=document.getElementById('rsvp-submit-btn');
  const oldPrepare=window.predOdeslanim;
  const originalLabel=btn.textContent.trim();
  let busy=false, pending=null;
  const randomHex=n=>Array.from(crypto.getRandomValues(new Uint8Array(n)),x=>x.toString(16).padStart(2,'0')).join('');
  function field(id,label,type,max) {
    const wrap=document.createElement('div');
    const l=document.createElement('label'); l.htmlFor=id; l.textContent=label;
    l.className='block text-xs font-medium mb-2';
    const input=document.createElement('input'); input.id=id;input.type=type;input.maxLength=max;
    input.className='w-full px-4 py-3 rounded-xl border border-gray-200 text-sm bg-white';
    wrap.append(l,input);return wrap;
  }
  document.getElementById('family-name').parentElement.after(field('rsvp-contact','E-mail nebo telefon (volitelné)','text',200));
  const trap=field('rsvp-website','Toto pole nevyplňujte','text',200);
  trap.hidden=true; trap.querySelector('input').tabIndex=-1;trap.querySelector('input').autocomplete='off';form.append(trap);
  const hidden=document.createElement('input');hidden.type='hidden';hidden.name='payload';form.append(hidden);
  const message=document.createElement('p');message.setAttribute('role','status');message.setAttribute('aria-live','polite');message.className='text-center text-sm pt-2';form.append(message);
  const notice=document.createElement('p');notice.className='text-xs text-darkCharcoal/70';
  notice.textContent='Údaje slouží k organizaci svatby. Uveďte jen potřebné informace o stravování, nikoli zdravotní diagnózy. Zájem o ubytování není potvrzením rezervace.';
  btn.before(notice);
  // Samotne nacteni iframe neni dukaz ulozeni.
  window.hotovoOdeslano=()=>{};
  function snapshot() {
    return {family:document.getElementById('family-name').value.trim(),contact:document.getElementById('rsvp-contact').value.trim(),message:document.getElementById('rsvp-custom-message').value.trim(),website:document.getElementById('rsvp-website').value,guests:Array.from(form.querySelectorAll('.person-item'),card=>({name:card.querySelector('.person-name').value.trim(),type:card.querySelector('.person-type').value,attendance:card.querySelector('.person-attendance').value,sleep:card.querySelector('.person-sleep').checked,diets:Array.from(card.querySelectorAll('.person-allergy:checked'),x=>x.value),note:card.querySelector('.person-diet-custom').value.trim()}))};
  }
  function status(id) {
    return new Promise((resolve,reject)=>{
      const cb='weddingStatus_'+randomHex(8),s=document.createElement('script');
      const clean=()=>{clearTimeout(timer);s.remove();delete window[cb];};
      const timer=setTimeout(()=>{clean();reject(new Error('timeout'));},10000);
      window[cb]=data=>{clean();resolve(data);};s.onerror=()=>{clean();reject(new Error('network'));};
      const url=new URL(form.action);url.searchParams.set('id',id);url.searchParams.set('callback',cb);url.searchParams.set('_',Date.now());s.src=url.href;document.head.append(s);
    });
  }
  async function confirm(id) {
    const end=Date.now()+60000;
    let ok=false;
    try {
      while(Date.now()<end) {
        await new Promise(r=>setTimeout(r,3500));
        try {const result=await status(id);if(result.id===id&&result.status==='success'){ok=true;break;}}catch(_){}
      }
      if(ok) {
        message.textContent='Děkujeme! Vaše odpověď je uložená.';message.style.color='#3f5742';
        form.reset();document.getElementById('persons-list').replaceChildren();window.pridatOsobu();pending=null;
      } else {
        message.textContent='Uložení se nepodařilo ověřit. Údaje zůstaly vyplněné. Bez jejich změny můžete odeslání bezpečně zopakovat. Pokud problém trvá, kontaktujte snoubence.';message.style.color='#9b332a';
      }
    } finally {busy=false;form.inert=false;btn.disabled=false;btn.textContent=originalLabel;}
  }
  window.predOdeslanim=()=>{
    if(busy) return false;
    if(form.querySelectorAll('.person-item').length>30){message.textContent='Najednou lze odeslat nejvýše 30 hostů.';return false;}
    if(!oldPrepare()) return false;
    try {
      const data=snapshot(),serialized=JSON.stringify(data);
      if(!pending||pending.serialized!==serialized) pending={serialized,id:randomHex(32)};
      hidden.value=JSON.stringify({...data,id:pending.id});
      busy=true;message.textContent='Odesíláme a ověřujeme uložení…';message.style.color='';
      document.getElementById('rsvp-success').classList.add('hidden');
      // Nativni odeslani musi probehnout pred znepristupnenim formulare.
      setTimeout(()=>{form.inert=true;confirm(pending.id);},0);
      return true;
    } catch(err) {busy=false;btn.disabled=false;btn.textContent=originalLabel;message.textContent='Odeslání se nepodařilo připravit. Zkuste aktuální prohlížeč.';return false;}
  };
  // Popisky puvodnich poli a oddeleni vegetarianske a veganske stravy.
  let labelIndex=0;
  function improveFields() {
    form.querySelectorAll('label').forEach(label=>{
      if(label.htmlFor||label.querySelector('input,select,textarea'))return;
      const input=label.parentElement.querySelector('input:not([type=hidden]),select,textarea');
      if(input){if(!input.id)input.id='rsvp-field-'+(++labelIndex);label.htmlFor=input.id;}
    });
    form.querySelectorAll('.person-name').forEach(x=>x.maxLength=120);
    form.querySelectorAll('.person-diet-custom').forEach(x=>x.maxLength=500);
    form.querySelectorAll('input[value="Vegetarián/Vegan"]').forEach(x=>{
      x.value='Vegetarián';const label=x.closest('label'),copy=label.cloneNode(true);
      copy.querySelector('input').value='Vegan';copy.querySelector('input').checked=false;copy.querySelector('span').textContent='Vegan';label.after(copy);
    });
  }
  document.getElementById('family-name').maxLength=150;
  document.getElementById('rsvp-custom-message').maxLength=2000;
  improveFields();new MutationObserver(improveFields).observe(document.getElementById('persons-list'),{childList:true});
})();
