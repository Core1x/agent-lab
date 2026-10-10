(function(){
  'use strict';
  const D=window.AgentLabData,E=window.AgentLabEngine,T=window.AgentLabTheater,$=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const paths={
    play:'M6 3l12 9-12 9z',pause:'M8 4v16M16 4v16',step:'M5 4l11 8L5 20zM19 4v16',reset:'M4 9a8 8 0 1 1-1 6M4 3v6h6',
    search:'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',file:'M14 2H5v20h14V7zM14 2v6h5M8 12h8M8 16h6',code:'M8 6l-6 6 6 6M16 6l6 6-6 6M14 3l-4 18',chart:'M3 3v18h18M7 16v-4M12 16V8M17 16V5',browser:'M3 4h18v16H3zM3 9h18M6 6.5h.01M9 6.5h.01',briefcase:'M8 7V3h8v4M3 7h18v14H3zM3 12a21 21 0 0 0 18 0M10 12h4',image:'M3 3h18v18H3zM3 17l6-6 5 5 3-3 4 4M16 7h.01',agents:'M8 8a3 3 0 1 0-6 0 3 3 0 0 0 6 0M15 6a3 3 0 1 0 6 0 3 3 0 0 0-6 0M1 19v-2a4 4 0 0 1 8 0v2M15 17v-2a4 4 0 0 1 8 0v2M9 11l6-2',spark:'M12 2l2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6z',memory:'M8 3h8v3h3v12h-3v3H8v-3H5V6h3zM9 9h6v6H9zM1 9h4M1 15h4M19 9h4M19 15h4',layers:'M12 2l10 6-10 6L2 8zM2 12l10 6 10-6M2 16l10 6 10-6',compass:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M15.5 8.5l-2 5-5 2 2-5z',bolt:'M13 2L4 14h7l-1 8 10-12h-7z',user:'M16 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0M4 22v-3a8 8 0 0 1 16 0v3',save:'M3 3h15l3 3v15H3zM7 3v6h10V3M7 21v-8h10v8',shield:'M12 2l9 4v6c0 5-9 10-9 10S3 17 3 12V6zM8 12l3 3 5-6',compare:'M3 5h8v14H3zM15 5h6v14h-6zM13 3v18',grid:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',upload:'M12 16V3M7 8l5-5 5 5M3 15v6h18v-6',check:'M4 12l5 5L20 6',arrow:'M3 12h18M15 6l6 6-6 6',tool:'M14 5a5 5 0 0 0-6 6L2 17l5 5 6-6a5 5 0 0 0 6-6l-3 3-5-5 3-3z',output:'M5 3h14v18H5zM9 7h6M9 11h6M9 15h4',loop:'M4 9a8 8 0 0 1 14-4l3 3M21 3v5h-5M20 15a8 8 0 0 1-14 4l-3-3M3 21v-5h5'
  };
  const icon=name=>'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="'+(paths[name]||paths.spark)+'"/></svg>';
  function fillIcons(root=document){root.querySelectorAll('[data-icon]').forEach(el=>{el.innerHTML=icon(el.dataset.icon);});}
  let config=E.defaultConfig(),run=null,index=-1,furthest=-1,playing=false,timer=null,selected=null,tab='tools',observer='detail',speed=1,baseline=null,toastTimer=null;
  let view='theater',motionEnabled=!matchMedia('(prefers-reduced-motion: reduce)').matches;
  try{const saved=localStorage.getItem('agentlab-config-v1');if(saved)config=E.validateConfig(JSON.parse(saved));const a=localStorage.getItem('agentlab-baseline-v1');if(a)baseline=E.validateConfig(JSON.parse(a));}catch{}
  const typeLabels={model:'决策',tool:'工具调用',context:'上下文',skill:'Skill',agent:'智能体',handoff:'控制权交接',gate:'检查关卡',human:'人工介入',hook:'事件 Hook',recovery:'恢复动作',trigger:'任务入口',output:'任务结果'};
  const typeIcons={model:'spark',tool:'tool',context:'layers',skill:'file',agent:'agents',handoff:'arrow',gate:'shield',human:'user',hook:'bolt',recovery:'loop',trigger:'play',output:'output'};
  const statuses={idle:'等待执行',running:'正在执行',complete:'已完成',error:'调用异常',blocked:'执行受阻',skipped:'未选择',awaiting:'等待批准',cancelled:'已取消'};
  function persist(){try{localStorage.setItem('agentlab-config-v1',JSON.stringify(config));}catch{}}
  function toast(msg){$('toast').textContent=msg;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3500);}
  function pause(){playing=false;clearTimeout(timer);timer=null;updateControls();}
  function rebuild(){pause();if(config.faultTarget!=='auto'&&!E.effective(config).tools.includes(config.faultTarget))config.faultTarget='auto';run=E.compile(config);index=-1;furthest=-1;selected=null;persist();renderConfig();renderGraph();renderObserver();renderProgress();$('graph-scroll').scrollTop=0;}
  function change(mutator){mutator(config);rebuild();}
  function renderConfig(){
    const s=D.scenarios.find(x=>x.id===config.scenario),w=D.workflows.find(x=>x.id===config.workflow),e=E.effective(config);
    $('scenario-name').textContent=s.name;$('scenario-tag').textContent=s.tag;$('scenario-icon').innerHTML=icon(s.icon);$('scenario-number').textContent='SCENARIO '+String(D.scenarios.indexOf(s)+1).padStart(2,'0');
    $('recipe-summary').innerHTML='<span>'+esc(w.name)+'</span><em>+</em><span>'+e.tools.length+' 个工具</span><em>+</em><span>'+Object.values(e.components).filter(Boolean).length+' 个组件</span>';
    $('workflow-select').innerHTML=D.workflows.map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join('');$('workflow-select').value=config.workflow;$('workflow-desc').textContent=w.desc;
    if(document.activeElement!==$('task-input'))$('task-input').value=config.task;
    $('flow-symbol').textContent=w.symbol;$('flow-name').textContent=w.name;$('flow-subtitle').textContent=w.en.toUpperCase();
    $('tool-count').textContent=e.tools.length;
    const openGroups=new Set([...document.querySelectorAll('.tool-group[open]')].map(x=>x.dataset.group));
    if(!openGroups.size&&tab==='tools'){e.tools.map(id=>D.tools.find(t=>t.id===id).category).forEach(x=>openGroups.add(x));}
    $('tool-library').innerHTML=D.categories.map(cat=>{
      const items=D.tools.filter(t=>t.category===cat.id),enabled=items.filter(t=>e.tools.includes(t.id)).length;
      return '<details class="tool-group" data-group="'+cat.id+'" '+(openGroups.has(cat.id)?'open':'')+'><summary>'+icon(cat.icon)+esc(cat.name)+'<span class="group-count">'+enabled+'/'+items.length+'</span><span class="chevron">⌄</span></summary>'+items.map(t=>'<label class="tool-row" title="'+esc(t.desc)+'"><input type="checkbox" data-tool="'+t.id+'" '+(e.tools.includes(t.id)?'checked':'')+'><span class="tool-text">'+esc(t.name)+(e.sources[t.id]?'<small class="tool-source">'+esc(e.sources[t.id].join('、'))+'提供</small>':'')+'</span><span class="integration-badge">'+esc(t.integration)+'</span></label>').join('')+'</details>';
    }).join('');
    $('component-library').innerHTML=D.components.map(x=>'<label class="component-row"><input type="checkbox" data-component="'+x.id+'" '+(e.components[x.id]?'checked':'')+'><span><strong>'+esc(x.name)+'</strong><p>'+esc(x.desc)+'</p></span>'+icon(x.icon)+'</label>').join('');
    $('plugin-library').innerHTML=D.plugins.map(p=>'<div class="plugin-card"><label><input type="checkbox" data-plugin="'+p.id+'" '+(config.plugins.includes(p.id)?'checked':'')+'><strong>'+esc(p.name)+'</strong></label><details><summary>'+esc(p.desc)+' · 查看组成</summary><p>工具：'+p.tools.map(id=>esc(D.tools.find(t=>t.id===id).name)).join('、')+'<br>组件：'+p.components.map(id=>esc(D.components.find(t=>t.id===id).name)).join('、')+'</p></details></div>').join('');
    const fields={model:'model-select',trigger:'trigger-select',retries:'retry-select',maxLoops:'loop-select',parallelMode:'parallel-select',ragMode:'rag-select',output:'output-select'};Object.entries(fields).forEach(([key,id])=>$(id).value=String(config[key]));
    $('custom-plan-list').innerHTML=config.toolPlan.length?config.toolPlan.map((id,i)=>'<div class="plan-row"><span>'+String(i+1).padStart(2,'0')+'</span><strong>'+esc(D.tools.find(t=>t.id===id).name)+'</strong><button type="button" data-plan-up="'+i+'" aria-label="上移步骤 '+(i+1)+'" '+(i===0?'disabled':'')+'>↑</button><button type="button" data-plan-remove="'+i+'" aria-label="移除步骤 '+(i+1)+'">×</button></div>').join(''):'<p class="field-hint">当前使用场景默认步骤。</p>';
    $('plan-add-tool').innerHTML=e.tools.map(id=>'<option value="'+id+'">'+esc(D.tools.find(t=>t.id===id).name)+'</option>').join('');$('plan-add-button').disabled=!e.tools.length||config.toolPlan.length>=8;
    $('fault-select').innerHTML=D.faults.map(f=>'<option value="'+f.id+'">'+esc(f.name)+'</option>').join('');$('fault-select').value=config.fault;
    $('fault-details').hidden=config.fault==='none';$('fault-description').textContent=D.faults.find(x=>x.id===config.fault).desc;
    $('fault-target').innerHTML='<option value="auto">首个适用工具</option>'+e.tools.map(id=>'<option value="'+id+'">'+esc(D.tools.find(t=>t.id===id).name)+'</option>').join('');$('fault-target').value=e.tools.includes(config.faultTarget)?config.faultTarget:'auto';$('fault-target').disabled=config.fault==='context';
    $('config-footer-text').textContent=e.tools.length+' 个工具 · '+Object.values(e.components).filter(Boolean).length+' 个组件可用';
  }
  function renderGraph(){
    const groups=new Map();for(const n of run.nodes){if(!groups.has(n.row))groups.set(n.row,[]);groups.get(n.row).push(n);}
    $('graph-nodes').innerHTML=[...groups.entries()].sort((a,b)=>a[0]-b[0]).map(([row,nodes])=>'<div class="graph-row" data-row="'+row+'">'+nodes.map(n=>'<button class="graph-node type-'+n.type+'" id="node-'+n.id+'" data-node="'+n.id+'" type="button" aria-label="'+esc(n.label)+'，'+esc(typeLabels[n.type])+'"><span class="node-icon '+(n.type==='agent'||['decide','supervisor','manager_answer','expert_answer'].includes(n.id)?'node-avatar':'')+'">'+(n.type==='agent'||['decide','supervisor','manager_answer','expert_answer'].includes(n.id)?T.avatar(n.agent||'主智能体'):icon(typeIcons[n.type]))+'</span><span class="node-label"><strong>'+esc(n.label)+'</strong><small>'+esc(n.integration?(n.toolName&&n.toolName!==n.label?n.toolName+' · ':'')+n.integration:typeLabels[n.type])+'</small></span><span class="node-dot"></span></button>').join('')+'</div>').join('');
    requestAnimationFrame(drawEdges);updateNodes();
  }
  function drawEdges(){
    if(!run||$('graph-scroll').hidden)return;const board=$('graph-board'),box=board.getBoundingClientRect(),svg=$('graph-edges'),snap=E.snapshot(run,index);
    svg.setAttribute('viewBox','0 0 '+board.clientWidth+' '+board.scrollHeight);svg.style.height=board.scrollHeight+'px';
    const defs=svg.querySelector('defs').outerHTML;
    svg.innerHTML=defs+run.edges.map(edge=>{
      const a=$('node-'+edge.from),b=$('node-'+edge.to);if(!a||!b)return '';
      const ra=a.getBoundingClientRect(),rb=b.getBoundingClientRect(),same=Math.abs(ra.top-rb.top)<8,loop=edge.kind==='loop'||edge.kind==='retry';
      let ax=ra.left-box.left+ra.width/2,ay=ra.bottom-box.top,bx=rb.left-box.left+rb.width/2,by=rb.top-box.top,d;
      if(loop){const right=board.clientWidth-12;ax=ra.right-box.left;ay=ra.top-box.top+ra.height/2;bx=rb.right-box.left;by=rb.top-box.top+rb.height/2;d='M'+ax+' '+ay+' C'+right+' '+ay+' '+right+' '+by+' '+bx+' '+by;}
      else if(same){ax=ra.right-box.left;ay=ra.top-box.top+ra.height/2;bx=rb.left-box.left;by=rb.top-box.top+rb.height/2;d='M'+ax+' '+ay+' L'+bx+' '+by;}
      else{const mid=(ay+by)/2;d='M'+ax+' '+ay+' C'+ax+' '+mid+' '+bx+' '+mid+' '+bx+' '+by;}
      const active=snap.states[edge.to]?.status==='running'&&snap.states[edge.from]?.status==='complete',done=snap.states[edge.from]?.status==='complete';
      return '<path d="'+d+'" class="graph-edge '+(edge.kind?'edge-'+edge.kind+' ':'')+(active?'edge-active':done?'edge-complete':'')+'"/>'+(active?'<g class="graph-packet"><circle r="8" fill="#2875eb" opacity=".15"/><circle r="3.5" fill="#2875eb"/><animateMotion dur="'+Math.max(450,1100/speed)+'ms" repeatCount="indefinite" path="'+d+'"/></g>':'');
    }).join('');
    svg.setCurrentTime(0);
    T.playback(playing,motionEnabled);
  }
  function updateNodes(){
    const snap=E.snapshot(run,index);
    for(const n of run.nodes){const el=$('node-'+n.id);if(!el)continue;const state=snap.states[n.id],current=n.id===snap.active;el.className='graph-node type-'+n.type+' status-'+state.status+(selected===n.id?' selected':'')+(current?' is-current':'');el.setAttribute('aria-label',n.label+'，'+statuses[state.status]);el.querySelectorAll('.node-attempts,.node-current-tag').forEach(x=>x.remove());if(state.attempts>1){const tag=document.createElement('span');tag.className='node-attempts';tag.textContent='×'+state.attempts;el.append(tag);}if(current){const tag=document.createElement('span');tag.className='node-current-tag';tag.textContent=statuses[state.status];el.append(tag);}const face=el.querySelector('.node-avatar'),mood=state.status==='running'?'thinking':state.status==='complete'?'success':['error','blocked'].includes(state.status)?'error':'idle';if(face&&face.dataset.mood!==mood){face.innerHTML=T.avatar(n.agent||'主智能体',mood);face.dataset.mood=mood;}}
    T.render(run,index,playing,speed,motionEnabled);
    requestAnimationFrame(drawEdges);
  }
  function updateControls(){
    if(!run)return;
    const ev=run.events[index],awaiting=ev?.type==='approval',ended=index>=run.events.length-1&&!awaiting;
    $('run-label').textContent=playing?'暂停':awaiting?'等待确认':ended?'再运行一次':index<0?'开始模拟':'继续模拟';$('run-button').disabled=awaiting;$('run-button').querySelector('[data-icon]').innerHTML=icon(playing?'pause':'play');
    $('step-button').disabled=awaiting||ended;
    const status=playing?'running':awaiting?'awaiting':ended?run.status:index<0?'ready':'paused';
    $('live-indicator').textContent={running:'RUNNING',awaiting:'WAITING',complete:'COMPLETE',blocked:'BLOCKED',cancelled:'CANCELLED',ready:'READY',paused:'PAUSED'}[status]||'READY';$('live-indicator').className='live-indicator '+status;
    $('approval-card').hidden=!awaiting;
    T.render(run,index,playing,speed,motionEnabled);T.playback(playing,motionEnabled);
  }
  function renderProgress(){
    const snap=E.snapshot(run,index);$('metric-tools').textContent=String(snap.toolCalls).padStart(2,'0');$('metric-models').textContent=String(snap.modelCalls).padStart(2,'0');$('metric-time').innerHTML=(snap.at/1000).toFixed(1)+'<span>s</span>';
    $('trace-count').textContent=index+1;$('replay-range').max=Math.max(1,furthest+1);$('replay-range').value=index+1;$('replay-range').disabled=furthest<0;
    $('replay-position').textContent=(index+1)+' / '+run.events.length;$('replay-label').textContent=index<0?'等待运行':run.events[index]?.type==='approval'?'等待确认':index<run.events.length-1?'步骤回放':'运行结束';updateControls();
  }
  function readyDetail(){
    const e=E.effective(config),w=D.workflows.find(x=>x.id===config.workflow);
    return '<div class="detail-hero"><span class="detail-icon">'+icon('compass')+'</span><div class="eyebrow">YOUR EXPERIMENT IS READY</div><h3>从一个动作开始。</h3><p>运行后，在这里查看每一步的输入、动作和结果。</p></div><ul class="ready-checklist"><li><span class="check">✓</span>'+esc(w.name)+'已装载</li><li><span class="check">✓</span>'+e.tools.length+' 个工具可用</li><li><span class="check">✓</span>'+Object.values(e.components).filter(Boolean).length+' 个组件已选配</li></ul><div class="detail-note">试着移除一个工具，或在画布上方注入故障。观察相同任务会走向哪条路径。</div>'+run.warnings.map(x=>'<p class="warning">'+esc(x)+'</p>').join('');
  }
  function renderObserver(){
    const snap=E.snapshot(run,index),id=selected||snap.active,n=run.nodes.find(x=>x.id===id);
    if(!n)$('step-detail').innerHTML=readyDetail();
    else{
      const st=snap.states[id],format=v=>typeof v==='object'?JSON.stringify(v,null,2):String(v);
      $('step-detail').innerHTML='<div class="detail-hero"><span class="detail-icon">'+icon(typeIcons[n.type])+'</span><div class="eyebrow">'+esc(typeLabels[n.type].toUpperCase())+' · '+esc(n.agent||snap.owner)+'</div><h3>'+esc(n.label)+'</h3><p>'+esc(n.detail||'当前步骤将把结果交给后续节点。')+'</p></div><div class="detail-section"><h4>当前状态 <span class="detail-status '+st.status+'">'+esc(statuses[st.status])+'</span></h4><p>'+esc(st.detail||'尚未执行。开始模拟或单步执行后查看实际记录。')+'</p></div>'+(st.input!==undefined?'<div class="detail-section"><h4>输入'+(n.integration?'<span>'+esc(n.integration)+'</span>':'')+'</h4><pre>'+esc(format(st.input))+'</pre></div>':'')+(st.output!==undefined?'<div class="detail-section"><h4>输出</h4><pre>'+esc(format(st.output))+'</pre></div>':'')+'<div class="detail-note">'+esc(conceptNote(n))+'</div>';
    }
    const visible=run.events.slice(0,index+1);
    $('trace-list').innerHTML=visible.length?visible.map((ev,i)=>'<button class="trace-item '+ev.type+'" data-event="'+i+'" type="button"><span class="trace-marker"></span><span><strong>'+esc(run.nodes.find(n=>n.id===ev.node)?.label||ev.node)+'</strong><small>'+(ev.at/1000).toFixed(1)+'s</small><p>'+esc(ev.detail)+'</p><span class="trace-agent">'+esc(ev.agent||'主智能体')+' · '+esc({start:'开始',complete:'完成',error:'异常',blocked:'受阻',approval:'待确认',skipped:'跳过',cancelled:'取消'}[ev.type])+'</span></span></button>').join(''):'<div class="detail-note">尚未执行。工具调用、上下文变化和控制权交接都会记录在这里。</div>';
    renderResult();
  }
  function conceptNote(n){
    const notes={context:'上下文是模型当前看到的信息。长期记忆跨任务保存，检查点保存执行状态。',skill:'Skill 提供方法与参考材料；运行其中的脚本仍需要执行工具。',tool:'工具输入输出是可观察事件。接入方式与工具用途分别标注，MCP 也可提供资源与提示模板。',agent:'独立分支有自己的任务上下文。只有任务摘要与结果会进入汇总步骤。',handoff:'接管转移后续答复责任；主管委派则保留主管的答复责任。',human:'用户可批准、修改后批准或拒绝。等待期间不会执行后续动作。',hook:'Hook 由匹配的事件触发；Skill 则作为方法加载并应用。',gate:'验收规则与检查结果参与流程控制；评审不通过时可以继续修订。',recovery:'重试用于短暂异常。权限拒绝需要更改授权，不能靠反复调用解决。',output:'产物内容来自场景规则，均为教学模拟，可下载查看。',trigger:'定时和 Webhook 是任务入口；本页面只模拟事件，不注册实际后台任务。',model:'展示的是高层动作说明与可观察结果，耗时为模拟值。'};return notes[n.type]||notes.model;
  }
  function renderResult(){
    const ended=index>=run.events.length-1&&run.events[index]?.type!=='approval';
    if(!ended){$('result-content').innerHTML='<div class="detail-hero"><span class="detail-icon">'+icon('output')+'</span><div class="eyebrow">FOLLOW THE PROCESS</div><h3>结果正在形成。</h3><p>完成执行后，查看产物与验收结果。回放时只展示当时已完成的状态。</p></div>';return;}
    const ok=run.status==='complete';
    $('result-content').innerHTML='<div class="result-icon" style="'+(!ok?'background:#fff5ef;color:#b9906d':'')+'">'+icon(ok?'check':'shield')+'</div><div class="eyebrow">SIMULATED RESULT</div><h3 class="result-heading">'+(ok?'这次任务，完成了。':run.status==='cancelled'?'任务已取消。':'执行暂时受阻。')+'</h3><p class="result-text">'+esc(run.result)+'</p>'+(run.artifact?'<div class="artifact-item">'+icon('file')+'<span>'+esc(run.artifact)+'</span><button id="download-artifact" type="button">下载 ↗</button></div>':'')+'<div class="result-actions"><button class="button button-white" id="download-trace" type="button">下载执行记录</button>'+(run.canResume?'<button class="button button-primary" id="resume-button" type="button">从检查点恢复</button>':'')+'</div>'+run.warnings.map(x=>'<p class="warning">'+esc(x)+'</p>').join('');
  }
  function advance(scroll=true){
    if(index>=run.events.length-1)return false;
    index++;furthest=Math.max(furthest,index);selected=null;updateNodes();renderObserver();renderProgress();
    const ev=run.events[index];
    if(scroll&&view==='graph'){
      const el=$('node-'+ev.node),container=$('graph-scroll');if(el){const r=el.getBoundingClientRect(),c=container.getBoundingClientRect();if(r.top<c.top+25||r.bottom>c.bottom-25)container.scrollTo({top:container.scrollTop+r.top-c.top-100,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
    }
    if(ev.type==='approval'){pause();$('live-announcement').textContent='需要用户确认模拟动作。';return false;}
    if(index===run.events.length-1){pause();$('live-announcement').textContent='模拟结束：'+statuses[run.status];setObserver('result');return false;}
    return true;
  }
  function tick(){if(!playing)return;if(!advance())return;timer=setTimeout(tick,T.delay(run.events[index],run.events[index+1],speed));}
  function start(){if(run.events[index]?.type==='approval')return;if(index>=run.events.length-1){run=E.compile(config);index=-1;furthest=-1;selected=null;renderGraph();}playing=true;updateControls();tick();}
  function setTab(name){tab=name;for(const x of ['tools','components','strategy']){$(x+'-panel').hidden=x!==name;$('tab-'+x).setAttribute('aria-selected',String(x===name));}}
  function setObserver(name){observer=name;for(const x of ['detail','trace','result']){$(x+'-panel').hidden=x!==name;$('observer-'+x).setAttribute('aria-selected',String(x===name));}}
  function setView(name){view=name;$('agent-theater').hidden=name!=='theater';$('graph-scroll').hidden=name!=='graph';$('graph-live').hidden=name!=='graph';$('graph-legend').hidden=name!=='graph';for(const x of ['theater','graph'])$('view-'+x).setAttribute('aria-selected',String(x===name));requestAnimationFrame(drawEdges);}
  function download(name,content,type='application/json'){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function showDialog(id){pause();$(id).showModal();}
  function renderScenarios(){
    $('scenario-grid').innerHTML=D.scenarios.map((s,i)=>'<button type="button" class="scenario-card '+(s.id===config.scenario?'current':'')+'" data-scenario="'+s.id+'"><span>'+icon(s.icon)+'</span><div><strong>'+esc(s.name)+'</strong><small>'+esc(s.tag)+'</small><em>'+String(i+1).padStart(2,'0')+' / '+esc(D.workflows.find(w=>w.id===s.workflow).en.toUpperCase())+'</em></div><b class="scenario-arrow">↗</b></button>').join('');
  }
  function saveA(){baseline=E.copy(config);try{localStorage.setItem('agentlab-baseline-v1',JSON.stringify(baseline));}catch{}$('compare-dialog').close();toast('配置 A 已保存。修改配置后再次打开对比。');}
  function renderCompare(){
    if(!baseline){$('compare-content').innerHTML='<div class="compare-intro"><p>先把当前配置保存为 A。然后更换工具、组件或工作流，再打开这里。</p><button class="button button-primary" id="save-a" type="button">保存当前配置为 A</button></div>';return;}
    const a={...E.copy(baseline),task:config.task,scenario:config.scenario},b=E.copy(config),runs=[E.compile(a),E.compile(b)],effective=[E.effective(a),E.effective(b)];
    const card=(r,i)=>'<div class="compare-card"><div class="eyebrow">CONFIGURATION '+(i?'B · 当前配置':'A · 保存的配置')+'</div><h3>'+esc(D.workflows.find(w=>w.id===r.config.workflow).name)+'</h3><p>'+esc(config.task)+'</p><div class="compare-chips">'+effective[i].tools.map(id=>'<span>'+esc(D.tools.find(t=>t.id===id).name)+'</span>').join('')+'</div><p>'+Object.entries(effective[i].components).filter(([,v])=>v).map(([id])=>esc(D.components.find(x=>x.id===id).name)).join(' · ')+'</p><div class="compare-stat-row"><div><strong>'+r.metrics.toolCalls+'</strong>工具调用</div><div><strong>'+r.nodes.length+'</strong>流程节点</div><div><strong>'+(r.metrics.duration/1000).toFixed(1)+'s</strong>模拟耗时</div></div><div class="compare-result"><p><strong>'+({complete:'完成',blocked:'受阻',awaiting:'等待人工决定',cancelled:'已取消'}[r.status])+'</strong> · '+esc(r.summary||'等待用户确认后才能继续。')+'</p></div></div>';
    const added=effective[1].tools.filter(id=>!effective[0].tools.includes(id)),removed=effective[0].tools.filter(id=>!effective[1].tools.includes(id)),changed=D.components.filter(x=>effective[0].components[x.id]!==effective[1].components[x.id]);
    const diffs=[...(a.workflow!==b.workflow?['工作流由 '+D.workflows.find(x=>x.id===a.workflow).name+' 改为 '+D.workflows.find(x=>x.id===b.workflow).name]:[]),...(added.length?['新增工具：'+added.map(id=>D.tools.find(t=>t.id===id).name).join('、')]:[]),...(removed.length?['移除工具：'+removed.map(id=>D.tools.find(t=>t.id===id).name).join('、')]:[]),...(changed.length?['组件变化：'+changed.map(x=>x.name).join('、')]:[]),...(a.fault!==b.fault?['故障注入条件已改变']:[]),...(a.model!==b.model?['模型策略已改变']:[]),...(['retries','maxLoops','ragMode','output','parallelMode','trigger'].some(k=>a[k]!==b[k])?['执行策略已改变']:[])];
    $('compare-content').innerHTML='<div class="compare-grid">'+runs.map(card).join('')+'</div><div class="compare-diff">'+(diffs.length?diffs.map(esc).join('<br>'):'两套配置当前相同。修改工具或组件，再比较实际执行差异。')+'<br><small>使用同一任务与场景。统计为规则模拟值；等待人工介入时仅统计到暂停点。</small></div><div class="compare-controls"><button class="button button-white" id="save-a" type="button">用当前配置更新 A</button><button class="button button-white" id="load-a" type="button">加载配置 A</button><button class="button button-primary" id="close-compare" type="button">返回实验</button></div>';
  }
  function approve(action){
    const ev=run.events[index];if(ev?.type!=='approval')return;const note=$('approval-note').value.trim();
    const resolved=E.resolveApproval(run,index,{action:action==='reject'?'reject':note?'edit':'approve',note});
    run=resolved.run;index=resolved.index;furthest=Math.max(furthest,index);selected=null;$('approval-note').value='';$('live-announcement').textContent=action==='reject'?'已拒绝本次模拟动作。':'已批准，继续模拟执行。';renderGraph();renderObserver();renderProgress();
    if(index<run.events.length-1)start();else{setObserver('result');toast(action==='reject'?'后续模拟动作已取消。':'决定已记录。');}
  }
  document.addEventListener('change',ev=>{
    const target=ev.target;
    if(target.dataset.tool)change(c=>c.toolOverrides[target.dataset.tool]=target.checked);
    if(target.dataset.component)change(c=>c.componentOverrides[target.dataset.component]=target.checked);
    if(target.dataset.plugin)change(c=>{const p=D.plugins.find(x=>x.id===target.dataset.plugin);if(target.checked){c.plugins.push(p.id);p.tools.forEach(id=>delete c.toolOverrides[id]);p.components.forEach(id=>delete c.componentOverrides[id]);}else c.plugins=c.plugins.filter(id=>id!==p.id);});
  });
  const bindings={'workflow-select':'workflow','model-select':'model','trigger-select':'trigger','retry-select':'retries','loop-select':'maxLoops','parallel-select':'parallelMode','rag-select':'ragMode','output-select':'output','fault-select':'fault','fault-target':'faultTarget'};
  for(const [id,key] of Object.entries(bindings))$(id).addEventListener('change',()=>change(c=>c[key]=['retries','maxLoops'].includes(key)?Number($(id).value):$(id).value));
  $('task-input').addEventListener('change',()=>{const value=$('task-input').value.trim();if(!value){$('task-input').value=config.task;toast('任务不能为空。');return;}change(c=>c.task=value);});
  $('speed-select').addEventListener('change',()=>{speed=Number($('speed-select').value);T.render(run,index,playing,speed,motionEnabled);});
  $('motion-toggle').checked=motionEnabled;$('motion-toggle').addEventListener('change',()=>{motionEnabled=$('motion-toggle').checked;T.render(run,index,playing,speed,motionEnabled);T.playback(playing,motionEnabled);});
  document.querySelectorAll('[data-view]').forEach(el=>el.addEventListener('click',()=>setView(el.dataset.view)));
  $('plan-add-button').addEventListener('click',()=>{const id=$('plan-add-tool').value;if(id&&config.toolPlan.length<8)change(c=>c.toolPlan.push(id));});
  $('plan-clear').addEventListener('click',()=>change(c=>c.toolPlan=[]));
  $('custom-plan-list').addEventListener('click',ev=>{const remove=ev.target.closest('[data-plan-remove]'),up=ev.target.closest('[data-plan-up]');if(remove)change(c=>c.toolPlan.splice(Number(remove.dataset.planRemove),1));if(up)change(c=>{const i=Number(up.dataset.planUp);if(i>0)[c.toolPlan[i-1],c.toolPlan[i]]=[c.toolPlan[i],c.toolPlan[i-1]];});});
  $('run-button').addEventListener('click',()=>playing?pause():start());$('step-button').addEventListener('click',()=>{pause();advance();});$('restart-button').addEventListener('click',()=>{rebuild();setObserver('detail');$('graph-scroll').scrollTop=0;});
  $('reset-config').addEventListener('click',()=>{config=E.defaultConfig(config.scenario);rebuild();toast('已恢复本场景的预设配置。');});
  $('replay-range').addEventListener('input',()=>{pause();index=Number($('replay-range').value)-1;selected=null;updateNodes();renderObserver();renderProgress();});
  document.querySelectorAll('[data-tab]').forEach(el=>el.addEventListener('click',()=>setTab(el.dataset.tab)));document.querySelectorAll('[data-observer]').forEach(el=>el.addEventListener('click',()=>setObserver(el.dataset.observer)));
  $('graph-nodes').addEventListener('click',ev=>{const el=ev.target.closest('[data-node]');if(!el)return;selected=el.dataset.node;updateNodes();renderObserver();setObserver('detail');});
  $('trace-list').addEventListener('click',ev=>{const el=ev.target.closest('[data-event]');if(!el)return;pause();index=Number(el.dataset.event);selected=run.events[index].node;updateNodes();renderObserver();renderProgress();setObserver('detail');});
  $('scene-history').addEventListener('click',ev=>{const el=ev.target.closest('[data-event]');if(!el)return;pause();index=Number(el.dataset.event);selected=run.events[index].node;updateNodes();renderObserver();renderProgress();setObserver('detail');});
  $('scene-team').addEventListener('click',ev=>{const el=ev.target.closest('[data-actor]');if(!el)return;const past=run.events.slice(0,index+1).filter(x=>(x.agent||'主智能体')===el.dataset.actor);if(!past.length){toast('这个角色还没有执行记录。');return;}selected=past.at(-1).node;updateNodes();renderObserver();setObserver('detail');});
  $('scenarios-button').addEventListener('click',()=>{renderScenarios();showDialog('scenarios-dialog');});$('scenario-grid').addEventListener('click',ev=>{const el=ev.target.closest('[data-scenario]');if(!el)return;config=E.defaultConfig(el.dataset.scenario);$('scenarios-dialog').close();rebuild();setObserver('detail');$('graph-scroll').scrollTop=0;});
  $('guide-button').addEventListener('click',()=>showDialog('guide-dialog'));$('guide-start').addEventListener('click',()=>$('guide-dialog').close());
  $('sources-button').addEventListener('click',()=>{ $('sources-list').innerHTML=D.sources.map(([title,source,url])=>'<a class="source-row" href="'+url+'" target="_blank" rel="noopener noreferrer"><strong>'+esc(title)+'</strong><span>'+esc(source)+' ↗</span></a>').join('');showDialog('sources-dialog');});
  document.querySelectorAll('[data-close]').forEach(el=>el.addEventListener('click',()=>el.closest('dialog').close()));
  document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',ev=>{if(ev.target===dialog){const r=dialog.getBoundingClientRect();if(ev.clientX<r.left||ev.clientX>r.right||ev.clientY<r.top||ev.clientY>r.bottom)dialog.close();}}));
  $('compare-button').addEventListener('click',()=>{renderCompare();showDialog('compare-dialog');});$('compare-content').addEventListener('click',ev=>{if(ev.target.closest('#save-a'))saveA();if(ev.target.closest('#load-a')){config=E.copy(baseline);$('compare-dialog').close();rebuild();toast('已加载保存的配置 A。');}if(ev.target.closest('#close-compare'))$('compare-dialog').close();});
  $('export-button').addEventListener('click',()=>{download('agent-lab-'+config.scenario+'.json',JSON.stringify(config,null,2));toast('配置已导出，可在另一台设备导入。');});$('import-button').addEventListener('click',()=>$('import-file').click());
  $('import-file').addEventListener('change',async()=>{const file=$('import-file').files[0];if(!file)return;try{if(file.size>100000)throw Error('文件过大，请导入小于 100 KB 的配置。');const next=E.validateConfig(JSON.parse(await file.text()));config=next;rebuild();toast('配置已导入。');}catch(error){toast('导入失败：'+error.message);}finally{$('import-file').value='';}});
  $('approve-button').addEventListener('click',()=>approve('approve'));$('reject-button').addEventListener('click',()=>approve('reject'));
  $('result-content').addEventListener('click',ev=>{
    if(ev.target.closest('#download-artifact'))download(run.artifact,'# Agent Lab 教学模拟产物\n\n任务：'+run.config.task+'\n\n'+run.result+'\n\n说明：本文件来自情景模拟，未操作真实工具。','text/plain;charset=utf-8');
    if(ev.target.closest('#download-trace'))download('agent-lab-trace.json',JSON.stringify({simulated:true,config:run.config,status:run.status,events:run.events,result:run.result},null,2));
    if(ev.target.closest('#resume-button'))try{const resumed=E.resume(run);pause();run=resumed.run;index=resumed.index;furthest=index;selected=null;renderGraph();renderObserver();renderProgress();setObserver('detail');start();}catch(error){toast(error.message);}
  });
  document.addEventListener('keydown',ev=>{
    if(['INPUT','TEXTAREA','SELECT'].includes(ev.target.tagName)||document.querySelector('dialog[open]'))return;
    if(ev.key==='?'){ev.preventDefault();showDialog('guide-dialog');}
    if(ev.code==='Space'&&!['BUTTON','A'].includes(ev.target.tagName)){ev.preventDefault();playing?pause():start();}
  });
  function setupTabKeys(selector,select){const tabs=[...document.querySelectorAll(selector)];tabs.forEach((el,i)=>el.addEventListener('keydown',ev=>{if(ev.key==='ArrowRight'||ev.key==='ArrowLeft'){ev.preventDefault();const next=tabs[(i+(ev.key==='ArrowRight'?1:tabs.length-1))%tabs.length];next.focus();select(next);}}));}
  setupTabKeys('[data-tab]',el=>setTab(el.dataset.tab));setupTabKeys('[data-observer]',el=>setObserver(el.dataset.observer));
  setupTabKeys('[data-view]',el=>setView(el.dataset.view));
  fillIcons();rebuild();new ResizeObserver(()=>requestAnimationFrame(drawEdges)).observe($('graph-board'));
})();
