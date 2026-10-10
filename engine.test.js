'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const D=require('./data');
const E=require('./engine');

function integrity(r){
  const ids=new Set(r.nodes.map(n=>n.id));assert.equal(ids.size,r.nodes.length,'node ids must be unique');
  assert.equal(new Set(r.events.map(ev=>ev.id)).size,r.events.length,'event ids must be unique');
  for(const edge of r.edges){assert.ok(ids.has(edge.from),'edge source exists');assert.ok(ids.has(edge.to),'edge destination exists');}
  for(let i=0;i<r.events.length;i++){assert.ok(ids.has(r.events[i].node),'event node exists');if(i)assert.ok(r.events[i].at>=r.events[i-1].at,'events are ordered');}
  const last=E.snapshot(r,r.events.length-1);assert.equal(last.toolCalls,r.metrics.toolCalls,'trace matches call metrics');
  assert.equal(last.modelCalls,r.metrics.modelCalls,'trace matches decision metrics');assert.equal(last.at,r.metrics.duration,'trace matches duration');
}

test('all ten default scenarios have coherent traces, graphs and expected completion',()=>{
  for(const s of D.scenarios){const r=E.compile(E.defaultConfig(s.id));integrity(r);assert.equal(r.status,s.id==='automation'?'awaiting':'complete',s.id);}
});
test('all eight modes can be selected for every scenario without invalid graph references',()=>{
  for(const s of D.scenarios)for(const w of D.workflows){const c=E.defaultConfig(s.id);c.workflow=w.id;integrity(E.compile(c));}
});
test('a missing tool stops dependent work and never reports successful completion',()=>{
  const c=E.defaultConfig();c.toolOverrides.web_search=false;const r=E.compile(c);
  assert.equal(r.status,'blocked');assert.equal(r.artifact,null);assert.equal(r.metrics.toolCalls,0);assert.match(r.summary,/缺少/);assert.ok(!r.events.some(e=>e.tool==='page_read'));
});
test('a compatible enabled tool can replace a missing one with its real integration',()=>{
  const c=E.defaultConfig('writing');c.toolOverrides.read_file=false;c.tools.push('pdf_parse');const r=E.compile(c);
  assert.equal(r.status,'complete');assert.ok(r.events.some(e=>e.tool==='pdf_parse'&&e.integration==='函数'));
});
test('transient fault retries exactly once and keeps an observable error record',()=>{
  for(const fault of ['timeout','empty','invalid']){const c=E.defaultConfig();c.fault=fault;const r=E.compile(c);assert.equal(r.status,'complete');assert.equal(r.metrics.toolCalls,4);assert.equal(r.events.filter(e=>e.type==='error').length,1);integrity(r);}
});
test('permission denial cannot be bypassed by retries or alternate tools',()=>{
  const c=E.defaultConfig();c.fault='denied';c.retries=3;const r=E.compile(c);assert.equal(r.status,'blocked');assert.equal(r.metrics.toolCalls,1);assert.match(r.summary,/权限不足/);
});
test('disconnect switches to an explicitly enabled tool of the same capability',()=>{
  const c=E.defaultConfig('knowledge');c.fault='disconnect';c.tools.push('vector_search');const r=E.compile(c);assert.equal(r.status,'complete');assert.ok(r.events.some(e=>e.tool==='vector_search'));assert.ok(r.nodes.some(n=>n.type==='recovery'));
});
test('context overflow needs the context manager',()=>{
  const c=E.defaultConfig();c.fault='context';assert.equal(E.compile(c).status,'complete');c.componentOverrides.context=false;const r=E.compile(c);assert.equal(r.status,'blocked');assert.equal(r.metrics.toolCalls,0);
});
test('parallel workers overlap in simulated time and have separate context',()=>{
  const r=E.compile(E.defaultConfig('parallel')),starts=r.events.filter(e=>e.node.startsWith('reviewer_')&&e.type==='start'),ends=r.events.filter(e=>e.node.startsWith('reviewer_')&&e.type==='complete');
  assert.equal(starts.length,3);assert.ok(starts[2].at<ends[0].at);assert.equal(new Set(starts.map(e=>e.agent)).size,3);
});
test('supervisor workers make their own searches while handoff transfers ownership',()=>{
  const r=E.compile(E.defaultConfig('team'));assert.equal(r.metrics.toolCalls,4);assert.equal(r.events.filter(e=>e.type==='start'&&e.node.startsWith('worker_search_')).length,3);
  const h=E.compile(E.defaultConfig('handoff'));assert.equal(E.snapshot(h,h.events.length-1).owner,'订单专家');assert.ok(h.events.some(e=>e.node==='expert_tool'&&e.agent==='订单专家'));
});
test('human approval blocks writing; approve, edit and reject are distinct',()=>{
  const c=E.defaultConfig('automation'),waiting=E.compile(c);assert.equal(waiting.status,'awaiting');assert.ok(!waiting.events.some(e=>e.tool==='mail_send'));
  const rejected=E.compile(c,{decisions:{approve_mail_send:{action:'reject'}}});assert.equal(rejected.status,'cancelled');assert.ok(!rejected.events.some(e=>e.tool==='mail_send'));
  const approved=E.compile(c,{decisions:{approve_mail_send:{action:'approve'}}});assert.equal(approved.status,'complete');assert.ok(approved.events.some(e=>e.tool==='mail_send'));
  const edited=E.compile(c,{decisions:{approve_mail_send:{action:'edit',note:'说明预计处理时间'}}});assert.ok(edited.events.some(e=>e.tool==='mail_send'&&e.input?.arguments.userEdits==='说明预计处理时间'));integrity(edited);
});
test('review loop respects limit and cannot pretend failed tests passed',()=>{
  const c=E.defaultConfig('coding');c.maxLoops=1;const r=E.compile(c);assert.equal(r.status,'blocked');assert.match(r.summary,/4\/5/);assert.equal(r.artifact,null);c.maxLoops=3;c.toolOverrides.run_tests=false;assert.equal(E.compile(c).status,'blocked');
});
test('tool loop visibly repeats decisions and honors iteration bound',()=>{
  const c=E.defaultConfig();let r=E.compile(c);assert.equal(r.events.filter(e=>e.node==='decide'&&e.type==='start').length,3);assert.ok(r.edges.some(e=>e.kind==='loop'));c.maxLoops=1;r=E.compile(c);assert.equal(r.status,'blocked');assert.equal(r.metrics.toolCalls,1);
});
test('checkpoint recovery preserves finished tool calls, including repeated loop nodes',()=>{
  for(const target of ['web_search','page_read','report_generate']){
    const c=E.defaultConfig();c.fault='timeout';c.faultTarget=target;c.retries=0;const r=E.compile(c);assert.equal(r.status,'blocked');assert.ok(r.checkpoint);
    const {run:resumed}=E.resume(r);assert.equal(resumed.status,'complete');integrity(resumed);
    for(const tool of ['web_search','page_read','report_generate']){const count=resumed.events.filter(e=>e.tool===tool&&e.type==='start').length;assert.equal(count,tool===target?2:1,'finished tool must not rerun: '+tool);}
  }
});
test('snapshot replay only shows events through the selected position',()=>{
  const r=E.compile(E.defaultConfig());const before=E.snapshot(r,-1);assert.equal(before.toolCalls,0);assert.equal(before.states.end.status,'idle');const start=E.snapshot(r,0);assert.equal(start.states.start.status,'running');assert.equal(start.states.end.status,'idle');
});
test('a resumed automation can reach approval and complete without reinjecting its old fault',()=>{
  const c=E.defaultConfig('automation');c.fault='timeout';c.retries=0;const failed=E.compile(c),resumed=E.resume(failed).run;assert.equal(resumed.status,'awaiting');assert.equal(resumed.config.fault,'none');
  for(const action of ['approve','edit','reject']){
    const at=resumed.events.findIndex(e=>e.type==='approval'),resolved=E.resolveApproval(resumed,at,{action,note:'补充预计处理时间'}),approved=resolved.run;
    assert.equal(approved.status,action==='reject'?'cancelled':'complete');assert.equal(resolved.index,at);integrity(approved);
    assert.deepEqual(approved.events.slice(0,at),resumed.events.slice(0,at),'approval must preserve failure history and progress');
    assert.equal(approved.events[at].at,resumed.events[at].at);assert.equal(approved.events.filter(e=>e.type==='error').length,1);
    assert.equal(approved.events.filter(e=>e.tool==='ticket'&&e.type==='start').length,2);
    assert.equal(approved.events.filter(e=>e.tool==='kb_search'&&e.type==='start').length,1);
    assert.equal(approved.events.some(e=>e.tool==='mail_send'),action!=='reject');
  }
});
test('repeated external actions require separate approvals and keep distinct graph nodes',()=>{
  const c=E.defaultConfig('automation');c.toolPlan=['mail_send','mail_send'];let r=E.compile(c);integrity(r);
  r=E.resolveApproval(r,r.events.findIndex(e=>e.type==='approval'),{action:'approve'}).run;
  assert.equal(r.status,'awaiting');assert.equal(r.events.filter(e=>e.tool==='mail_send'&&e.type==='start').length,1);integrity(r);
  r=E.resolveApproval(r,r.events.findIndex(e=>e.type==='approval'),{action:'reject'}).run;
  assert.equal(r.status,'cancelled');assert.equal(r.events.filter(e=>e.tool==='mail_send'&&e.type==='start').length,1);integrity(r);
});
test('plugin union is deduplicated and explicit switches override a plugin',()=>{
  const c=E.defaultConfig();c.plugins=['research'];let e=E.effective(c);assert.equal(e.tools.filter(id=>id==='web_search').length,1);assert.ok(e.components.rag);c.toolOverrides.kb_search=false;c.componentOverrides.rag=false;e=E.effective(c);assert.ok(!e.tools.includes('kb_search'));assert.equal(e.components.rag,false);
});
test('JSON output and import preserve config while rejecting malformed input',()=>{
  const c=E.defaultConfig();c.output='json';const r=E.compile(c);assert.equal(JSON.parse(r.result).simulated,true);assert.deepEqual(E.validateConfig(JSON.parse(JSON.stringify(c))),c);assert.throws(()=>E.validateConfig({...c,tools:['imaginary']}));assert.throws(()=>E.validateConfig({...c,maxLoops:99}));assert.throws(()=>E.validateConfig({...c,components:{['__proto__']:true}}));
});
test('all tool types can run in an explicit custom plan without real side effects',()=>{
  for(const t of D.tools){const c=E.defaultConfig('writing');c.tools=[t.id];c.toolPlan=[t.id];c.model='multimodal';const r=E.compile(c);assert.equal(r.status,'complete',t.id);assert.equal(r.metrics.toolCalls,1,t.id);assert.ok(r.events.some(e=>e.tool===t.id));integrity(r);}
});
test('MCP resources and prompts are context operations with an explicit connection requirement',()=>{
  const c=E.defaultConfig();c.componentOverrides.mcpResources=true;c.componentOverrides.mcpPrompts=true;assert.equal(E.compile(c).status,'blocked');c.tools.push('kb_search');const r=E.compile(c);assert.equal(r.status,'complete');assert.ok(r.events.some(e=>e.input?.operation==='resources/read'));assert.ok(r.events.some(e=>e.input?.operation==='prompts/get'));
});
