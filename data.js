(function (root) {
  'use strict';
  const workflows = [
    { id: 'react', name: '工具调用循环', en: 'Tool loop', desc: '根据观察结果决定下一步，直到任务完成。', symbol: '↻' },
    { id: 'chain', name: '串行流水线', en: 'Prompt chain', desc: '依次加工上一步的结果，通过关卡后继续。', symbol: '→' },
    { id: 'router', name: '条件路由', en: 'Routing', desc: '识别任务类型，选择合适的专业分支。', symbol: '⑂' },
    { id: 'parallel', name: '并行与聚合', en: 'Parallel', desc: '独立任务同时推进，再汇总或投票。', symbol: '⋈' },
    { id: 'plan', name: '计划与执行', en: 'Plan & execute', desc: '列出任务清单，执行后根据反馈更新计划。', symbol: '≡' },
    { id: 'review', name: '评审与修改', en: 'Evaluator loop', desc: '生成、检查、修订；验证通过或达到上限时结束。', symbol: '⟳' },
    { id: 'supervisor', name: '主管与子智能体', en: 'Supervisor', desc: '主管分配任务，独立工作者返回摘要，由主管汇总。', symbol: '⌘' },
    { id: 'handoff', name: '专家接管', en: 'Handoff', desc: '转交上下文与控制权，由专家继续负责答复。', symbol: '⇄' }
  ];
  const categories = [
    { id: 'search', name: '信息与检索', icon: 'search' },
    { id: 'files', name: '文件与办公', icon: 'file' },
    { id: 'code', name: '编程开发', icon: 'code' },
    { id: 'data', name: '数据与计算', icon: 'chart' },
    { id: 'browser', name: '浏览器与界面', icon: 'browser' },
    { id: 'business', name: '业务系统', icon: 'briefcase' },
    { id: 'media', name: '多模态', icon: 'image' },
    { id: 'agents', name: '智能体协作', icon: 'agents' }
  ];
  const tools = [
    ['web_search','网页搜索','search','内置','web','查找公开网页与来源'],
    ['page_read','页面读取','search','内置','page','提取网页正文与来源链接'],
    ['kb_search','知识库查询','search','MCP','knowledge','检索团队文档与规则'],
    ['vector_search','向量检索','search','函数','knowledge','从文档片段中匹配相关内容'],
    ['rerank','检索重排序','search','函数','rerank','根据问题重新排列候选片段'],
    ['tool_search','工具发现','search','内置','discover','按需加载相关工具定义'],
    ['read_file','读取文件','files','本地','read','读取素材与结构化文件'],
    ['write_file','编辑文件','files','本地','write','写入或修改工作区文件'],
    ['pdf_parse','PDF 解析','files','函数','read','提取 PDF 文字与页码'],
    ['sheet_read','表格读取','files','连接器','read','读取工作表中的数据'],
    ['report_generate','报告生成','files','函数','report','把结果整理为文档产物'],
    ['code_search','代码检索','code','本地','code','定位相关代码与引用'],
    ['symbol_query','符号与诊断','code','LSP','code','查看定义、引用与类型诊断'],
    ['apply_patch','应用补丁','code','本地','patch','对文件应用局部修改'],
    ['git_status','Git 状态','code','CLI','git','查看工作区差异与修改'],
    ['run_tests','运行测试','code','终端','test','执行测试并读取真实式反馈'],
    ['calculator','计算器','data','函数','calculate','进行确定性数值计算'],
    ['sql_query','数据库查询','data','MCP','database','查询结构化业务数据'],
    ['python_exec','Python 执行','data','沙箱','execute','在模拟沙箱中处理数据'],
    ['js_exec','JavaScript 执行','data','沙箱','execute','运行数据处理与工具编排脚本'],
    ['chart_render','图表生成','data','函数','chart','把数据转换为可视化结果'],
    ['browser_read','浏览器观察','browser','浏览器','page','读取页面结构与当前状态'],
    ['browser_click','点击与填写','browser','浏览器','interact','操作网页中的按钮和表单'],
    ['screenshot','界面截图','browser','Computer Use','screen','观察图形界面的状态'],
    ['mail_search','邮件检索','business','连接器','mail_read','查询相关邮件与附件'],
    ['mail_send','发送邮件','business','连接器','mail_write','将草稿发送给指定收件人'],
    ['calendar','日历安排','business','连接器','calendar','查询与创建日程'],
    ['ticket','工单管理','business','HTTP API','ticket','读取或更新服务工单'],
    ['crm','客户资料','business','连接器','customer','查询客户与历史记录'],
    ['order','订单查询','business','MCP','order','查询订单与退款状态'],
    ['vision','图片理解','media','模型','vision','识别图片中的信息与结构'],
    ['ocr','文字识别','media','函数','vision','从图片中提取文字'],
    ['asr','语音转写','media','HTTP API','audio','将语音转换为文字'],
    ['tts','语音合成','media','HTTP API','speech','把结果转换为语音'],
    ['image_generate','图像生成','media','内置','image','根据描述生成图像'],
    ['subagent','子智能体调用','agents','运行时','delegate','让隔离上下文中的工作者返回摘要'],
    ['remote_agent','远程智能体','agents','A2A','delegate','委派任务给独立智能体并获取产物']
  ].map(([id,name,category,integration,capability,desc]) => ({ id,name,category,integration,capability,desc }));
  const components = [
    {id:'skill',name:'Skill 方法包',desc:'根据任务加载指令、参考资料和模板。',icon:'spark'},
    {id:'rag',name:'知识检索 · RAG',desc:'把检索到的相关资料放入上下文；需要检索工具。',icon:'search'},
    {id:'memory',name:'长期记忆',desc:'跨任务保存偏好；与当前会话状态分开。',icon:'memory'},
    {id:'context',name:'上下文管理',desc:'摘要历史、把大结果移到文件，再按需读取。',icon:'layers'},
    {id:'discovery',name:'工具按需发现',desc:'先查工具目录，再加载定义；需要工具发现工具。',icon:'compass'},
    {id:'mcpResources',name:'MCP 上下文资源',desc:'模拟读取已连接 MCP 服务的资源；需要启用 MCP 工具。',icon:'file'},
    {id:'mcpPrompts',name:'MCP 提示模板',desc:'显式选用服务端提示模板；需要启用 MCP 工具。',icon:'spark'},
    {id:'subagents',name:'子智能体协作',desc:'隔离工作者上下文，再把摘要带回主管。',icon:'agents'},
    {id:'hooks',name:'事件 Hooks',desc:'在匹配的执行事件上自动运行检查或记录。',icon:'bolt'},
    {id:'human',name:'人工介入',desc:'在外部写入或最终交付前等待批准、修改或拒绝。',icon:'user'},
    {id:'checkpoint',name:'检查点与恢复',desc:'保存任务状态，失败后可以从已保存的进度继续。',icon:'save'},
    {id:'validation',name:'输出校验',desc:'按照验收条件检查结果与 JSON 格式。',icon:'shield'}
  ];
  const plugins = [
    {id:'research',name:'研究套件',desc:'搜索、阅读与资料核验',tools:['web_search','page_read','kb_search','report_generate'],components:['skill','rag','validation']},
    {id:'developer',name:'开发套件',desc:'代码定位、补丁与测试',tools:['code_search','symbol_query','apply_patch','git_status','run_tests'],components:['skill','hooks','checkpoint','validation']},
    {id:'office',name:'办公套件',desc:'文件、邮件与日历',tools:['read_file','sheet_read','report_generate','mail_search','mail_send','calendar'],components:['skill','human']},
    {id:'team',name:'协作套件',desc:'子智能体与远程委派',tools:['subagent','remote_agent'],components:['subagents','context','checkpoint']}
  ];
  const defaults = {skill:true,rag:false,memory:false,context:true,discovery:false,mcpResources:false,mcpPrompts:false,subagents:false,hooks:false,human:false,checkpoint:true,validation:true};
  const scenarios = [
    {id:'research',name:'联网研究',tag:'从资料到结论',icon:'search',workflow:'react',task:'调研智能体在企业知识管理中的用途，整理一份有来源的简短报告。',tools:['web_search','page_read','report_generate'],components:{},skill:'资料核验',steps:['web_search','page_read','report_generate'],result:'已整理 3 类用途：企业问答、文档检索与任务协作。保留 2 条模拟来源，区分事实和建议。',artifact:'研究摘要.md'},
    {id:'writing',name:'文档写作',tag:'清晰的串行加工',icon:'file',workflow:'chain',task:'读取产品素材，先生成提纲，再写一份简洁的产品介绍。',tools:['read_file','write_file','report_generate'],components:{},skill:'中文写作',steps:['read_file','write_file','report_generate'],result:'已生成「背景、使用方式、能力边界」三部分产品介绍，完成结构与格式检查。',artifact:'产品介绍.md'},
    {id:'support',name:'客服分流',tag:'走向正确的分支',icon:'briefcase',workflow:'router',task:'查询订单 A-1024 的退款进度，并解释下一步处理方式。',tools:['kb_search','order','ticket'],components:{rag:true},skill:'客服处理',steps:['order','ticket'],result:'模拟订单 A-1024 已进入退款处理。已整理状态与预计处理步骤，并形成客服回复。',artifact:'客服回复.md'},
    {id:'parallel',name:'并行评审',tag:'三个角度，一份结论',icon:'layers',workflow:'parallel',task:'从用户体验、性能和可维护性三个角度评审同一份产品方案。',tools:['read_file'],components:{},skill:'方案评审',steps:['read_file'],result:'三条评审分支均已返回：简化首屏、减少重复请求、明确模块边界。已汇总共同建议与分歧。',artifact:'评审汇总.md'},
    {id:'planning',name:'项目规划',tag:'边执行，边调整',icon:'compass',workflow:'plan',task:'读取项目需求，查询相关资料，计算开发工作量并整理实施计划。',tools:['read_file','web_search','calculator','report_generate'],components:{memory:true},skill:'项目拆解',steps:['read_file','web_search','calculator','report_generate'],result:'已完成需求梳理、资料查询与工作量计算，形成 3 个实施阶段和每阶段验收项。',artifact:'实施计划.md'},
    {id:'coding',name:'代码修复',tag:'用验证推动修订',icon:'code',workflow:'review',task:'定位示例项目中的空输入错误，修复代码，并通过测试验证。',tools:['code_search','apply_patch','run_tests','git_status'],components:{hooks:true},skill:'调试与验证',steps:['code_search','apply_patch','run_tests','git_status'],result:'模拟补丁已修复空输入分支。第二次测试 5/5 通过，已整理修改摘要。',artifact:'修复摘要.patch'},
    {id:'team',name:'团队研究',tag:'主管分工，独立探索',icon:'agents',workflow:'supervisor',task:'比较三个知识库方案，让工作者分别研究，最后由主管整理建议。',tools:['subagent','web_search','page_read'],components:{subagents:true},skill:'研究分工',steps:['subagent','web_search'],result:'三个工作者分别返回结构化摘要。主管已比较检索方式、部署条件与维护成本。',artifact:'方案比较.md'},
    {id:'handoff',name:'专家接管',tag:'谁来负责下一步',icon:'user',workflow:'handoff',task:'用户需要查询退款，先分诊，再交给订单专家继续处理。',tools:['order','crm'],components:{},skill:'专业分诊',steps:['crm','order'],result:'订单专家已接管当前任务，查询模拟订单后完成退款说明。最终答复由订单专家负责。',artifact:'专家回复.md'},
    {id:'knowledge',name:'知识库问答',tag:'证据不足就补查',icon:'memory',workflow:'react',task:'查询项目的发布验收规定，给出回答并附上相关条款。',tools:['kb_search','rerank','read_file'],components:{rag:true},skill:'条款检索',steps:['kb_search','rerank','read_file'],result:'已引用「发布验收」中的测试、评审与回滚准备三项要求。回答关联 2 段模拟原文。',artifact:'条款回答.md'},
    {id:'automation',name:'事件驱动',tag:'从触发到人工确认',icon:'bolt',workflow:'chain',task:'收到新的客户工单后，查阅处理规定，起草一封邮件，等待确认后发送。',tools:['ticket','kb_search','mail_send'],components:{human:true,hooks:true},skill:'工单自动化',steps:['ticket','kb_search','mail_send'],result:'模拟工单已分类，邮件草稿已生成，经过人工确认后完成模拟发送。',artifact:'工单处理记录.json'}
  ];
  const faults = [
    {id:'none',name:'正常运行',desc:'观察完整的成功路径。'},
    {id:'timeout',name:'工具超时',desc:'一次调用超时，观察重试与检查点恢复。'},
    {id:'empty',name:'检索无结果',desc:'检索工具首次返回空结果，观察改写查询与补查。'},
    {id:'invalid',name:'参数错误',desc:'首次参数未通过工具定义检查，观察修正。'},
    {id:'denied',name:'权限不足',desc:'工具拒绝当前调用；不会靠重试获得权限。'},
    {id:'disconnect',name:'连接中断',desc:'工具连接不可用，尝试同用途的备用工具。'},
    {id:'context',name:'上下文过长',desc:'触发历史摘要与结果外存；需要上下文管理。'}
  ];
  const sources = [
    ['工作流模式','Anthropic','https://www.anthropic.com/engineering/building-effective-agents'],
    ['工作流与状态','LangGraph','https://docs.langchain.com/oss/python/langgraph/workflows-agents'],
    ['委派与专家接管','OpenAI','https://developers.openai.com/api/docs/guides/agents/orchestration'],
    ['工具与调用方式','OpenAI','https://developers.openai.com/api/docs/guides/tools'],
    ['Skill 渐进加载','Agent Skills','https://agentskills.io/specification'],
    ['工具、资源与提示模板','MCP','https://modelcontextprotocol.io/docs/learn/server-concepts'],
    ['插件与事件 Hooks','Claude Code','https://code.claude.com/docs/en/features-overview'],
    ['智能体之间的通信','A2A','https://a2a-protocol.org/latest/'],
    ['检索增强生成','LangChain','https://docs.langchain.com/oss/python/deepagents/retrieval'],
    ['记忆与检查点','LangGraph','https://docs.langchain.com/oss/python/langgraph/persistence'],
    ['人工介入','LangGraph','https://docs.langchain.com/oss/python/langgraph/interrupts'],
    ['事件驱动入口','n8n','https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook'],
    ['前端事件通信','AG-UI','https://docs.ag-ui.com/introduction'],
    ['智能体与编辑器','ACP','https://agentclientprotocol.com/get-started/introduction']
  ];
  const data={workflows,categories,tools,components,plugins,scenarios,faults,sources,defaults};
  if(typeof module!=='undefined'&&module.exports)module.exports=data;
  root.AgentLabData=data;
})(typeof globalThis!=='undefined'?globalThis:this);
