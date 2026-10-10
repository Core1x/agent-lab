(function(root){
  'use strict';
  const D=typeof module!=='undefined'&&module.exports?require('./data.js'):root.AgentLabData;
  const copy=v=>JSON.parse(JSON.stringify(v));
  const findTool=id=>D.tools.find(t=>t.id===id);
  function defaultConfig(id='research'){
    const s=D.scenarios.find(x=>x.id===id)||D.scenarios[0];
    return {version:1,scenario:s.id,workflow:s.workflow,task:s.task,model:'balanced',tools:[...s.tools],toolPlan:[],plugins:[],toolOverrides:{},components:{...D.defaults,...s.components},componentOverrides:{},retries:1,maxLoops:3,parallelMode:'section',ragMode:'agentic',output:'text',fault:'none',faultTarget:'auto',trigger:s.id==='automation'?'webhook':'manual'};
  }
  function effective(c){
    const ids=new Set(c.tools), components={...c.components},sources={};
    for(const id of c.plugins){const p=D.plugins.find(x=>x.id===id);if(!p)continue;for(const t of p.tools){ids.add(t);(sources[t]??=[]).push(p.name);}for(const x of p.components)components[x]=true;}
    for(const [id,v] of Object.entries(c.toolOverrides||{})){if(v)ids.add(id);else ids.delete(id);}
    Object.assign(components,c.componentOverrides||{});
    return {tools:[...ids].filter(findTool),components,sources};
  }
  function validateConfig(input){
    if(!input||typeof input!=='object'||Array.isArray(input))throw Error('配置必须是 JSON 对象。');
    if(input.version!==1)throw Error('配置版本不兼容，请导入本版本导出的文件。');
    if(!D.scenarios.some(x=>x.id===input.scenario))throw Error('未知任务场景。');
    if(!D.workflows.some(x=>x.id===input.workflow))throw Error('未知工作流。');
    const c=defaultConfig(input.scenario);
    for(const key of ['model','parallelMode','ragMode','output','fault','trigger']){
      const allowed={model:['balanced','fast','multimodal'],parallelMode:['section','vote'],ragMode:['agentic','fixed'],output:['text','json'],fault:D.faults.map(f=>f.id),trigger:['manual','schedule','webhook']}[key];
      if(input[key]!==undefined&&!allowed.includes(input[key]))throw Error('无效的配置选项：'+key);
      if(input[key]!==undefined)c[key]=input[key];
    }
    if(typeof input.task!=='string'||!input.task.trim()||input.task.length>3000)throw Error('任务文字需为 1–3000 字。');
    c.task=input.task.trim();
    for(const [key,list] of [['tools',D.tools],['plugins',D.plugins]]){
      if(!Array.isArray(input[key])||input[key].length>50||input[key].some(x=>!list.some(t=>t.id===x)))throw Error('工具或插件列表包含未知项目。');
      c[key]=[...new Set(input[key])];
    }
    if(input.toolPlan!==undefined){if(!Array.isArray(input.toolPlan)||input.toolPlan.length>8||input.toolPlan.some(id=>!findTool(id)))throw Error('自定义工具步骤无效，最多支持 8 步。');c.toolPlan=[...input.toolPlan];}
    for(const [key,list] of [['components',D.components],['componentOverrides',D.components],['toolOverrides',D.tools]]){
      const values=input[key]||{};if(typeof values!=='object'||Array.isArray(values))throw Error('无效的组件配置。');
      for(const [id,v] of Object.entries(values)){if(!list.some(t=>t.id===id)||typeof v!=='boolean')throw Error('无效的组件或工具开关。');c[key][id]=v;}
    }
    for(const key of ['retries','maxLoops']){
      const v=input[key]??c[key],max=key==='retries'?3:5,min=key==='retries'?0:1;
      if(!Number.isInteger(v)||v<min||v>max)throw Error('重试或循环次数超出范围。');c[key]=v;
    }
    c.faultTarget=input.faultTarget==='auto'||findTool(input.faultTarget)?input.faultTarget:'auto';
    c.workflow=input.workflow;
    return c;
  }
  const sampleOutput=(tool,s)=>{
    const outputs={
      web_search:'找到 3 条模拟资料，已标记标题、摘要和来源。',page_read:'已提取 2 篇模拟页面正文，保留来源标识。',kb_search:'找到 2 段模拟知识条款及文档位置。',vector_search:'匹配到 2 个相关文档片段，返回原文位置。',rerank:'候选片段已按相关性排序，保留前 2 项。',tool_search:'已加载当前任务需要的工具参数定义。',
      read_file:'已读取示例素材，共 3 个章节。',write_file:'已写入模拟工作区文件，生成修改记录。',pdf_parse:'已提取示例 PDF 中的 3 页文字及页码。',sheet_read:'已读取示例工作表的 12 行数据。',report_generate:'已整理产物：'+s.artifact,code_search:'定位到 parseInput 中缺少空输入分支。',symbol_query:'诊断指出空输入分支可能访问未定义字段。',apply_patch:'模拟补丁已更新输入校验与返回值。',git_status:'模拟工作区有 1 个文件修改。',run_tests:'模拟测试结果：5/5 通过。',
      calculator:'工作量计算完成：3 个阶段，共 12 个示例人日。',sql_query:'查询返回 12 条模拟记录。',python_exec:'模拟沙箱已完成数据聚合。',js_exec:'模拟脚本已完成数据转换。',chart_render:'已生成模拟图表数据。',browser_read:'观察到示例页面中的标题、表格与按钮。',browser_click:'已完成一次模拟点击，并观察新的页面状态。',screenshot:'已记录示例界面状态。',mail_search:'找到 2 封模拟相关邮件。',mail_send:'模拟邮件已发送；未连接真实邮箱。',calendar:'已创建一条模拟日程。',ticket:'已读取示例工单的状态、描述与处理记录。',crm:'已查询模拟客户与服务记录。',order:'模拟订单 A-1024：退款处理中。',vision:'示例图片包含表格与标题，已提取结构。',ocr:'已从示例图片提取 3 段文字。',asr:'已返回示例语音的文字转写。',tts:'已生成模拟语音产物记录。',image_generate:'已生成模拟图像产物记录。',subagent:'子智能体返回摘要，保留独立上下文。',remote_agent:'远程智能体通过模拟 A2A 任务返回产物。'
    };return outputs[tool.id]||'模拟工具执行完成。';
  };
  function compile(config,options={}){
    const c=validateConfig(config), s=D.scenarios.find(x=>x.id===c.scenario), e=effective(c), cp=e.components;
    const nodes=[],edges=[],events=[],decisions=options.decisions||{};
    let previous=[],row=-1,time=0,seq=0,terminal=null,faultUsed=false,approvalPending=false,loops=0,currentAgent='主智能体',activeOwner='主智能体',approvedNote='';
    let output='',toolCalls=0,modelCalls=0,checkpoint=null,recoverable=false;
    const speed=c.model==='fast'?0.65:c.model==='multimodal'?1.2:1;
    function add(id,label,type='model',detail='',extra={}){const n={id,label,type,detail,row:++row,...extra};nodes.push(n);for(const p of previous)edges.push({from:p,to:id});previous=[id];return n;}
    function event(node,type,detail,data={}){events.push({id:'e'+seq++,node:node.id,type,detail,at:Math.round(time),agent:node.agent||currentAgent,...data});}
    function activity(n,detail,duration=560,data={}){
      event(n,'start',n.detail||detail,{input:c.task.slice(0,150),...data});if(n.type==='model'||n.type==='agent')modelCalls++;
      time+=Math.round(duration*speed);event(n,'complete',detail,{output:detail,...data});
      if(cp.checkpoint){checkpoint={node:n.id,eventIndex:events.length-1,at:time};}
    }
    function model(id,label,detail,type='model',extra={}){if(terminal||approvalPending)return null;const n=add(id,label,type,detail,extra);activity(n,detail,720,extra.input?{input:extra.input}:{});return n;}
    function fail(n,detail){terminal='blocked';output=detail;event(n,'blocked',detail,{output:detail});}
    function approve(label='确认交付',id='approval'){
      if(terminal||approvalPending)return false;
      const base=id;let occurrence=1;while(nodes.some(n=>n.id===id))id=base+'_'+(++occurrence);
      const pending=findTool(base.replace(/^approve_/,''));
      const preview=pending?{tool:pending.id,arguments:{task:c.task.slice(0,180),scenario:s.id},...(pending.id==='mail_send'?{draft:'关于当前工单的处理说明：已查阅模拟规定，预计处理时间可在修改说明中补充。'}:{})}:output||'任务草稿与当前调用参数';
      const n=add(id,label,'human','等待用户检查待执行动作。');event(n,'start','准备待确认内容。',{input:preview});time+=180;
      const choice=decisions[id];
      if(!choice){event(n,'approval','请批准、修改后批准或拒绝本次模拟动作。');approvalPending=true;return false;}
      if(choice.action==='reject'){event(n,'cancelled','用户拒绝本次动作，后续执行已取消。');terminal='cancelled';output='已取消交付或外部写入。保留此前的模拟工作记录。';return false;}
      approvedNote=choice.note||'';event(n,'complete',choice.action==='edit'?'已按用户修改内容批准。':'用户已批准本次模拟动作。',{output:choice.note||'批准',edited:choice.action==='edit'});time+=220;return true;
    }
    function resolve(id,exclude=[]){const desired=findTool(id);if(!desired)return null;const selected=e.tools.map(findTool).filter(t=>!exclude.includes(t.id));return selected.find(t=>t.id===id)||selected.find(t=>t.capability===desired.capability)||null;}
    function call(n,desired){
      if(terminal||approvalPending)return false;
      let t=resolve(desired);n.toolId=t?.id||desired;n.toolName=t?.name||findTool(desired)?.name;n.integration=t?.integration||findTool(desired)?.integration;n.agent=n.agent||currentAgent;
      if(!t){event(n,'start','检查工具可用性。');time+=180;fail(n,'缺少「'+(findTool(desired)?.name||desired)+'」或同用途工具。请在工具库中启用后重新运行。');return false;}
      if(['vision','audio'].includes(t.capability)&&c.model!=='multimodal'&&t.integration==='模型'){event(n,'start','检查模型输入能力。');fail(n,'当前模型策略不能处理此类输入。请选择多模态策略或启用同用途的处理工具。');return false;}
      let inject=null;
      const eligible=c.fault==='empty'?['web','page','knowledge'].includes(t.capability):true;
      if(!faultUsed&&c.fault!=='none'&&c.fault!=='context'&&eligible&&(c.faultTarget==='auto'||c.faultTarget===t.id)){faultUsed=true;inject=c.fault;}
      const input={tool:t.id,arguments:{task:c.task.slice(0,180),scenario:s.id,...(approvedNote?{userEdits:approvedNote}:{})}};
      event(n,'start','调用 '+t.name,{input,tool:t.id,integration:t.integration});toolCalls++;time+=Math.round(760*speed);
      if(inject){
        const desc={timeout:'调用超时，尚未获得可用结果。',empty:'本次查询返回空结果，证据不足。',invalid:'参数校验失败，任务字段需要规范化。',denied:'权限不足，当前调用被拒绝。',disconnect:'工具连接中断，无法获取结果。'}[inject];
        event(n,'error',desc,{output:desc,fault:inject,tool:t.id});
        let retryTool=t;
        if(inject==='denied'){fail(n,'「'+t.name+'」权限不足。已停止，需修改授权或配置后重新运行；重试不会提升权限。');return false;}
        if(inject==='disconnect'){
          retryTool=resolve(desired,[t.id]);
          if(!retryTool){recoverable=true;fail(n,'「'+t.name+'」连接中断，未找到已启用的同用途备用工具。');return false;}
        }else if(c.retries===0){recoverable=true;fail(n,'已达到重试上限。可以调整配置后重跑'+(cp.checkpoint?'，或从检查点恢复。':'。'));return false;}
        const rn={id:'recover_'+n.id,label:inject==='empty'?'改写查询':inject==='invalid'?'修正参数':inject==='disconnect'?'切换备用工具':'等待并重试',type:'recovery',detail:desc,row:n.row+0.25,agent:n.agent};nodes.push(rn);edges.push({from:n.id,to:rn.id,kind:'retry'},{from:rn.id,to:n.id,kind:'retry'});
        event(rn,'start',desc);time+=430;event(rn,'complete',inject==='disconnect'?'改用「'+retryTool.name+'」：'+retryTool.integration:'准备第 1 次重试，保留已完成步骤。');
        t=retryTool;n.toolId=t.id;n.toolName=t.name;n.integration=t.integration;event(n,'start','再次调用 '+t.name,{input:{...input,tool:t.id,attempt:2},tool:t.id,integration:t.integration});toolCalls++;time+=650;
      }
      const result=sampleOutput(t,s);event(n,'complete',result,{output:result,tool:t.id,integration:t.integration});
      if(cp.checkpoint){checkpoint={node:n.id,eventIndex:events.length-1,at:time};}
      if(cp.hooks&&t.capability==='patch'){
        const hook=add('hook_patch_'+n.id,'补丁后 Hook','hook','PostToolUse：触发模拟补丁格式检查。');activity(hook,'模拟格式检查完成，返回检查记录。',260);
      }
      return true;
    }
    function tool(id,label,nodeId){
      if(terminal||approvalPending)return null;
      const t=findTool(id);if(cp.human&&['mail_write','calendar','interact'].includes(t?.capability))if(!approve('确认外部动作','approve_'+id))return null;
      const n=add(nodeId||'tool_'+nodes.length,label||t.name,'tool',t?.desc||'执行模拟工具调用。');call(n,id);return n;
    }
    function branchTools(specs,kind='tool'){
      if(terminal||approvalPending)return;
      const incoming=[...previous], branchRow=++row,startAt=time,ends=[];previous=[];
      for(let i=0;i<specs.length;i++){
        const spec=specs[i],n={id:spec.id,label:spec.label,type:kind,detail:spec.detail||'独立处理当前分支。',row:branchRow,agent:spec.agent||currentAgent};nodes.push(n);for(const p of incoming)edges.push({from:p,to:n.id});
        time=startAt+i*60;
        if(kind==='tool'){call(n,spec.tool);if(terminal)break;}
        else{activity(n,spec.output||'工作者完成分析并返回摘要。',1050+i*200,{input:{task:spec.detail,context:'独立上下文，仅接收分配的任务'}});}
        ends.push({id:n.id,time});
      }
      time=Math.max(startAt,...ends.map(x=>x.time));previous=ends.map(x=>x.id);
    }
    const start=add('start',c.trigger==='webhook'?'收到 Webhook':c.trigger==='schedule'?'定时事件到达':'接收任务','trigger','任务入口 · '+(c.trigger==='manual'?'用户提交':'模拟事件触发'));
    activity(start,c.task,250,{input:c.task});
    if(cp.memory)model('memory','读取长期记忆','已读取本场景保存的示例偏好：输出简洁、保留来源。','context');
    model('context','组装上下文','加入任务、角色指令、会话状态与当前可用工具。','context');
    if(cp.mcpResources||cp.mcpPrompts){
      if(!e.tools.some(id=>findTool(id).integration==='MCP')){const n=add('mcp_missing','MCP 服务未连接','gate');fail(n,'读取资源或提示模板需要先启用一个 MCP 工具，模拟连接对应服务。');}
      else{
        if(cp.mcpResources)model('mcp_resource','读取 MCP 资源','应用读取服务端资源，把发布条款放入上下文；这不是模型工具调用。','context',{input:{operation:'resources/read',uri:'kb://example/release-policy'}});
        if(cp.mcpPrompts)model('mcp_prompt','选用 MCP 提示模板','用户通过组件开关显式选择模板，应用获取模板内容并加入上下文。','context',{input:{operation:'prompts/get',name:'summarize-with-sources',arguments:{topic:c.task.slice(0,120)}}});
      }
    }
    if(c.fault==='context'){
      const n=add('overflow','上下文达到上限','gate','模拟输入超过当前上下文预算。');event(n,'start','检测到历史与工具结果过长。');time+=200;
      if(cp.context){event(n,'complete','触发上下文管理。');model('compress','摘要与结果外存','历史被摘要，大结果移到模拟文件。保留任务、关键证据与文件引用。','context');}
      else fail(n,'上下文过长，且未启用上下文管理。请启用后重新运行。');faultUsed=true;
    }
    if(cp.skill)model('skill','加载 '+s.skill+' Skill','先匹配技能描述，再加载方法说明；所需参考文件按任务读取。','skill');
    if(cp.discovery&&!terminal){tool('tool_search','发现相关工具','discover');}
    if(cp.rag&&c.ragMode==='fixed'&&!terminal)tool('kb_search','先检索，再生成','rag_fixed');
    if(cp.hooks)model('hook_start','任务启动 Hook','SessionStart：记录任务入口与配置快照。','hook');
    const customPlan=c.toolPlan.length&&['react','chain','plan'].includes(c.workflow);
    const steps=(customPlan?c.toolPlan:s.steps).filter(id=>!(cp.rag&&c.ragMode==='fixed'&&findTool(id)?.capability==='knowledge'));
    if(!terminal)switch(c.workflow){
      case 'react':{
        const decide=model('decide','决定下一步',cp.rag?'检查证据是否足够，选择检索工具。':'选择与任务匹配的工具，并准备调用参数。');
        const toolRow=++row,observeRow=++row;
        let observe=null;
        for(let i=0;i<steps.length;i++){
          if(terminal||approvalPending)break;
          if(i>=c.maxLoops){terminal='blocked';output='达到工具循环上限，还有 '+(steps.length-i)+' 个动作未完成。请增加循环上限或简化任务。';break;}
          if(i){activity(decide,'观察结果后选择下一项动作。',440);}
          const t=findTool(steps[i]);
          if(cp.human&&['mail_write','calendar','interact'].includes(t.capability)){previous=[decide.id];if(!approve('确认外部动作','approve_'+t.id))break;}
          const n={id:'action_'+i,label:t.name,type:'tool',detail:t.desc,row:toolRow};nodes.push(n);edges.push({from:previous[0]&&previous[0].startsWith('approve_')?previous[0]:decide.id,to:n.id});previous=[n.id];call(n,t.id);loops++;
          if(terminal)break;
          if(!observe){observe={id:'observe',label:'观察工具结果',type:'model',detail:'结果回到上下文，判断是否需要继续行动。',row:observeRow};nodes.push(observe);}
          edges.push({from:n.id,to:observe.id});activity(observe,'工具结果已回到上下文。'+(i<steps.length-1?'尚有动作未完成，继续循环。':'当前任务的工具步骤已完成。'),440);
          previous=[observe.id];
        }
        if(observe&&steps.length>1)edges.push({from:observe.id,to:decide.id,kind:'loop'});
        row=Math.max(row,observeRow);
        model('synthesize','组织回答','根据可用工具结果组织回答，保留来源与能力边界。');break;
      }
      case 'chain':{
        tool(steps[0],undefined,'material');model('outline','生成提纲','将输入素材整理成结构化提纲。');
        model('draft','生成草稿','按照提纲、Skill 与任务要求生成示例内容。');
        for(let i=1;i<steps.length;i++)tool(steps[i],undefined,'chain_'+i);break;
      }
      case 'router':{
        const order=/退款|订单|refund|order/i.test(c.task),ticket=/工单|故障|报错|ticket/i.test(c.task);
        const selected=order?'order':ticket?'ticket':'kb_search';model('route','识别任务类型','当前任务进入「'+(order?'订单':ticket?'工单':'知识')+'」分支。');
        const incoming=[...previous],rr=++row;
        for(const [id,label]of [['kb_search','知识问答'],['order','订单处理'],['ticket','工单处理']]){
          const n={id:'route_'+id,label,type:'tool',row:rr,detail:'条件路由分支',toolId:id};nodes.push(n);incoming.forEach(p=>edges.push({from:p,to:n.id}));
          if(id===selected){call(n,id);previous=[n.id];}else event(n,'skipped','本次任务未选择此分支。');
        }
        model('reply','整理专业答复','只根据被选中分支的结果答复。');break;
      }
      case 'parallel':{
        tool(steps[0],undefined,'parallel_material');model('split',c.parallelMode==='vote'?'分配三次独立评审':'拆分三个评审角度',c.parallelMode==='vote'?'对同一判定分别运行三个评审，再统计意见。':'把体验、性能与维护性分为独立任务。');
        branchTools(['体验','性能','维护性'].map((x,i)=>({id:'reviewer_'+i,label:c.parallelMode==='vote'?'独立评审 '+(i+1):x+'评审',agent:'评审分支 '+(i+1),detail:c.task+' / '+x,output:c.parallelMode==='vote'?'示例投票：建议修订。':x+'分支完成：返回 1 项建议与依据。'})),'agent');
        model('aggregate',c.parallelMode==='vote'?'统计评审意见':'聚合分支结果',c.parallelMode==='vote'?'模拟票数 3/3 建议修订，保留每份评审依据。':'汇总共同建议，保留各分支差异。');break;
      }
      case 'plan':{
        model('plan','生成任务清单','计划：读需求 → 查资料 → 计算 → 整理产物。');
        for(let i=0;i<steps.length;i++){tool(steps[i],undefined,'plan_step_'+i);if(i===1)model('replan','检查并更新计划','根据已获取的资料确认下一项依赖，更新任务清单。');}break;
      }
      case 'review':{
        tool('code_search','定位问题','locate');tool('apply_patch','生成初版补丁','patch_1');
        if(!terminal){const n=add('test_1','第一次测试','tool','读取初版补丁的测试反馈。');const t=resolve('run_tests');n.toolId=t?.id||'run_tests';n.integration=t?.integration;
          if(!t){event(n,'start','检查测试工具。');fail(n,'缺少运行测试工具，无法验证修复，不能宣称测试通过。');}
          else {event(n,'start','运行示例测试。',{tool:t.id,input:{suite:'示例输入用例'},integration:t.integration});toolCalls++;time+=600;event(n,'complete','模拟测试：4/5 通过。空输入用例仍未通过。',{tool:t.id,output:{passed:4,total:5},integration:t.integration});}
        }
        model('evaluate','评审测试反馈','需要补充空输入分支，返回修改意见。','gate');
        if(!terminal){loops=1;if(c.maxLoops===1){terminal='blocked';output='达到评审循环上限，当前测试 4/5，通过条件尚未满足。';}else{
          edges.push({from:'evaluate',to:'patch_1',kind:'loop'});tool('apply_patch','按反馈修订','patch_2');tool('run_tests','再次测试','test_2');loops=2;tool('git_status','检查修改摘要','diff');}}
        break;
      }
      case 'supervisor':{
        model('supervisor','主管拆分任务','主管负责最终回答，将三个子任务分配给独立工作者。');
        if(!cp.subagents){const n=add('missing_agents','协作组件未启用','gate');fail(n,'主管工作流需要启用子智能体协作组件。');break;}
        const delegation=resolve('subagent');if(!delegation){const n=add('missing_delegate','委派工具不可用','gate');fail(n,'缺少子智能体调用或 A2A 同用途工具。');break;}
        tool('subagent',delegation.id==='remote_agent'?'A2A 任务委派':'委派工作者','delegate');
        if(!terminal){
          const incoming=[...previous],workerRow=++row,searchRow=++row,summaryRow=++row,startAt=time,ends=[];
          for(let i=0;i<3;i++){
            const worker={id:'worker_'+i,label:'工作者 '+(i+1),type:'agent',row:workerRow,agent:'工作者 '+(i+1),detail:'独立任务 '+(i+1)+'；上下文与主管隔离。'};
            nodes.push(worker);incoming.forEach(p=>edges.push({from:p,to:worker.id}));time=startAt+i*70;
            activity(worker,'工作者选择资料获取方式。',400,{input:{task:'研究方案 '+(i+1),context:'隔离上下文'}});
            const search=resolve('web_search');
            let last=worker.id;
            if(search){const n={id:'worker_search_'+i,label:'方案 '+(i+1)+' 检索',type:'tool',row:searchRow,agent:worker.agent,detail:'工作者在自己的上下文中检索。'};nodes.push(n);edges.push({from:worker.id,to:n.id});call(n,'web_search');last=n.id;if(terminal)break;}
            const summary={id:'worker_summary_'+i,label:'返回摘要 '+(i+1),type:'agent',row:summaryRow,agent:worker.agent,detail:'保留证据与结论，返回主管。'};nodes.push(summary);edges.push({from:last,to:summary.id});activity(summary,'工作者返回方案 '+(i+1)+' 的结构化摘要。',350);ends.push({id:summary.id,time});
          }
          time=Math.max(time,...ends.map(x=>x.time));previous=ends.map(x=>x.id);
        }
        model('manager_answer','主管汇总','主管接收摘要，保留最终答复责任；工作者上下文不会整段回传。');break;
      }
      case 'handoff':{
        model('triage','任务分诊','判断需要订单领域的专业处理。');
        const n=add('handoff','转交给订单专家','handoff','交接任务与必要上下文，转移后续答复责任。');activity(n,'控制权已从主智能体移交订单专家。',600,{owner:'订单专家'});currentAgent='订单专家';activeOwner='订单专家';
        tool('order','专家查询订单','expert_tool');model('expert_answer','专家负责答复','订单专家结合查询结果继续处理并完成最终答复。','agent',{agent:'订单专家'});break;
      }
    }
    if(cp.validation&&!terminal&&!approvalPending)model('validate','检查交付条件',c.output==='json'?'检查必需字段、状态与来源数组，生成合法 JSON。':'检查是否满足当前模拟场景的必需步骤。','gate');
    // A scenario's result is only valid for its own recipe; a changed workflow gets a neutral summary.
    if(!terminal&&!approvalPending)output=customPlan?'已按自定义步骤完成 '+steps.length+' 项模拟工具动作。结果取自各工具的示例响应，请结合调用记录查看。':c.workflow===s.workflow&&c.task===s.task?s.result:'已按「'+D.workflows.find(w=>w.id===c.workflow).name+'」完成本场景的模拟执行。自定义任务使用场景示例响应，请结合工具记录检查。';
    if(approvedNote&&!terminal&&!approvalPending)output+=' 已记录并应用人工修改说明。';
    if(cp.human&&!terminal&&!approvalPending&&!nodes.some(n=>n.type==='human'))approve();
    if(cp.memory&&!terminal&&!approvalPending)model('memory_write','更新长期记忆','保存本任务的示例偏好与已确认结论；不保存原始长日志。','context');
    if(!approvalPending){
      const end=add('end',terminal==='blocked'?'执行受阻':terminal==='cancelled'?'任务已取消':'交付结果','output',output);
      event(end,'start','准备任务结果。');time+=250;event(end,terminal==='blocked'?'blocked':terminal==='cancelled'?'cancelled':'complete',output,{output});
    }
    events.sort((a,b)=>a.at-b.at||Number(a.id.slice(1))-Number(b.id.slice(1)));
    const status=approvalPending?'awaiting':terminal||'complete';
    const checkpointEvent=cp.checkpoint?[...events].reverse().find(ev=>ev.type==='complete'&&!['end','approval'].includes(ev.node)):null;
    checkpoint=checkpointEvent?{node:checkpointEvent.node,eventIndex:events.indexOf(checkpointEvent),at:checkpointEvent.at}:null;
    const warnings=[];
    if(c.fault!=='none'&&!faultUsed)warnings.push('本次流程没有匹配的故障目标，故障未触发。');
    if(c.workflow!==s.workflow)warnings.push('已更换工作流：使用该模式的通用执行规则，场景产物会随模式改变。');
    if(customPlan)warnings.push('自定义工具步骤已生效；当前结果使用通用示例摘要。');
    if(c.toolPlan.length&&!customPlan)warnings.push('当前模式使用专用结构。自定义工具步骤仅在工具循环、串行和计划模式中生效。');
    if(c.task!==s.task)warnings.push('自定义文字作为任务上下文；执行仍遵循所选场景规则，不代表真实模型理解。');
    if(c.workflow==='supervisor'&&!e.tools.some(id=>['web_search','page_read','kb_search'].includes(id)))warnings.push('工作者仅使用内置示例材料，未配置外部检索工具。');
    const result=c.output==='json'?JSON.stringify({status,scenario:s.name,workflow:c.workflow,answer:output,artifact:status==='complete'?s.artifact:null,simulated:true},null,2):output;
    return {config:copy(c),nodes,edges,events,status,result,summary:output,artifact:status==='complete'?s.artifact:null,metrics:{toolCalls,modelCalls,duration:Math.round(time),loops},checkpoint,canResume:status==='blocked'&&recoverable&&Boolean(checkpoint),decisions:copy(decisions),warnings,owner:activeOwner};
  }
  function snapshot(run,index){
    const limit=Math.max(-1,Math.min(index,run.events.length-1)),states=Object.fromEntries(run.nodes.map(n=>[n.id,{status:'idle',attempts:0}]));
    let active=null,owner='主智能体',toolCalls=0,modelCalls=0;
    for(let i=0;i<=limit;i++){
      const ev=run.events[i],st=states[ev.node];if(!st)continue;
      st.status={start:'running',complete:'complete',error:'error',blocked:'blocked',skipped:'skipped',approval:'awaiting',cancelled:'cancelled'}[ev.type]||st.status;
      st.detail=ev.detail;if(ev.input!==undefined)st.input=ev.input;if(ev.output!==undefined)st.output=ev.output;
      if(ev.type==='start'){st.attempts++;if(ev.tool)toolCalls++;else if(['model','agent'].includes(run.nodes.find(n=>n.id===ev.node)?.type))modelCalls++;}
      if(ev.owner)owner=ev.owner;active=ev.node;
    }
    return {states,active,owner,toolCalls,modelCalls,at:limit<0?0:run.events[limit].at,index:limit};
  }
  function resume(run){
    if(!run.canResume||!run.checkpoint)throw Error('当前问题需要修改配置，或没有可恢复的检查点。');
    if(!['timeout','empty','invalid','disconnect'].includes(run.config.fault))throw Error('此问题需要修改配置，不能仅靠恢复解决。');
    const c={...copy(run.config),fault:'none'},fresh=compile(c,{decisions:run.decisions});
    const oldPrefix=run.events.slice(0,run.checkpoint.eventIndex+1),last=oldPrefix[oldPrefix.length-1];
    const occurrence=oldPrefix.filter(ev=>ev.node===last.node&&ev.type==='complete').length;let seen=0;
    const cut=fresh.events.findIndex(ev=>ev.node===last.node&&ev.type==='complete'&&++seen===occurrence);
    if(cut<0)throw Error('检查点与当前流程不匹配。');
    const remaining=fresh.events.slice(cut+1),history=run.events.filter(ev=>ev.node!=='end'),historyEnd=history.at(-1).at,offset=historyEnd-fresh.events[cut].at;
    const marker={id:'resume',node:last.node,type:'complete',detail:'从检查点继续：保留已完成步骤和失败记录，模拟连接现已恢复。',at:historyEnd+160};
    preserveHistory(fresh,run,[...copy(history),marker,...remaining.map(ev=>({...ev,at:ev.at+offset+160}))]);
    fresh.warnings.push('已从检查点恢复；仅用于演示外部状态改善后的续跑。');
    return {run:fresh,index:history.length};
  }
  function preserveHistory(fresh,old,events){
    const ids=new Set(fresh.nodes.map(n=>n.id)),recorded=new Set(events.map(ev=>ev.node));
    for(const node of old.nodes)if(recorded.has(node.id)&&!ids.has(node.id)){fresh.nodes.push(copy(node));ids.add(node.id);}
    const edgeKeys=new Set(fresh.edges.map(e=>[e.from,e.to,e.kind||''].join('|')));
    for(const edge of old.edges){const key=[edge.from,edge.to,edge.kind||''].join('|');if(ids.has(edge.from)&&ids.has(edge.to)&&!edgeKeys.has(key)){fresh.edges.push(copy(edge));edgeKeys.add(key);}}
    fresh.events=events;fresh.events.forEach((ev,i)=>ev.id='history_e'+i);
    const snap=snapshot(fresh,fresh.events.length-1);
    Object.assign(fresh.metrics,{toolCalls:snap.toolCalls,modelCalls:snap.modelCalls,duration:snap.at});
    const checkpoint=fresh.checkpoint?[...events].reverse().find(ev=>ev.type==='complete'&&!['end','approval'].includes(ev.node)):null;
    fresh.checkpoint=checkpoint?{node:checkpoint.node,eventIndex:events.indexOf(checkpoint),at:checkpoint.at}:null;
    fresh.warnings=[...new Set([...old.warnings,...fresh.warnings])];
  }
  function resolveApproval(run,index,choice){
    const ev=run.events[index];if(ev?.type!=='approval')throw Error('当前步骤没有待处理的人工决定。');
    if(!choice||!['approve','edit','reject'].includes(choice.action))throw Error('无效的人工决定。');
    const decisions={...run.decisions,[ev.node]:{action:choice.action,note:String(choice.note||'').slice(0,1000)}};
    const fresh=compile(run.config,{decisions}),cut=fresh.events.findIndex(e=>e.node===ev.node&&['complete','cancelled'].includes(e.type));
    if(cut<0)throw Error('人工决定与当前流程不匹配。');
    const offset=ev.at-fresh.events[cut].at;
    preserveHistory(fresh,run,[...copy(run.events.slice(0,index)),...fresh.events.slice(cut).map(e=>({...e,at:e.at+offset}))]);
    return {run:fresh,index};
  }
  const api={defaultConfig,effective,validateConfig,compile,snapshot,resume,resolveApproval,copy};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;root.AgentLabEngine=api;
})(typeof globalThis!=='undefined'?globalThis:this);
