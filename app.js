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
  $('#copyBtn').onclick = async () => { try { await navigator.clipboard.writeText(me.id); alert('تم النسخ'); } catch { alert('تعذر النسخ؛ انسخ اليوزر يدوياً: '+me.id); } };
  $('#copyAccountBtn') && ($('#copyAccountBtn').onclick = async () => { try { await navigator.clipboard.writeText(me.id); } catch { alert('تعذر النسخ؛ اليوزر: '+me.id); } });
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
    if(active){ active=false; if(wake) try{await wake.release()}catch{}; wake=null; $('#keepAliveBtn').textContent='تفعيل البقاء نشط'; $('#keepAliveStatus').textContent='متوقف'; }
    else {
      try {
        if(!('wakeLock' in navigator)) { $('#keepAliveStatus').textContent='غير مدعوم في هذا المتصفح'; return; }
        wake=await navigator.wakeLock.request('screen');
        active=true;
        wake.addEventListener('release',()=>{ active=false; wake=null; $('#keepAliveBtn').textContent='تفعيل البقاء نشط'; $('#keepAliveStatus').textContent='انتهى قفل الشاشة'; });
        $('#keepAliveBtn').textContent='إيقاف البقاء نشط';
        $('#keepAliveStatus').textContent='نشط ✓';
      } catch { $('#keepAliveStatus').textContent='تعذر تفعيل البقاء نشط'; }
    }
  });
  document.addEventListener('visibilitychange', async () => {
    if(document.visibilityState==='visible' && active && !wake && 'wakeLock' in navigator){
      try { wake=await navigator.wakeLock.request('screen'); } catch { active=false; $('#keepAliveStatus').textContent='تعذر استعادة البقاء نشط'; }
    }
  });
  // notifications
  $('#enableNotifBtn') && ($('#enableNotifBtn').onclick = async () => {
    if(!('Notification' in window)) return alert('غير مدعوم');
    const r = await Notification.requestPermission();
    $('#notifStatus').textContent = r==='granted' ? 'مفعّلة ✓' : 'مرفوضة';
  });
  $('#resetUserBtn') && ($('#resetUserBtn').onclick = () => { if(confirm('يوزر جديد؟')){ localStorage.removeItem(STORAGE); location.reload(); } });

  // PeerJS call lifecycle: keep one call, attach both incoming/outgoing audio,
  // and always release microphone tracks when a call ends.
  let peer = null;
  let currentCall = null;
  let pendingCall = null;
  let localStream = null;
  let callStartedAt = 0;
  let callTimer = null;
  const remoteAudio = $('#remoteAudio');
  const callBtn = $('#callBtn');
  const hangupBtn = $('#hangupBtn');

  function setStatus(message){ $('#lineStatus').textContent = message; }
  function setCallTimer(){
    const el=$('#callTimer');
    if(!el || !callStartedAt) return;
    const seconds=Math.floor((Date.now()-callStartedAt)/1000);
    el.textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
  }
  function stopLocalStream(){
    if(localStream){ localStream.getTracks().forEach(track=>track.stop()); localStream=null; }
  }
  function finishCall(closeConnection){
    const call=currentCall || pendingCall;
    currentCall=null;
    pendingCall=null;
    if(closeConnection && call){ try{ call.close(); }catch{} }
    stopLocalStream();
    if(remoteAudio){ remoteAudio.pause(); remoteAudio.srcObject=null; }
    $('#incomingOverlay').classList.remove('show');
    $('#inCallOverlay').classList.remove('show');
    if(callTimer){ clearInterval(callTimer); callTimer=null; }
    callStartedAt=0;
    if(callBtn){ callBtn.style.display='grid'; callBtn.disabled=!$('#peerInput').value.trim(); }
    if(hangupBtn) hangupBtn.onclick=null;
  }
  async function requestMicrophone(){
    if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('الميكروفون غير متاح؛ افتح الموقع عبر HTTPS ومن متصفح يدعم WebRTC');
    return navigator.mediaDevices.getUserMedia({audio:true,video:false});
  }
  function bindCall(call, stream){
    currentCall=call;
    pendingCall=null;
    localStream=stream;
    $('#incomingOverlay').classList.remove('show');
    $('#inCallOverlay').classList.add('show');
    $('#inCallName').textContent=call.peer;
    callBtn.style.display='none';
    hangupBtn.onclick=()=>finishCall(true);
    callStartedAt=Date.now();
    setCallTimer();
    if(callTimer) clearInterval(callTimer);
    callTimer=setInterval(setCallTimer,1000);
    call.on('stream', remoteStream=>{
      remoteAudio.srcObject=remoteStream;
      remoteAudio.play().catch(()=>setStatus('اضغط الشاشة لتفعيل صوت الطرف الآخر'));
      setStatus('مكالمة نشطة');
    });
    call.on('close',()=>{ finishCall(false); setStatus('انتهت المكالمة'); });
    call.on('error',err=>{ console.error('PeerJS call error',err); finishCall(false); setStatus('تعذر استمرار المكالمة'); });
  }
  if(typeof Peer !== 'undefined'){
    peer = new Peer(me.id, {debug:0});
    peer.on('open', () => setStatus('الخط شغّال'));
    peer.on('disconnected', () => setStatus('انقطع الاتصال بالخادم؛ جارٍ إعادة المحاولة'));
    peer.on('close', () => setStatus('اتصال الخادم مغلق'));
    peer.on('error', err => { console.error('PeerJS error',err); setStatus('خطأ اتصال: '+(err.type||'غير معروف')); if(currentCall || pendingCall) finishCall(true); });
    peer.on('call', call => {
      if(currentCall || pendingCall){ call.close(); return; }
      pendingCall=call;
      $('#incomingName').textContent=call.peer;
      $('#incomingId').textContent=call.peer;
      $('#incomingOverlay').classList.add('show');
      $('#acceptBtn').onclick=async()=>{
        try {
          const stream=await requestMicrophone();
          if(pendingCall!==call){ stream.getTracks().forEach(t=>t.stop()); return; }
          call.answer(stream);
          bindCall(call,stream);
        } catch(err){ alert(err.message||'تعذر الوصول للميكروفون'); call.close(); finishCall(false); }
      };
      $('#rejectBtn').onclick=()=>{ call.close(); finishCall(false); setStatus('تم رفض المكالمة'); };
    });
    callBtn.onclick=async()=>{
      const to=$('#peerInput').value.trim();
      if(!to || to===me.id || currentCall || pendingCall) return;
      callBtn.disabled=true;
      setStatus('جارٍ طلب إذن الميكروفون…');
      try {
        const stream=await requestMicrophone();
        if(!peer || peer.destroyed){ stream.getTracks().forEach(t=>t.stop()); throw new Error('اتصال الخادم غير جاهز'); }
        const call=peer.call(to,stream);
        if(!call){ stream.getTracks().forEach(t=>t.stop()); throw new Error('تعذر إنشاء المكالمة'); }
        bindCall(call,stream);
        setStatus('جارٍ الاتصال بالطرف الآخر…');
      } catch(err){
        stopLocalStream();
        callBtn.disabled=!$('#peerInput').value.trim();
        setStatus('فشل بدء المكالمة');
        alert(err.message||'تعذر بدء المكالمة');
      }
    };
    hangupBtn.onclick=()=>finishCall(true);
  } else {
    setStatus('مكتبة الاتصال غير محمّلة');
    callBtn.disabled=true;
  }
})();
