(function(){
  const STORAGE = 'wasl_user_v3';
  const seeds = [{ar:'نور',en:'noor'},{ar:'سدو',en:'sadu'},{ar:'نجد',en:'najd'},{ar:'طارق',en:'tariq'},{ar:'ريم',en:'reem'}];
  const rand = n => Math.floor(Math.random()*n);
  function gen(){ const s=seeds[rand(seeds.length)]; return {id:s.en+(1000+rand(9000)), display:s.ar}; }
  let me = null;
  try { me = JSON.parse(localStorage.getItem(STORAGE)); } catch{}
  if(!me){ me=gen(); localStorage.setItem(STORAGE, JSON.stringify(me)); }
  const $ = s => document.querySelector(s);
  $('#myId').textContent = me.id;
  $('#myNameTag').textContent = me.display||'';
  $('#accountName').textContent = me.display||me.id;
  $('#accountId').textContent = me.id;
  $('#copyBtn').onclick = () => { navigator.clipboard.writeText(me.id); alert('تم النسخ'); };
  $('#copyAccountBtn') && ($('#copyAccountBtn').onclick = () => navigator.clipboard.writeText(me.id));
  $('#peerInput').oninput = () => { $('#callBtn').disabled = !$('#peerInput').value.trim(); };
  // tabs
  document.querySelectorAll('nav button').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('nav button').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      const t = btn.dataset.tab;
      ['call','solutions','account'].forEach(p => {
        const el = document.getElementById('tab-'+p);
        if(el) el.classList.toggle('hidden', p!==t);
      });
    };
  });
  // simple keep alive
  let wake=null, active=false;
  $('#keepAliveBtn') && ($('#keepAliveBtn').onclick = async () => {
    if(active){ active=false; if(wake) try{await wake.release()}catch{}; $('#keepAliveBtn').textContent='تفعيل البقاء نشط'; $('#keepAliveStatus').textContent='متوقف'; }
    else {
      active=true;
      try{ if(navigator.wakeLock) wake=await navigator.wakeLock.request('screen'); }catch{}
      $('#keepAliveBtn').textContent='إيقاف البقاء نشط';
      $('#keepAliveStatus').textContent='نشط ✓';
    }
  });
  // notif
  $('#enableNotifBtn') && ($('#enableNotifBtn').onclick = async () => {
    if(!('Notification' in window)) return alert('غير مدعوم');
    const r = await Notification.requestPermission();
    $('#notifStatus').textContent = r==='granted' ? 'مفعّلة ✓' : 'مرفوضة';
  });
  $('#resetUserBtn') && ($('#resetUserBtn').onclick = () => { if(confirm('يوزر جديد؟')){ localStorage.removeItem(STORAGE); location.reload(); } });
  // PeerJS basic
  if(typeof Peer !== 'undefined'){
    const peer = new Peer(me.id, {debug:0});
    peer.on('open', () => { $('#lineStatus').textContent='الخط شغّال'; });
    peer.on('call', call => {
      $('#incomingName').textContent = call.peer;
      $('#incomingId').textContent = call.peer;
      $('#incomingOverlay').classList.add('show');
      $('#acceptBtn').onclick = () => {
        navigator.mediaDevices.getUserMedia({audio:true}).then(stream => {
          call.answer(stream);
          $('#incomingOverlay').classList.remove('show');
          $('#inCallOverlay').classList.add('show');
          $('#inCallName').textContent = call.peer;
        });
      };
      $('#rejectBtn').onclick = () => { call.close(); $('#incomingOverlay').classList.remove('show'); };
    });
    $('#callBtn').onclick = () => {
      const to = $('#peerInput').value.trim();
      if(!to) return;
      navigator.mediaDevices.getUserMedia({audio:true}).then(stream => {
        const call = peer.call(to, stream);
        $('#inCallOverlay').classList.add('show');
        $('#inCallName').textContent = to;
        call.on('stream', remote => { $('#remoteAudio').srcObject = remote; });
      });
    };
    $('#hangupBtn').onclick = () => { $('#inCallOverlay').classList.remove('show'); };
  }
})();