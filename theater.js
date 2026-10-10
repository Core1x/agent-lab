(function(root){
  'use strict';
  const D=root.AgentLabData,E=root.AgentLabEngine,$=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let avatarSequence=0,lastEvent,lastRun;
  const colors=['#367feb','#8d6adb','#26a796','#df9550'];
  function color(name){return name==='订单专家'?colors[1]:/工作者|分支/.test(name)?colors[(Number(name.match(/\d/)?.[0])||1)%colors.length]:colors[0];}
  function avatar(name='主智能体',mood='idle'){
    const c=color(name),id='avatar-'+(++avatarSequence),happy=mood==='success',error=mood==='error';
    return '<svg class="agent-avatar mood-'+mood+'" viewBox="0 0 160 172" aria-hidden="true"><defs><linearGradient id="'+id+'" x1="0" y1="0" x2=".7" y2="1"><stop stop-color="#fff"/><stop offset="1" stop-color="#dfe9f7"/></linearGradient></defs>'+
      '<g class="avatar-float"><g class="avatar-antenna"><path d="M80 30V15" stroke="'+c+'" stroke-width="5" stroke-linecap="round"/><circle cx="80" cy="12" r="6" fill="'+c+'"/><circle class="antenna-halo" cx="80" cy="12" r="10" fill="none" stroke="'+c+'" stroke-opacity=".3"/></g>'+
      '<g class="avatar-arm arm-left"><rect x="20" y="105" width="20" height="39" rx="10" fill="'+c+'"/><circle cx="29" cy="141" r="9" fill="#e4eefb"/></g><g class="avatar-arm arm-right"><rect x="120" y="105" width="20" height="39" rx="10" fill="'+c+'"/><circle cx="130" cy="141" r="9" fill="#e4eefb"/></g>'+
      '<rect x="48" y="134" width="24" height="29" rx="10" fill="#c7d8ef"/><rect x="88" y="134" width="24" height="29" rx="10" fill="#c7d8ef"/><rect x="43" y="155" width="33" height="12" rx="6" fill="'+c+'"/><rect x="84" y="155" width="33" height="12" rx="6" fill="'+c+'"/>'+
      '<rect x="38" y="94" width="84" height="56" rx="24" fill="url(#'+id+')" stroke="#ccdcef" stroke-width="1.5"/><rect x="58" y="111" width="44" height="23" rx="11" fill="'+c+'" fill-opacity=".1"/><path class="avatar-heart" d="m69 122 5-5 6 7 6-7 5 5" fill="none" stroke="'+c+'" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'+
      '<rect x="18" y="52" width="18" height="32" rx="8" fill="'+c+'"/><rect x="124" y="52" width="18" height="32" rx="8" fill="'+c+'"/><rect x="26" y="29" width="108" height="73" rx="30" fill="url(#'+id+')" stroke="#ccdcef" stroke-width="1.5"/><rect x="36" y="43" width="88" height="47" rx="21" fill="#20354e"/>'+
      '<g class="avatar-eyes">'+(happy?'<path d="M51 65q6-9 12 0M97 65q6-9 12 0" fill="none" stroke="#8fe9da" stroke-width="5" stroke-linecap="round"/>':'<rect class="avatar-eye" x="52" y="56" width="11" height="16" rx="5.5" fill="'+(error?'#ffaaa2':'#99d7ff')+'"/><rect class="avatar-eye" x="97" y="56" width="11" height="16" rx="5.5" fill="'+(error?'#ffaaa2':'#99d7ff')+'"/>')+'</g>'+
      (error?'<path d="m50 51 15 5m31 0 15-5M74 80q6-5 12 0" fill="none" stroke="#ffaaa2" stroke-width="3" stroke-linecap="round"/>':happy?'<path d="M71 77q9 10 18 0" fill="none" stroke="#8fe9da" stroke-width="3" stroke-linecap="round"/>':'<path d="M75 79h10" stroke="#8aa8c9" stroke-width="3" stroke-linecap="round"/>')+
      '<ellipse cx="45" cy="77" rx="5" ry="2" fill="'+c+'" fill-opacity=".45"/><ellipse cx="115" cy="77" rx="5" ry="2" fill="'+c+'" fill-opacity=".45"/><path d="M45 34h38" stroke="#fff" stroke-width="4" stroke-linecap="round"/></g></svg>';
  }
  const glyphs={context:'▤',skill:'✦',memory:'◈',tool:'↗',agent:'⌘',human:'◎',output:'✓',gate:'◇',hook:'ϟ',handoff:'⇄',recovery:'↻',trigger:'↓',model:'✧'};
  function delay(ev,next,speed){const gap=next?Math.max(0,next.at-ev.at):500;const min=ev.type==='start'?950:ev.type==='error'||ev.type==='blocked'?1100:ev.tool?800:ev.type==='skipped'?200:550;return Math.max(100,Math.min(1800,Math.max(gap,min))/speed);}
  function state(run,index){
    const ev=run.events[index],n=run.nodes.find(x=>x.id===ev?.node),snap=E.snapshot(run,index),actor=ev?.agent||'主智能体';
    let phase='idle',mood='idle',status='准备就绪',transfer='任务 → 智能体 → 结果',action='准备好了，从一个任务开始。',detail='点击开始，观察智能体如何选择工具、获得信息并继续行动。';
    const tool=D.tools.find(t=>t.id===(ev?.tool||n?.toolId));
    if(ev){
      action=n.label;detail=ev.detail;
      if(['error','blocked'].includes(ev.type)){phase='error';mood='error';status='遇到问题';transfer=(tool?.name||'执行检查')+' → '+actor+' · 需要处理';}
      else if(ev.type==='cancelled'){phase='cancelled';mood='waiting';status='已取消';transfer='用户决定 → 停止后续动作';}
      else if(n.type==='human'){phase='approval';mood=ev.type==='complete'?'success':'waiting';status=ev.type==='complete'?'已获批准':'等待你的决定';transfer=actor+' → 人工确认'+(ev.type==='complete'?' → 继续执行':'');}
      else if(n.type==='handoff'){phase='handoff';mood='working';status='正在交接';transfer='主智能体 → 订单专家 · 转移答复责任';}
      else if(ev.type==='skipped'){phase='idle';status='跳过此分支';transfer='条件未命中 · 保留当前路径';}
      else if(n.type==='output'){phase=run.status==='cancelled'?'cancelled':run.status==='blocked'?'error':ev.type==='start'?'delivery':'done';mood=phase==='cancelled'?'waiting':phase==='delivery'?'working':phase==='done'?'success':'error';status=phase==='cancelled'?'任务已取消':phase==='delivery'?'准备交付':phase==='done'?'任务完成':'执行受阻';transfer=phase==='cancelled'?'用户决定 → 停止后续动作':phase==='error'?'执行受阻 → 保留问题记录':actor+' → 交付结果';}
      else if(n.type==='tool'){phase=ev.type==='start'?'call':'return';mood=phase==='call'?'working':'success';status=phase==='call'?'正在调用':'收到结果';transfer=phase==='call'?actor+' → '+(tool?.name||n.label):(tool?.name||n.label)+' → '+actor;}
      else if(['context','skill','hook','trigger','recovery'].includes(n.type)){phase='context';mood=ev.type==='start'?'loading':'success';status=ev.type==='start'?'正在准备':'信息已就绪';transfer=(n.type==='trigger'?'用户任务':n.label)+' → '+actor;}
      else if(n.type==='agent'&&actor!=='主智能体'){const reporting=/worker_summary_/.test(n.id)||/reviewer_/.test(n.id)&&ev.type==='complete';phase=reporting?'report':actor==='订单专家'?'thinking':ev.type==='start'?'delegate':'thinking';mood=ev.type==='start'?'thinking':'success';status=reporting?(ev.type==='start'?'正在返回摘要':'分支已返回'):actor==='订单专家'?(ev.type==='start'?'正在组织答复':'答复已整理'):ev.type==='start'?'独立处理中':'阶段已完成';transfer=reporting?actor+' → '+(run.config.workflow==='parallel'?'结果聚合':'主管汇总'):actor==='订单专家'?'订单专家 → 整理用户答复':ev.type==='start'?'任务分配 → '+actor:'阶段反馈 → 选择下一步工具';}
      else{phase='thinking';mood=ev.type==='start'?'thinking':'success';status=ev.type==='start'?'正在思考':'决策已完成';transfer='观察已有信息 → '+(n.type==='gate'?'检查条件':'选择下一步');}
    }
    const names=[...new Set(['主智能体',...run.nodes.map(x=>x.agent).filter(Boolean),...(run.config.workflow==='handoff'?['订单专家']:[])])];
    const visible=run.events.slice(0,index+1);
    const roles=names.map(name=>{const busy=run.nodes.some(x=>(x.agent||'主智能体')===name&&snap.states[x.id].status==='running'),latest=visible.filter(x=>(x.agent||'主智能体')===name).at(-1),returned=visible.some(x=>x.agent===name&&x.type==='complete'&&/worker_summary_|reviewer_/.test(x.node)),current=Boolean(ev)&&actor===name;return {name,busy,current,status:busy?'处理中':current?(ev.type==='approval'?'待确认':ev.type==='error'||ev.type==='blocked'?'受阻':safelyComplete(ev,phase,returned)):name==='主智能体'&&run.config.workflow==='handoff'&&snap.owner!==name?'已交接':returned?'已返回':latest?(name==='主智能体'&&['supervisor','parallel'].includes(run.config.workflow)?'等待分支':'等待下一步'):'待命'};});
    return {ev,n,snap,actor,tool,phase,mood,status,transfer,action,detail,roles};
  }
  function safelyComplete(ev,phase,returned){return ev.type==='cancelled'?'已取消':ev.type==='complete'?(phase==='done'?'任务完成':returned?'已返回':'本步完成'):'当前执行者';}
  function render(run,index,playing,speed,motion){
    const s=state(run,index),rootEl=$('agent-theater'),panel=document.querySelector('.flow-panel');
    panel.dataset.motion=motion?'on':'off';panel.dataset.playing=String(playing);
    rootEl.dataset.phase=s.phase;rootEl.dataset.mood=s.mood;rootEl.dataset.playing=String(playing);
    const hold=s.ev?delay(s.ev,run.events[index+1],speed):950;
    rootEl.style.setProperty('--beat-duration',hold+'ms');rootEl.style.setProperty('--packet-duration',Math.max(280,hold*.88)+'ms');
    if(lastEvent===s.ev&&lastRun===run)return;
    lastEvent=s.ev;lastRun=run;
    $('scene-avatar').innerHTML=avatar(s.actor,s.mood);$('scene-actor').textContent=s.actor;
    $('scene-role').textContent=s.actor==='订单专家'?'接管上下文 · 负责后续答复':s.actor!=='主智能体'?'独立上下文 · 返回任务摘要':run.config.workflow==='supervisor'?'拆分任务 · 委派工作者 · 汇总结果':'接收任务 · 选择工具 · 整理结果';
    $('scene-status').textContent=s.status;$('scene-owner').textContent=s.snap.owner+'负责答复';$('scene-counter').textContent=String(index+1).padStart(2,'0')+' / '+run.events.length;
    $('scene-transfer').textContent=s.transfer;$('scene-action').textContent=s.action;$('scene-explanation').textContent=s.detail;
    $('scene-beat-fill').style.animationName='none';void $('scene-beat-fill').offsetWidth;$('scene-beat-fill').style.animationName='scene-beat';
    const leftTitle=['skill','context','hook','recovery','trigger'].includes(s.n?.type)?s.n.label:s.phase==='delegate'?'主管分配的任务':'上下文工作台';
    const leftIcon=['skill','context','hook','recovery','trigger'].includes(s.n?.type)?glyphs[s.n.type]:'▤';
    $('scene-context').innerHTML='<span class="station-eyebrow">CONTEXT</span><div class="context-cards"><span></span><span></span><span><b>'+leftIcon+'</b><i></i><i></i><i></i></span></div><strong>'+esc(leftTitle)+'</strong><small>'+esc(s.phase==='context'?'将必要信息交给智能体':'任务、指令与已有观察')+'</small>';
    let stationTitle=s.tool?.name||'工具工作台',stationSub=s.tool?.integration||E.effective(run.config).tools.length+' 个工具可用',stationGlyph=s.tool?'↗':'⌘',stationDetail=s.phase==='return'?'结果返回到智能体的上下文':s.phase==='call'?'发送参数，等待工具执行':'需要时才调用';
    if(s.phase==='approval'){stationTitle='你的决定';stationSub='人工介入';stationGlyph='◎';stationDetail='批准、修改或拒绝';}
    if(s.phase==='handoff'){stationTitle='订单专家';stationSub='专业角色';stationGlyph='⇄';stationDetail='接收上下文与控制权';}
    if(s.phase==='delegate'){stationTitle='独立任务';stationSub='隔离上下文';stationGlyph='⌘';stationDetail='完成后返回摘要';}
    if(s.phase==='report'){stationTitle=run.config.workflow==='parallel'?'结果聚合':'主管工作台';stationSub='任务摘要';stationGlyph='▤';stationDetail='返回摘要，保留上下文隔离';}
    if(['done','delivery'].includes(s.phase)){stationTitle='交付工作台';stationSub=run.artifact||'模拟结果';stationGlyph=s.phase==='done'?'✓':'↗';stationDetail=s.phase==='done'?'检查通过，产物已就绪':'整理当前任务产物';}
    if(s.phase==='error'){stationGlyph='!';stationDetail=s.ev.type==='blocked'?'当前动作受阻，等待处理':'检查错误，决定重试或停止';}
    $('scene-station').innerHTML='<span class="station-eyebrow">'+(s.phase==='approval'?'HUMAN':s.phase==='handoff'?'HANDOFF':'ACTION')+'</span><div class="station-device">'+(s.phase==='handoff'?avatar('订单专家','idle'):'<b>'+stationGlyph+'</b>')+'<span class="device-indicator"></span><div class="device-meter"><i></i><i></i><i></i><i></i></div></div><strong>'+esc(stationTitle)+'</strong><small>'+esc(stationSub)+'</small><em>'+esc(stationDetail)+'</em>';
    const paths={context:'M140 145C220 70 280 80 330 145',delegate:'M140 145C220 70 280 80 330 145',call:'M390 145C460 80 510 75 580 140',return:'M580 155C505 245 450 230 390 180',report:'M390 145C460 80 510 75 580 140',approval:'M390 145C460 80 510 75 580 140',handoff:'M390 145C460 80 510 75 580 140',delivery:'M390 145C460 80 510 75 580 140',done:'M390 145C460 80 510 75 580 140'};
    const d=paths[s.phase];
    $('scene-signals').innerHTML=d?'<path class="signal-rail" d="'+d+'"/><g class="signal-packet"><circle r="13" class="packet-halo"/><circle r="5" class="packet-core"/><animateMotion dur="'+Math.max(280,hold*.88)+'ms" fill="freeze" path="'+d+'"/></g><g class="signal-packet packet-two"><circle r="3" class="packet-core"/><animateMotion begin="120ms" dur="'+Math.max(280,hold*.88)+'ms" fill="freeze" path="'+d+'"/></g>':'';
    $('scene-signals').setCurrentTime(playing?0:s.phase==='done'?hold/1000:hold*.4/1000);
    if(!playing||!motion)$('scene-signals').pauseAnimations();
    $('scene-team').innerHTML=(s.roles.length>1?'<span class="team-label">协作角色</span>':'<span class="team-label">当前角色</span>')+s.roles.map(r=>'<button type="button" class="actor-chip '+(r.current?'is-current ':'')+(r.busy?'is-busy':'')+'" data-actor="'+esc(r.name)+'" title="查看'+esc(r.name)+'已发生的最新步骤"><span>'+avatar(r.name,r.busy?'thinking':'idle')+'</span><div><strong>'+esc(r.name)+'</strong><small>'+esc(r.status)+'</small></div><i></i></button>').join('');
    const past=run.events.slice(0,Math.max(0,index)).map((ev,i)=>({...ev,eventIndex:i})).filter(ev=>['complete','error','blocked','cancelled'].includes(ev.type)).slice(-3);
    $('scene-history').innerHTML=past.length?past.map(ev=>'<button type="button" data-event="'+ev.eventIndex+'" class="history-chip '+ev.type+'"><i>'+(['error','blocked'].includes(ev.type)?'!':'✓')+'</i><span>'+esc(run.nodes.find(n=>n.id===ev.node)?.label||ev.node)+'</span><small>'+(ev.at/1000).toFixed(1)+'s</small></button>').join(''):'<span class="history-empty">执行过的动作会留在这里。点击可回看当时状态。</span>';
    $('graph-live-avatar').innerHTML=avatar(s.actor,s.mood);$('graph-live-transfer').textContent=s.transfer;$('graph-live-action').textContent=s.action;$('graph-live-count').textContent=$('scene-counter').textContent;
    const format=typeof s.ev?.input==='object'?JSON.stringify(s.ev.input):String(s.ev?.input||'');
    $('scene-context').title=format||'仅展示截至当前步骤已经取得的信息。';
  }
  function playback(playing,motion){for(const id of ['scene-signals','graph-edges']){const svg=$(id);if(svg)(playing&&motion?svg.unpauseAnimations():svg.pauseAnimations());}}
  root.AgentLabTheater={render,avatar,state,delay,playback};
})(typeof globalThis!=='undefined'?globalThis:this);
