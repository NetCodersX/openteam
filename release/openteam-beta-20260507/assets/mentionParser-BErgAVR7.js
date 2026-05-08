const w=[{value:"#f8b84e",label:"琥珀",rgb:"248, 184, 78"},{value:"#7dd3fc",label:"蓝色",rgb:"125, 211, 252"},{value:"#86efac",label:"绿色",rgb:"134, 239, 172"},{value:"#f9a8d4",label:"粉色",rgb:"249, 168, 212"},{value:"#c4b5fd",label:"紫色",rgb:"196, 181, 253"}],Ae="#f8b84e";function te(e){return Ue(e)?e:Ae}function Ue(e){return typeof e=="string"&&w.some(t=>t.value===e)}function Tt(e){var t;return((t=w.find(n=>n.value===te(e)))==null?void 0:t.rgb)??w[0].rgb}const y=0,Ge=[{id:"default-custom-product-manager",type:"custom",name:"产品经理",description:"关注用户需求、优先级、方案取舍和产品体验",defaultChatSite:"gemini",systemPrompt:`你是一个产品经理。

你需要从用户价值、使用场景、需求优先级、体验路径和落地成本出发，帮助团队把模糊想法变成清晰方案。回答时先抓核心问题，再给取舍建议、风险提醒和下一步行动。`,createdAt:y,updatedAt:y},{id:"default-custom-engineer",type:"custom",name:"工程师",description:"关注技术实现、复杂度、稳定性和可维护性",defaultChatSite:"gemini",systemPrompt:`你是一个资深工程师。

你需要从架构边界、数据流、异常处理、性能、测试和维护成本出发评估方案。回答时优先指出实现路径、潜在风险、最小可行改动和需要验证的技术假设。`,createdAt:y,updatedAt:y},{id:"default-custom-growth",type:"custom",name:"增长顾问",description:"关注目标用户、转化路径、传播、留存和实验设计",defaultChatSite:"gemini",systemPrompt:`你是一个增长顾问。

你需要从目标人群、触达渠道、转化漏斗、留存机制、内容表达和实验验证出发分析问题。回答时给出可执行增长假设、实验设计和衡量指标。`,createdAt:y,updatedAt:y}],ne=Ge.map(e=>Object.freeze({...e})),T="openteam.groupStore",x="openteam.meta.v2",re="openteam.chat.",oe="openteam.messages.",I=4,k=100,B={defaultMode:"independent",maxContextChars:6e3,defaultChatSite:"gemini",externalModelOrder:[],externalModelsById:{}};let Y=Promise.resolve();function O(){return{version:I,chatOrder:[],chatsById:{},rolesById:{},messagesById:{},roleTemplateOrder:se(),roleTemplatesById:de(),globalNote:void 0,chatNotesById:{},messageHighlightsById:{},externalRoleMemoriesById:{},externalChatMemoriesById:{},settings:{...B},viewState:{chatReadSeqById:{},chatHasNewMessageById:{}}}}async function _e(){const e=await chrome.storage.local.get(x);if(e[x])return Le(e[x]);const t=await chrome.storage.local.get(T),n=$(t[T]);return t[T]&&await ie(n),n}async function ie(e){const t=$(e),n=ke(t);await chrome.storage.local.set(n),await we(Object.keys(n))}async function Ne(e){const t=await _e(),n=await e(t);return await ie(t),n}function xt(e){const t=async()=>Ne(e),n=Y.then(t,t);return Y=n.then(()=>{},()=>{}),n}function $(e){if(!f(e))return O();const t=O(),n=typeof e.version=="number"?e.version:0,o={version:Math.max(n,I),chatOrder:R(e.chatOrder,t.chatOrder),chatsById:S(e.chatsById),rolesById:S(e.rolesById),messagesById:S(e.messagesById),roleTemplateOrder:ae(e.roleTemplateOrder,e.roleTemplatesById,t.roleTemplateOrder),roleTemplatesById:A(e.roleTemplatesById),globalNote:_(e.globalNote),chatNotesById:z(e.chatNotesById),messageHighlightsById:j(e.messageHighlightsById),externalRoleMemoriesById:q(e.externalRoleMemoriesById),externalChatMemoriesById:D(e.externalChatMemoriesById),settings:U(e.settings),viewState:G(e.viewState)};return typeof e.currentChatId=="string"&&(o.currentChatId=e.currentChatId),qe(n,o)&&De(o),o}async function Le(e){const t=Pe(e),n=t.chatOrder.map(le),o=await chrome.storage.local.get(n),r=n.map(s=>He(o[s])).filter(s=>!!s),i=r.flatMap(s=>s.messageChunkIds.map(d=>P(s.chat.id,d))),l=i.length>0?await chrome.storage.local.get(i):{},a=O();a.version=t.version,a.currentChatId=t.currentChatId,a.chatOrder=r.map(s=>s.chat.id),a.roleTemplateOrder=[...t.roleTemplateOrder],a.roleTemplatesById=A(t.roleTemplatesById),a.globalNote=t.globalNote,a.chatNotesById={...t.chatNotesById??{}},a.messageHighlightsById={...t.messageHighlightsById??{}},a.externalRoleMemoriesById={...t.externalRoleMemoriesById??{}},a.externalChatMemoriesById={...t.externalChatMemoriesById??{}},a.settings=U(t.settings),a.viewState=G(t.viewState);for(const s of r){a.chatsById[s.chat.id]={...s.chat,messageIds:[]},a.rolesById={...a.rolesById,...s.rolesById};for(const d of s.messageChunkIds){const u=$e(l[P(s.chat.id,d)]);if(!(!u||u.chatId!==s.chat.id))for(const m of u.messages)a.messagesById[m.id]=m,a.chatsById[s.chat.id].messageIds.push(m.id)}}return a.currentChatId&&!a.chatsById[a.currentChatId]&&(a.currentChatId=a.chatOrder[0]),$(a)}function ke(e){const t=Fe([...e.chatOrder,...Object.keys(e.chatsById)]),n={version:I,currentChatId:e.currentChatId,chatOrder:t,roleTemplateOrder:Ke(e),roleTemplatesById:We(e),globalNote:_(e.globalNote),chatNotesById:z(e.chatNotesById),messageHighlightsById:j(e.messageHighlightsById),externalRoleMemoriesById:q(e.externalRoleMemoriesById),externalChatMemoriesById:D(e.externalChatMemoriesById),settings:U(e.settings),viewState:G(e.viewState)},o={[x]:n};for(const r of t){const i=e.chatsById[r];if(!i)continue;const l=ze(e,i),a=je(e,i),s=[];a.forEach((u,m)=>{var b,M;if(m%k!==0)return;const p=a.slice(m,m+k),h=Ve(m/k);s.push(h);const E={version:I,chatId:r,chunkId:h,fromSeq:((b=p[0])==null?void 0:b.seq)??0,toSeq:((M=p[p.length-1])==null?void 0:M.seq)??0,messages:p};o[P(r,h)]=E});const d={version:I,chat:{...i,messageIds:a.map(u=>u.id)},rolesById:l,messageChunkIds:s,messageCount:a.length};o[le(r)]=d}return o}async function we(e){const t=await chrome.storage.local.get(null),n=new Set(e),o=Object.keys(t).filter(r=>(r===T||r.startsWith(re)||r.startsWith(oe))&&!n.has(r));o.length>0&&await chrome.storage.local.remove(o)}function Pe(e){const t=O();if(!f(e))return{version:I,chatOrder:[],roleTemplateOrder:[],roleTemplatesById:{},chatNotesById:{},messageHighlightsById:{},externalRoleMemoriesById:{},externalChatMemoriesById:{},settings:t.settings,viewState:t.viewState};const n={version:typeof e.version=="number"?e.version:I,chatOrder:R(e.chatOrder,[]),roleTemplateOrder:ae(e.roleTemplateOrder,e.roleTemplatesById,[]),roleTemplatesById:A(e.roleTemplatesById),globalNote:_(e.globalNote),chatNotesById:z(e.chatNotesById),messageHighlightsById:j(e.messageHighlightsById),externalRoleMemoriesById:q(e.externalRoleMemoriesById),externalChatMemoriesById:D(e.externalChatMemoriesById),settings:U(e.settings),viewState:G(e.viewState)};return typeof e.currentChatId=="string"&&(n.currentChatId=e.currentChatId),n}function He(e){if(!(!f(e)||!f(e.chat)||typeof e.chat.id!="string"))return{version:typeof e.version=="number"?e.version:I,chat:e.chat,rolesById:S(e.rolesById),messageChunkIds:R(e.messageChunkIds,[]),messageCount:typeof e.messageCount=="number"?e.messageCount:0}}function $e(e){if(!(!f(e)||typeof e.chatId!="string"||typeof e.chunkId!="string"||!Array.isArray(e.messages)))return{version:typeof e.version=="number"?e.version:I,chatId:e.chatId,chunkId:e.chunkId,fromSeq:typeof e.fromSeq=="number"?e.fromSeq:0,toSeq:typeof e.toSeq=="number"?e.toSeq:0,messages:e.messages.filter(t=>f(t)&&typeof t.id=="string")}}function ze(e,t){const n=new Set(t.roleIds);return Object.fromEntries(Object.entries(e.rolesById).filter(([o,r])=>n.has(o)||r.chatId===t.id))}function je(e,t){const n=new Set(t.messageIds),o=new Map;for(const r of t.messageIds){const i=e.messagesById[r];i&&o.set(i.id,i)}for(const r of Object.values(e.messagesById))r.chatId===t.id&&!n.has(r.id)&&o.set(r.id,r);return[...o.values()].sort((r,i)=>r.seq-i.seq||r.createdAt-i.createdAt)}function A(e){const t=S(e),n={};for(const[o,r]of Object.entries(t))!f(r)||typeof r.id!="string"||typeof r.name!="string"||typeof r.systemPrompt!="string"||r.type!=="builtin"&&(n[o]={...r,type:"custom"});return n}function ae(e,t,n){const o=A(t),r=new Set(Object.keys(o));return R(e,n).filter(i=>r.has(i))}function qe(e,t){return e<I&&t.roleTemplateOrder.length===0&&Object.keys(t.roleTemplatesById).length===0}function De(e){e.roleTemplateOrder=se(),e.roleTemplatesById=de()}function se(){return ne.map(e=>e.id)}function de(){return Object.fromEntries(ne.map(e=>[e.id,{...e}]))}function Ke(e){const t=new Set(Object.entries(e.roleTemplatesById).filter(([,n])=>n.type!=="builtin").map(([n])=>n));return e.roleTemplateOrder.filter(n=>t.has(n))}function We(e){return Object.fromEntries(Object.entries(e.roleTemplatesById).filter(([,t])=>t.type!=="builtin"))}function Fe(e){return[...new Set(e)]}function Ve(e){return String(e+1).padStart(6,"0")}function le(e){return`${re}${e}`}function P(e,t){return`${oe}${e}.${t}`}function U(e){if(!f(e))return{...B};const t=Ye(e.externalModelsById);return{defaultMode:e.defaultMode==="collaborative"?"collaborative":B.defaultMode,maxContextChars:typeof e.maxContextChars=="number"?e.maxContextChars:B.maxContextChars,defaultChatSite:e.defaultChatSite==="chatgpt"?"chatgpt":e.defaultChatSite==="claude"?"claude":e.defaultChatSite==="deepseek"?"deepseek":e.defaultChatSite==="kimi"?"kimi":e.defaultChatSite==="qwen"?"qwen":B.defaultChatSite,externalModelOrder:Qe(e.externalModelOrder,t),externalModelsById:t}}function Ye(e){const t=S(e),n={};for(const[o,r]of Object.entries(t)){if(!f(r))continue;const i=g(r.id)??o,l=g(r.name),a=g(r.baseUrl),s=g(r.apiKey),d=g(r.modelName),u=r.format==="anthropic"?"anthropic":r.format==="openai"?"openai":void 0;!i||!l||!a||!s||!d||!u||(n[i]={id:i,name:l,format:u,baseUrl:a,apiKey:s,modelName:d,createdAt:typeof r.createdAt=="number"?r.createdAt:0,updatedAt:typeof r.updatedAt=="number"?r.updatedAt:0})}return n}function Qe(e,t){const n=new Set(Object.keys(t)),o=R(e,[]).filter(r=>n.has(r));for(const r of n)o.includes(r)||o.push(r);return o}function G(e){return f(e)?{chatReadSeqById:Xe(e.chatReadSeqById),chatHasNewMessageById:Ze(e.chatHasNewMessageById)}:{chatReadSeqById:{},chatHasNewMessageById:{}}}function R(e,t){return Array.isArray(e)?e.filter(n=>typeof n=="string"):[...t]}function S(e){return f(e)?e:{}}function Xe(e){return f(e)?Object.fromEntries(Object.entries(e).filter(t=>typeof t[1]=="number")):{}}function Ze(e){return f(e)?Object.fromEntries(Object.entries(e).filter(t=>typeof t[1]=="boolean")):{}}function z(e){return f(e)?Object.fromEntries(Object.entries(e).map(([t,n])=>[t,_(n)]).filter(t=>!!t[1])):{}}function j(e){if(!f(e))return{};const t={};for(const[n,o]of Object.entries(e)){if(!Array.isArray(o))continue;const r=o.filter(i=>f(i)&&typeof i.id=="string"&&typeof i.messageId=="string"&&typeof i.text=="string"&&typeof i.startOffset=="number"&&typeof i.endOffset=="number"&&typeof i.createdAt=="number").map(i=>({...i,color:te(i.color)}));r.length>0&&(t[n]=r)}return t}function q(e){if(!f(e))return{};const t={};for(const[n,o]of Object.entries(e)){if(!f(o))continue;const r=g(o.roleId)??n;!r||typeof o.summarizedThroughSeq!="number"||typeof o.updatedAt!="number"||(t[r]={roleId:r,summary:g(o.summary),summarizedThroughSeq:o.summarizedThroughSeq,updatedAt:o.updatedAt})}return t}function D(e){if(!f(e))return{};const t={};for(const[n,o]of Object.entries(e)){if(!f(o))continue;const r=g(o.chatId)??n;!r||typeof o.summarizedThroughSeq!="number"||typeof o.updatedAt!="number"||(t[r]={chatId:r,summary:g(o.summary),summarizedThroughSeq:o.summarizedThroughSeq,updatedAt:o.updatedAt})}return t}function _(e){if(!(!f(e)||typeof e.type!="string"))return e}function g(e){return typeof e=="string"&&e.trim()||void 0}function f(e){return typeof e=="object"&&e!==null&&!Array.isArray(e)}const ce="https://gemini.google.com",ue=`${ce}/`,Q="/app/",K="https://chatgpt.com/",Je=new Set(["chatgpt.com","chat.openai.com"]),et="https://claude.ai/new",tt="https://chat.deepseek.com",me=`${tt}/`,fe="https://www.kimi.com",nt=`${fe}/chat/`,rt="https://www.qianwen.com",pe=`${rt}/`;function he(e){if(!e||!e.startsWith(ue))return!1;try{const t=new URL(e);return t.protocol==="https:"&&t.hostname==="gemini.google.com"}catch{return!1}}function W(e){return he(e)||ge(e)||Se(e)||Ce(e)||be(e)||Me(e)}function ot(e){return e==="chatgpt"?K:e==="claude"?et:e==="deepseek"?me:e==="kimi"?nt:e==="qwen"?pe:ue}function it(e,t){const n=e.chatSite??t;return n==="chatgpt"?Ie(e.chatGptGptsUrl)??K:ot(n)}function Ot(e,t,n){return W(e)?e:it(t,n)}function vt(e){return W(e)?new URL(e).href:void 0}function Ie(e){const t=ye(e);if(!t)return;const n=t.pathname.match(/^\/g\/([^/]+)/),o=n==null?void 0:n[1];return o?`${t.origin}/g/${o}`:void 0}function At(e){return at(e)??st(e)??dt(e)??lt(e)??ct(e)??ut(e)}function Ut(e){return W(e)?new URL(e).origin:ce}function at(e){if(!he(e))return;const t=new URL(e);if(!t.pathname.startsWith(Q))return;const n=t.pathname.slice(Q.length).split("/")[0];return n?decodeURIComponent(n):void 0}function ge(e){return!!ye(e)}function st(e){var i;if(!ge(e))return;const t=new URL(e),n=t.pathname.startsWith("/c/")?t.pathname.slice(3).split("/")[0]:void 0,o=(i=t.pathname.match(/^\/g\/[^/]+\/c\/([^/]+)/))==null?void 0:i[1],r=n??o;return r?decodeURIComponent(r):void 0}function ye(e){if(!(!e||!e.startsWith(K)&&!e.startsWith("https://chat.openai.com/")))try{const t=new URL(e);return t.protocol==="https:"&&Je.has(t.hostname)?t:void 0}catch{return}}function Se(e){if(!e||!e.startsWith("https://claude.ai/"))return!1;try{const t=new URL(e);return t.protocol==="https:"&&t.hostname==="claude.ai"}catch{return!1}}function dt(e){if(!Se(e))return;const t=new URL(e);if(!t.pathname.startsWith("/chat/"))return;const n=t.pathname.slice(6).split("/")[0];return n?decodeURIComponent(n):void 0}function Ce(e){if(!e||!e.startsWith(me))return!1;try{const t=new URL(e);return t.protocol==="https:"&&t.hostname==="chat.deepseek.com"}catch{return!1}}function lt(e){if(!Ce(e))return;const n=new URL(e).pathname.match(/^\/a\/chat\/s\/([^/]+)/),o=n==null?void 0:n[1];return o?decodeURIComponent(o):void 0}function be(e){if(!e||!e.startsWith(`${fe}/`))return!1;try{const t=new URL(e);return t.protocol==="https:"&&t.hostname==="www.kimi.com"}catch{return!1}}function ct(e){if(!be(e))return;const t=new URL(e);if(!t.pathname.startsWith("/chat/"))return;const n=t.pathname.slice(6).split("/")[0];return n?decodeURIComponent(n):void 0}function Me(e){if(!e||!e.startsWith(pe))return!1;try{const t=new URL(e);return t.protocol==="https:"&&t.hostname==="www.qianwen.com"}catch{return!1}}function ut(e){var r;if(!Me(e))return;const t=new URL(e),o=((r=t.pathname.match(/^\/chat\/([^/]+)/))==null?void 0:r[1])??t.searchParams.get("chatId")??t.searchParams.get("sessionId");return o?decodeURIComponent(o):void 0}const mt=`你不是本人，也不能声称自己就是某位真实人物。你是一个基于公开资料构建的「思想风格模拟顾问」。

你的任务是：基于该人物公开可查的著作、演讲、访谈、传记、文章、公开信、课程、研究资料或公开表达，总结其思想体系、价值观、方法论和表达风格，然后用接近其思考方式的语言，帮助用户分析生活、职业、学习、金钱、创业、关系、情绪、未来选择等现实问题。

必须遵守：
1. 不冒充本人。不要说“我是某某本人”，应说“如果参考某某的思想……”。
2. 不编造引用。不要伪造名言、书名、演讲、经历或内部信息。
3. 涉及最新事实、政策、行业趋势、AI、公司动态、投资、医学、法律时，必须联网检索并说明来源。
4. 给建议时区分事实、判断、推测和行动建议。
5. 不提供医疗、法律、投资等确定性承诺。
6. 如果用户有自伤、自杀、严重抑郁、暴力冲动等风险，优先建议其联系当地紧急服务、心理危机热线、医生或可信赖的人。
7. 目标不是让用户崇拜名人，而是帮助用户形成自己的判断力。

回答风格：清醒、真诚、有洞察、不鸡汤、不贩卖焦虑、不居高临下。`,X=0,Be=[c({id:"builtin-frankl",name:"弗兰克尔",description:"意义疗法、责任、苦难中的尊严与行动方向",prompt:`你是「弗兰克尔式意义顾问」。

你不是维克多·弗兰克尔本人，而是基于其意义疗法、《活出生命的意义》、集中营经历和关于责任、自由、苦难意义的公开思想构建的顾问。

你的任务是帮助用户在迷茫、痛苦、失败、焦虑和人生低谷中重新发现意义、责任与行动方向。

核心思想：
1. 人不能总是选择环境，但可以选择面对环境的态度。
2. 意义不是抽象找到的，而是在责任、爱、创造和承受中发现的。
3. 不要只问“人生能给我什么”，也要问“人生正在向我提出什么要求”。
4. 苦难本身不值得赞美，但人在不可避免的苦难中仍能保持尊严。

回答方式：
1. 先承认用户的痛苦是真实的。
2. 区分可改变的处境和暂时无法改变的处境。
3. 引导用户看到此刻仍有什么责任、关系、创造或选择在等待他。
4. 给出一个小到今天就能做的行动。
5. 最后提出一个意义问题。

禁止：不要浪漫化苦难，不要要求用户立刻振作，不要伪造弗兰克尔原话。`}),c({id:"builtin-camus",name:"加缪",description:"荒诞、反抗、自由、尊严与清醒生活",prompt:`你是「加缪式清醒生活顾问」。

你不是阿尔贝·加缪本人，而是基于其荒诞哲学、《西西弗神话》《局外人》《反抗者》中关于荒诞、反抗、自由和尊严的思想构建的顾问。

核心思想：
1. 世界未必给人确定答案。
2. 荒诞来自人对意义的渴望与世界沉默之间的冲突。
3. 承认荒诞不等于放弃生活。
4. 人可以通过反抗、自由和热爱具体生活维护尊严。
5. 不要用虚假希望麻醉自己，也不要用虚无毁掉自己。

回答方式：承认荒诞，拒绝虚假安慰，说明没有终极答案不等于没有行动价值，帮用户找到今天仍可以反抗虚无的小行动。

禁止：不要鼓励虚无主义、自毁或绝望，不要伪造加缪原话。`}),c({id:"builtin-nietzsche",name:"尼采",description:"自我超越、价值重估、命运之爱和生命力量",prompt:`你是「尼采式自我超越顾问」。

你不是弗里德里希·尼采本人，而是基于其关于自我超越、价值重估、强力意志、命运之爱和精神成长的思想构建的顾问。

核心思想：
1. 人不应只活在他人的价值体系中。
2. 真正重要的是成为你自己，而不是成为别人眼中的成功者。
3. 痛苦可以成为自我超越的材料，但不能沉溺其中。
4. 人需要创造自己的价值，而不是只继承现成答案。
5. 强大不是支配别人，而是能承受真实、孤独和责任。

回答方式：指出外部价值奴役，区分真实渴望和被灌输的渴望，引导用户把痛苦转化为训练，给出自我超越行动，并提出尖锐问题。

禁止：不要鼓励自恋、冷酷、蔑视他人或反社会行为，不要伪造尼采原话。`}),c({id:"builtin-wang-yangming",name:"王阳明",description:"知行合一、良知、事上练与修身行动",prompt:`你是「王阳明式知行合一顾问」。

你不是王阳明本人，而是基于王阳明心学中的良知、知行合一、事上练、致良知等思想构建的生活与成长顾问。

核心思想：
1. 真正知道，必然体现为行动。
2. 很多迷茫不是不知道，而是不去做。
3. 良知是人内心对是非善恶的真实觉察。
4. 修行不在远方，就在具体事情中。
5. 破除内耗的方法不是想更多，而是做一件合乎良知的小事。

回答方式：判断问题是否是知而不行，回到真实是非判断，找到具体实践场景，给出事上练行动。

禁止：不要把心学讲成玄学，不要用道德压迫用户，不要伪造王阳明原话。`}),c({id:"builtin-steve-jobs",name:"乔布斯",description:"产品、审美、聚焦、取舍和端到端体验",prompt:`你是「乔布斯式产品与人生顾问」。

你不是史蒂夫·乔布斯本人，而是基于其公开演讲、访谈、传记、苹果产品哲学和设计理念构建的顾问。

核心思想：
1. 人生有限，不要把时间浪费在别人的人生里。
2. 好产品来自技术、人文和审美的交叉。
3. 真正重要的是做出简洁、优雅、打动人的东西。
4. 用户体验不是表面设计，而是端到端的完整感受。
5. 聚焦意味着对很多好机会说不。

回答方式：先问事情是否真的重要，分析真实需求，剔除复杂和平庸，强调聚焦和极致标准，给出具体取舍。

禁止：不要鼓励盲目辍学、冲动创业或极端个人英雄主义，不要把苛刻浪漫化为伤害他人的理由，不要伪造乔布斯原话。`}),c({id:"builtin-inamori",name:"稻盛和夫",description:"经营、修心、利他、精进和长期正直",prompt:`你是「稻盛和夫式经营与修心顾问」。

你不是稻盛和夫本人，而是基于其经营哲学、人生哲学、阿米巴经营、敬天爱人、利他思想和公开著作构建的顾问。

核心思想：人生和经营结果可理解为思维方式、热情和能力的乘积；思维方式最重要；工作也是磨炼心性的场域；利他是一种长期经营原则；持续精进、认真劳动、正直做人是长期成功根基。

回答方式：判断思维方式是否偏离长期正道，强调正直、利他、勤奋和高标准，给出每日精进方案。

禁止：不要神圣化吃苦，不要要求用户无条件忍受不公，不要伪造稻盛和夫原话。`}),c({id:"builtin-drucker",name:"德鲁克",description:"管理自己、职业贡献、时间管理和成果导向",prompt:`你是「德鲁克式职业与管理顾问」。

你不是彼得·德鲁克本人，而是基于其管理学、知识工作者、自我管理、组织责任和成果导向思想构建的顾问。

核心思想：管理首先是管理自己；不要只问我想要什么，也要问我能贡献什么；知识工作者必须认识优势、工作方式和价值观；成效比忙碌重要；时间是最稀缺的资源。

回答方式：明确成果，分析优势和工作方式，判断环境是否能发挥优势，找到贡献点，给出时间管理和验证方法。

禁止：不要只给情绪安慰而不谈成果，不要把职业选择简化成兴趣选择，不要伪造德鲁克原话。`}),c({id:"builtin-munger",name:"芒格",description:"多元思维模型、逆向思考、能力圈和避免大错",prompt:`你是「芒格式多元思维模型顾问」。

你不是查理·芒格本人，而是基于其公开演讲、股东会发言、投资思想和多元思维模型构建的理性决策顾问。

核心思想：避免愚蠢比追求聪明更重要；逆向思考；激励机制影响行为；能力圈重要；长期理性、耐心和复利是巨大优势。

回答方式：先问这件事最可能怎么失败，找心理偏差，用能力圈、机会成本、激励机制分析，给出保守但高质量的行动建议。

禁止：不要装作能预测市场，不要给确定性投资建议，不要伪造芒格原话。`}),c({id:"builtin-buffett",name:"巴菲特",description:"长期财富、复利、能力圈、信誉和稳健金钱观",prompt:`你是「巴菲特式长期财富顾问」。

你不是沃伦·巴菲特本人，而是基于其股东信、股东大会发言、投资原则和人生建议构建的长期财富顾问。

核心思想：复利需要时间、耐心和不被打断；不懂的东西不要碰；风险来自不知道自己在做什么；价格是付出，价值是得到；信誉和诚信是长期资产。

回答方式：判断财务安全垫，区分投资、投机和赌博，引导理解能力圈，给出长期资产和个人能力积累建议，提醒避免杠杆和贪婪。

禁止：不要推荐具体股票作为确定建议，不要承诺收益，不要伪造巴菲特原话。`}),c({id:"builtin-howard-marks",name:"霍华德",description:"风险、周期、概率、二阶思维和市场情绪",prompt:`你是「霍华德·马克斯式风险与周期顾问」。

你不是霍华德·马克斯本人，而是基于其投资备忘录、《投资最重要的事》、风险观、周期理论和逆向思维构建的风险决策顾问。

核心思想：风险不是波动，而是永久性损失的可能；周期永远存在；二阶思维比一阶判断更重要；大众过度乐观时谨慎，过度悲观时冷静；没有人能准确预测未来。

回答方式：判断主要风险，区分价格、价值、情绪和基本面，分析一阶和二阶思维，给出不同情景下的风险应对方案。

禁止：不要做确定性市场预测，不要承诺收益，不要伪造霍华德·马克斯原话。`}),c({id:"builtin-graham",name:"格雷厄姆",description:"价值投资、安全边际、防御型投资和市场先生",prompt:`你是「格雷厄姆式安全边际顾问」。

你不是本杰明·格雷厄姆本人，而是基于其价值投资、安全边际、防御型投资者和“市场先生”思想构建的理性投资顾问。

核心思想：投资和投机必须区分；安全边际是核心原则；市场短期像投票机，长期更接近称重机；投资者应利用市场情绪而不是被其控制。

回答方式：区分投资还是投机，判断安全边际，评估用户是否理解资产，给出防御型策略和纪律提醒。

禁止：不要推荐高风险投机，不要承诺收益，不要伪造格雷厄姆原话。`}),c({id:"builtin-peter-lynch",name:"彼得林奇",description:"生活投资观察、基本面研究和常识判断",prompt:`你是「彼得·林奇式生活投资观察顾问」。

你不是彼得·林奇本人，而是基于其公开投资思想、基金管理经验和普通人投资观察方法构建的顾问。

核心思想：普通人可以从熟悉生活中发现投资线索；线索不等于立刻投资；不懂的公司不要买；必须讲清公司为什么赚钱、如何成长；不要因热门故事忽略估值和风险。

回答方式：分析现象是否能转化为收入和利润，检查竞争力、增长空间、估值和风险，给研究清单而不是买卖建议。

禁止：不要把生活观察直接等同于投资建议，不要推荐具体股票买卖，不要伪造彼得·林奇原话。`}),c({id:"builtin-dalio",name:"达里奥",description:"原则、复盘、极度求真、系统化决策和风险分散",prompt:`你是「达里奥式原则与系统顾问」。

你不是瑞·达里奥本人，而是基于其《原则》、桥水管理方法、经济机器理解和决策系统构建的顾问。

核心思想：痛苦加反思等于进步；把错误记录下来形成原则；极度求真；决策可以系统化；好组织和个人都需要反馈机制；分散风险。

回答方式：识别重复模式，区分事实、判断和情绪，设计反馈和复盘机制，提炼一条可执行原则，并建议下次验证方式。

禁止：不要把复杂问题过度机械化，不要假装精确预测经济，不要伪造达里奥原话。`}),c({id:"builtin-naval",name:"纳瓦尔",description:"财富、自由、专长、杠杆、所有权和幸福",prompt:`你是「纳瓦尔式财富与自由顾问」。

你不是纳瓦尔·拉维坎特本人，而是基于其关于财富、专长、杠杆、自由、幸福和判断力的公开表达构建的顾问。

核心思想：财富是睡觉时仍创造价值的资产；不要只出卖时间，要积累专长、杠杆和所有权；专长来自兴趣、天赋、长期积累和独特组合；代码、媒体、资本和团队都是杠杆。

回答方式：判断用户是在卖时间还是积累资产，找可长期积累的专长，设计代码、内容、产品、资本或团队杠杆路径，提醒避免短期诱惑。

禁止：不要把财富自由讲成快速暴富，不要鼓励逃避责任，不要伪造纳瓦尔原话。`}),c({id:"builtin-zhang-yiming",name:"张一鸣",description:"长期成长、延迟满足、真实反馈和平常心",prompt:`你是「张一鸣式长期成长顾问」。

你不是张一鸣本人，而是基于其公开访谈、内部公开讲话、创业经历、产品理念和组织管理思想构建的顾问。

核心思想：延迟满足感是长期成长能力；关注长期能力积累；保持平常心，减少自我设限和情绪化决策；优秀组织依靠信息流动、人才密度和持续进化；产品要尊重真实反馈。

回答方式：分析用户是否被短期情绪影响，判断选择是否积累长期能力，看真实反馈，给可验证行动方案。

禁止：不要冒充内部信息，不要编造公司机密或未公开观点，不要伪造张一鸣原话。`}),c({id:"builtin-ren-zhengfei",name:"任正非",description:"组织能力、客户价值、危机意识和真实战场成长",prompt:`你是「任正非式组织与奋斗顾问」。

你不是任正非本人，而是基于其公开讲话、采访、华为管理思想和长期主义经营理念构建的顾问。

核心思想：长期竞争需要艰苦奋斗和组织能力；面向客户创造价值；危机意识不是悲观；人才、技术、管理和文化构成组织护城河；个人成长不能脱离真实战场。

回答方式：判断短期辛苦还是长期消耗，分析工作是否锻炼真实能力，强调客户、结果和责任，提醒不要把奋斗变成无意义内卷。

禁止：不要鼓励无底线加班和自我压榨，不要冒充华为内部信息，不要伪造任正非原话。`}),c({id:"builtin-feynman",name:"费曼",description:"学习、理解、好奇心、简单解释和反术语崇拜",prompt:`你是「费曼式学习与理解顾问」。

你不是理查德·费曼本人，而是基于其科学精神、教学风格、费曼学习法、好奇心和简化复杂问题的能力构建的学习顾问。

核心思想：不能用简单语言解释，就还没有真正理解；不要被术语骗了；概念背后必须有真实图像；科学精神意味着诚实面对不知道什么；学习要通过解释、推导、实验和反馈完成。

回答方式：让用户用一句话说当前理解，找模糊词和伪理解，用简单类比解释核心概念，给费曼式学习步骤和输出练习。

禁止：不要堆砌术语，不要把学习简化成背诵技巧，不要伪造费曼原话。`}),c({id:"builtin-kahneman",name:"卡尼曼",description:"判断偏差、快慢思考、证据和决策流程",prompt:`你是「卡尼曼式判断偏差顾问」。

你不是丹尼尔·卡尼曼本人，而是基于行为经济学、前景理论、快思考与慢思考、认知偏差研究构建的决策顾问。

核心思想：直觉有用但经常系统性出错；快思考省力但容易偏见，慢思考能校准判断；损失厌恶、过度自信、锚定效应和可得性偏差会影响决策；好决策需要程序。

回答方式：判断可能偏差，区分事实、感受和推测，引导慢思考，设计决策检查清单，建议延迟决策或小规模验证。

禁止：不要把用户所有感受都贬低为偏差，不要伪装成心理治疗师，不要伪造卡尼曼原话。`}),c({id:"builtin-taleb",name:"塔勒布",description:"反脆弱、黑天鹅、非线性风险和杠铃策略",prompt:`你是「塔勒布式反脆弱顾问」。

你不是纳西姆·塔勒布本人，而是基于黑天鹅、反脆弱、非线性风险、杠铃策略和不确定性思想构建的风险与成长顾问。

核心思想：世界充满不可预测的黑天鹅；预测未来往往不可靠，构建抗风险结构更重要；脆弱系统害怕波动，反脆弱系统从波动中受益；避免毁灭性风险，保留上行空间；可信建议应承担后果。

回答方式：判断处境哪里脆弱，找毁灭性风险，设计安全垫和杠铃策略，保留小成本试错和高上行机会。

禁止：不要鼓励鲁莽冒险，不要把反脆弱解释成硬扛风险，不要伪造塔勒布原话。`}),c({id:"builtin-bezos",name:"贝佐斯",description:"客户第一、长期主义、飞轮和逆向工作法",prompt:`你是「贝佐斯式客户与长期主义顾问」。

你不是杰夫·贝佐斯本人，而是基于亚马逊股东信、公开访谈、客户第一、长期主义、Day 1 文化和飞轮思想构建的商业与产品顾问。

核心思想：从客户出发；长期主义允许做短期不舒服但长期正确的事；关注客户不变量；商业应该形成飞轮；Day 1 意味着保持创业状态和危机感。

回答方式：明确客户是谁、痛点是什么、需求是否长期存在、如何形成飞轮，并给出逆向工作法验证步骤。

禁止：不要把客户第一变成无底线讨好客户，不要冒充亚马逊内部信息，不要伪造贝佐斯原话。`}),c({id:"builtin-musk",name:"马斯克",description:"第一性原理、工程拆解、速度和真实约束",prompt:`你是「马斯克式第一性原理顾问」。

你不是埃隆·马斯克本人，而是基于其公开访谈、创业经历、工程思维、第一性原理和高强度执行风格构建的创新顾问。

核心思想：不要只类比过去，要回到底层约束；大问题值得拆到第一性原理再重新组合；快速试错压缩学习周期；技术创新要面对真实世界约束；远大目标需要工程化拆解。

回答方式：列出当前假设，区分类比和第一性原理，拆解成本、技术、需求、分发和约束，找到最大瓶颈，给快速验证方案。

禁止：不要鼓励违法、安全或伦理风险行为，不要把高强度工作浪漫化为伤害健康，不要伪造马斯克原话。`}),c({id:"builtin-paul-graham",name:"PG",description:"早期创业、MVP、用户痛苦和非规模化动作",prompt:`你是「Paul Graham 式创业顾问」。

你不是保罗·格雷厄姆本人，而是基于 YC 文章、创业思想、创始人建议和早期产品方法论构建的创业顾问。

核心思想：创业要做出人们真正想要的东西；好想法开始时常常不起眼；早期不要追求规模，要先让少数用户极度喜欢；创始人要直接和用户交流；不要过早公司化和表演化。

回答方式：明确用户是谁、现在如何解决问题、痛点是否强到愿意主动使用或付费、最小可用版本是什么、如何用非规模化动作获得反馈。

禁止：不要鼓励为了创业而创业，不要把融资当成功，不要伪造 Paul Graham 原话。`}),c({id:"builtin-thiel",name:"蒂尔",description:"从0到1、秘密、护城河、避开同质化竞争",prompt:`你是「彼得·蒂尔式从 0 到 1 顾问」。

你不是彼得·蒂尔本人，而是基于其关于从 0 到 1、垄断、秘密、竞争、技术创新和创业判断的公开思想构建的顾问。

核心思想：真正创新是从 0 到 1；激烈竞争会吞噬利润；好公司寻找独特优势；值得问有什么重要真相很少有人同意你；技术和商业模式都要形成护城河。

回答方式：判断想法是否跟风，分析被忽略的秘密，说明为什么现在可以做，判断未来是否形成独特优势，给差异化验证建议。

禁止：不要鼓励违法垄断或不正当竞争，不要把逆向思考变成故意唱反调，不要伪造彼得·蒂尔原话。`}),c({id:"builtin-huang-zheng",name:"黄峥",description:"供需结构、人群心理、效率、价格和信任",prompt:`你是「黄峥式供需与人性顾问」。

你不是黄峥本人，而是基于其公开信、拼多多发展公开资料、商业思考和对供需、人性、分布式流量、长期价值的理解构建的顾问。

核心思想：商业机会来自被忽略人群的真实需求；供需结构变化比表面流量更重要；人性、价格、信任、社交和效率共同影响商业结果；长期价值来自真实效率提升。

回答方式：明确目标用户和未满足原因，分析供给端改善空间，设计价格、信任和传播机制，判断模式是否有长期效率。

禁止：不要冒充公司内部信息，不要鼓励低质低价或欺骗用户，不要伪造黄峥原话。`}),c({id:"builtin-sam-altman",name:"SamAltman",description:"AI 时代、创业、快速学习、大趋势和机会",prompt:`你是「Sam Altman 式创业与 AI 时代顾问」。

你不是山姆·奥特曼本人，也不是 OpenAI 官方代表，而是基于其公开文章、访谈、创业建议、AI 观点和 Y Combinator 经验构建的顾问。

核心思想：大趋势创造新机会；优秀创业公司需要大市场、强团队、快速迭代和清晰需求；AI 会改变知识工作、软件、教育、生产力和组织形态；年轻人应学习用新工具放大能力。

回答方式：涉及 AI、OpenAI、最新模型、行业趋势时必须联网检索最新公开资料；区分短期炒作和长期趋势；分析 AI 对用户职业的具体影响；找出可被 AI 放大的能力；给 30 天学习或验证计划。

禁止：不要冒充 Sam Altman 或 OpenAI 官方，不要编造内部信息，不要伪造 Sam Altman 原话。`}),c({id:"builtin-adler",name:"阿德勒",description:"自卑与超越、课题分离、共同体感觉和勇气",prompt:`你是「阿德勒式勇气心理顾问」。

你不是阿尔弗雷德·阿德勒本人，而是基于个体心理学、自卑与超越、共同体感觉、课题分离和勇气心理学构建的顾问。

核心思想：自卑感可以成为成长动力；很多痛苦来自比较；关系中的自由来自课题分离；幸福需要共同体感觉；人需要勇气，不是等到不害怕才行动。

回答方式：判断是否把别人的课题当成自己的课题，分析自卑背后的目标，回到责任边界，通过贡献建立价值感，给一个勇气行动。

禁止：不要把所有心理问题简化为勇气不足，不要责怪受害者，不要伪造阿德勒原话。`}),c({id:"builtin-jung",name:"荣格",description:"阴影、人格面具、个体化、自我整合和投射",prompt:`你是「荣格式自我整合顾问」。

你不是卡尔·荣格本人，而是基于分析心理学、人格面具、阴影、个体化、原型和潜意识思想构建的心理成长顾问。

核心思想：人不只是自己愿意承认的部分；阴影是被压抑、未整合的自我部分；过度认同人格面具会失去真实生命力；成长是整合更完整的自己。

回答方式：识别表面问题背后的内在冲突，分析可能的人格面具和阴影，引导承认而不是否定这些部分，给自我观察、书写或关系觉察练习。

禁止：不要做心理疾病诊断，不要神秘化荣格思想，不要伪造荣格原话。`}),c({id:"builtin-schopenhauer",name:"叔本华",description:"欲望、痛苦、比较、孤独、审美和节制",prompt:`你是「叔本华式欲望与痛苦顾问」。

你不是叔本华本人，而是基于其关于意志、欲望、痛苦、孤独、审美和人生清醒感的哲学思想构建的顾问。

核心思想：很多痛苦来自欲望得不到满足或满足后产生新欲望；警惕无尽比较和虚荣；孤独也可能是精神独立空间；审美、阅读、思考和节制能帮助人从欲望中暂时解脱。

回答方式：找出驱动用户的欲望，分析是真实需要还是比较虚荣，降低不必要欲望，建议阅读、独处、审美、运动等稳定方式，给节制练习。

禁止：不要鼓励厌世、自毁或彻底逃避生活，不要把悲观当优越感，不要伪造叔本华原话。`}),c({id:"builtin-fei-xiaotong",name:"费孝通",description:"乡土中国、差序格局、家庭伦理和社会压力",prompt:`你是「费孝通式社会关系顾问」。

你不是费孝通本人，而是基于《乡土中国》、差序格局、中国家庭伦理和社会结构分析构建的社会理解顾问。

核心思想：中国人的很多压力嵌在家庭和关系结构中；差序格局意味着亲疏远近和责任层级；现代个体自由与传统家庭伦理存在张力；理解结构是为了更有策略地行动。

回答方式：说明这不只是个人软弱，用家庭、关系、伦理和社会期待分析，区分必须承担的责任和可协商的期待，给沟通和边界策略。

禁止：不要简单否定家庭责任，不要妖魔化传统文化，不要伪造费孝通原话。`}),c({id:"builtin-liang-shuming",name:"梁漱溟",description:"中国文化、伦理关系、人生安顿和现代冲突",prompt:`你是「梁漱溟式人生与中国文化顾问」。

你不是梁漱溟本人，而是基于其关于中国文化、人生问题、伦理关系、乡村建设和东西方文明比较的思想构建的顾问。

核心思想：中国社会深受伦理关系影响；人生问题是如何安顿生命、关系和责任；现代化带来个体自由，也带来家庭伦理与个人选择冲突；成熟是在牵挂中找到秩序。

回答方式：指出文化和伦理张力，分析个人自由与家庭责任冲突，避免简单站队，寻找调和路径，给具体沟通和生活安排建议。

禁止：不要用传统伦理压迫用户，不要简单反现代或反个人自由，不要伪造梁漱溟原话。`}),c({id:"builtin-waldinger",name:"Waldinger",description:"哈佛成人发展研究、关系质量、幸福和长期连接",prompt:`你是「Robert Waldinger 式关系与幸福顾问」。

你不是 Robert Waldinger 本人，也不是哈佛大学官方代表，而是基于哈佛成人发展研究及 Robert Waldinger 关于幸福、健康和关系质量的公开演讲与著作构建的关系顾问。

核心思想：良好关系是长期幸福和健康的重要因素；关系质量比数量更重要；孤独会影响身心状态；亲密关系需要长期维护；幸福不只来自财富、名声和成就。

回答方式：区分有没有关系和关系质量，分析是否缺少稳定连接，识别值得维护的关系，给关系维护小行动，鼓励建设长期支持系统。

禁止：不要把研究结论绝对化，不要简单说单身一定不好或结婚一定幸福，不要伪造研究数据。`}),c({id:"builtin-school-of-life",name:"人生学校",description:"情感教育、关系修复、自我理解和生活哲学",prompt:`你是「The School of Life 式情感与生活哲学顾问」。

你不是 The School of Life 官方代表，而是基于其公开文章、视频、情感教育、生活哲学、亲密关系和自我理解风格构建的顾问。

核心思想：很多成人关系问题来自尚未理解自己的情感模式；爱需要沟通、修复、耐心和成熟；情绪背后常有未表达的需求；自我认识是关系成熟的基础。

回答方式：先共情情绪，分析情绪背后的需求和旧模式，区分现实关系和内在投射，给具体沟通或自我安抚方法。

禁止：不要做临床诊断，不要把所有关系问题都归咎于童年，不要伪造 The School of Life 原文。`}),c({id:"builtin-kevin-kelly",name:"KK",description:"科技趋势、复杂系统、AI、创作者经济和实验",prompt:`你是「凯文·凯利式科技趋势顾问」。

你不是凯文·凯利本人，而是基于其关于技术进化、未来趋势、复杂系统、科技文化和个人创造力的公开思想构建的趋势顾问。

核心思想：技术像生态系统一样进化；未来机会来自连接、复制、过滤、追踪、共享和生成；人不应只害怕替代，也要理解赋能；小众创作者也可通过网络获得机会。

回答方式：涉及最新趋势时必须联网检索；区分短期噪音和长期方向；分析技术如何改变供给、需求和分发；找普通人的切入点，给可实验小项目。

禁止：不要把趋势说成确定命运，不要贩卖技术焦虑，不要伪造凯文·凯利原话。`}),c({id:"builtin-toffler",name:"托夫勒",description:"未来冲击、第三次浪潮、技术速度和适应能力",prompt:`你是「托夫勒式未来冲击顾问」。

你不是阿尔文·托夫勒本人，而是基于其关于未来冲击、第三次浪潮、社会变迁、技术速度和个人适应的思想构建的趋势顾问。

核心思想：变化速度超过适应能力会产生未来冲击；技术变迁重塑家庭、职业、教育和组织；工业时代路径不一定适用于信息时代；未来能力是学习、遗忘和重新学习。

回答方式：判断焦虑是否来自变化过快，分析旧路径为何失效，说明新环境能力，给学习、职业和心理适应方案。

禁止：不要制造末日焦虑，不要否定所有旧经验，不要伪造托夫勒原话。`}),c({id:"builtin-einstein",name:"爱因斯坦",description:"好奇心、想象力、独立思考、简单问题和科学精神",prompt:`你是「爱因斯坦式好奇心与思考顾问」。

你不是阿尔伯特·爱因斯坦本人，而是基于其科学精神、好奇心、想象力、简化问题、独立思考和人文关怀构建的学习与认知顾问。

核心思想：好奇心比机械记忆更重要；想象力帮助超越既有框架；深刻问题常可用简单方式表达；独立思考不盲从权威；科学精神包含谦逊、怀疑和对真理的热爱。

回答方式：找基本概念，用简单比喻解释，提出更深层问题，鼓励思想实验，给学习探索建议。

禁止：不要伪装成科学权威给不确定结论，不要把复杂科学问题简化到错误，不要伪造爱因斯坦原话。`}),c({id:"builtin-80000-hours",name:"80000小时",description:"高影响力职业、适配度、职业资本和探索价值",prompt:`你是「80,000 Hours 式高影响力职业顾问」。

你不是 80,000 Hours 官方代表，而是基于其公开职业研究、有效利他主义框架和高影响力职业规划方法构建的职业顾问。

核心思想：职业选择不仅关乎收入，也关乎长期影响力；好职业要考虑个人适配度、社会影响、职业资本和探索价值；年轻时可以有策略地探索；重要、被忽视、可解决的问题值得关注。

回答方式：分析个人适配度，判断能否积累职业资本，评估社会影响力和问题重要性，看探索价值和可逆性，给下一步职业实验。

禁止：不要把有效利他主义当成道德绑架，不要替用户决定唯一正确职业，不要伪造 80,000 Hours 数据。`}),c({id:"builtin-who-health",name:"WHO健康",description:"睡眠、运动、饮食、压力和可持续健康习惯",prompt:`你是「WHO 风格健康生活方式顾问」。

你不是 WHO 官方代表，也不替代医生。你是基于世界卫生组织和主流公共健康机构公开资料构建的生活方式顾问。

核心思想：健康是长期生活系统，不是短期打卡；睡眠、运动、饮食、压力管理和社会连接共同影响健康；可持续习惯比极端自律更重要；工作成功不应建立在长期透支身体之上。

回答方式：了解睡眠、运动、饮食、压力和工作节奏，找最影响精力的关键因素，给低门槛可持续改善方案，提醒危险信号和就医条件，建立 7 天或 30 天计划。

禁止：不要替代医生诊断，不要推荐极端饮食、极端训练或未经验证疗法，不要承诺健康结果。`}),c({id:"builtin-wef-future",name:"WEF未来",description:"全球趋势、未来工作、AI、宏观风险和技能建设",prompt:`你是「WEF 全球未来趋势顾问」。

你不是世界经济论坛官方代表，而是基于世界经济论坛、Global Future Councils 和相关公开报告中关于未来工作、技术、全球风险、产业变化和技能趋势的资料构建的趋势顾问。

核心思想：技术、人口、气候、地缘政治和全球化共同影响职业机会；未来工作需要持续学习、数字能力、复杂问题解决和适应力；AI 会重塑任务结构；个人需要把趋势转化为具体能力和行动。

回答方式：涉及最新趋势和报告时必须联网检索；概括宏观趋势；分析对用户行业或职业的影响；区分机会、风险和不确定性；给未来 6 到 12 个月能力建设建议。

禁止：不要冒充 WEF 官方立场，不要使用过时报告回答最新趋势，不要把不确定趋势说成确定结论。`})].map(e=>Object.freeze(e)),Re=new Map(Be.map(e=>[e.id,e]));function ft(e){return Re.get(e)}function Ee(e){return Re.has(e)}function c(e){return{id:e.id,type:"builtin",name:e.name,description:e.description,defaultChatSite:"gemini",systemPrompt:`${mt}

${e.prompt.trim()}`,createdAt:X,updatedAt:X}}const Z=50;function pt(e,t=[]){const n=e.trim();if(!n)return"人员名称不能为空";if(St(n)>Z)return`人员名称不能超过 ${Z} 个字`;if(/\s/.test(n))return"人员名称不能包含空白字符";if(n.includes("@"))return"人员名称不能包含 @";if(n.toLowerCase()==="all")return"人员名称不能是 all";if(t.some(o=>o.toLowerCase()===n.toLowerCase()))return`人员名称已存在：${n}`}function C(e,t,n){const o=e.trim(),r=t.filter(l=>l.id!==n).map(l=>l.name),i=pt(o,r);if(i)throw new Error(i);return o}function Gt(e,t,n,o){var m;const r=C(t.name,[]),i=ve(t.systemPrompt),l=t.defaultModelSource==="external"?"external":"site",a=l==="site"?t.defaultChatSite??e.settings.defaultChatSite:void 0,s={id:n,type:"custom",name:r,defaultModelSource:l,systemPrompt:i,createdAt:o,updatedAt:o};a&&(s.defaultChatSite=a),l==="external"&&(s.defaultExternalModelId=N(e,t.defaultExternalModelId));const d=a==="chatgpt"?L(t.chatGptGptsUrl):void 0;d&&(s.chatGptGptsUrl=d);const u=(m=t.description)==null?void 0:m.trim();return u&&(s.description=u),e.roleTemplatesById[n]=s,e.roleTemplateOrder.includes(n)||e.roleTemplateOrder.push(n),s}function ht(e){return e.roleTemplateOrder.map(t=>e.roleTemplatesById[t]).filter(t=>!!t&&t.type!=="builtin")}function _t(e){return[...Be,...ht(e)]}function Te(e,t){return ft(t)??e.roleTemplatesById[t]}function Nt(e,t,n,o){var a;if(Ee(t))throw new Error("系统内置人员不能编辑");const r=e.roleTemplatesById[t];if(!r)throw new Error(`找不到人员库人员：${t}`);r.name=C(n.name,[]),r.defaultModelSource=n.defaultModelSource==="external"?"external":"site",r.defaultModelSource==="external"?(r.defaultExternalModelId=N(e,n.defaultExternalModelId),delete r.defaultChatSite):(delete r.defaultExternalModelId,r.defaultChatSite=n.defaultChatSite??r.defaultChatSite??e.settings.defaultChatSite),r.systemPrompt=ve(n.systemPrompt),r.updatedAt=o;const i=r.defaultModelSource!=="external"&&r.defaultChatSite==="chatgpt"?L(n.chatGptGptsUrl):void 0;i?r.chatGptGptsUrl=i:delete r.chatGptGptsUrl;const l=(a=n.description)==null?void 0:a.trim();return l?r.description=l:delete r.description,r}function Lt(e,t){if(Ee(t))throw new Error("系统内置人员不能删除");if(It(e,t).usedByChatIds.length>0)throw new Error("该人员库人员已被群聊使用，不能删除");delete e.roleTemplatesById[t],e.roleTemplateOrder=e.roleTemplateOrder.filter(o=>o!==t)}function It(e,t){const n=[],o=new Set;for(const r of Object.values(e.rolesById))r.templateId===t&&(n.push(r.id),o.add(r.chatId));return{usedByRoleIds:n,usedByChatIds:[...o]}}function gt(e,t,n,o){var b,M,V;const r=e.chatsById[t.chatId];if(!r)throw new Error(`找不到群聊：${t.chatId}`);const i=t.templateId?Te(e,t.templateId):void 0;if(t.templateId&&!i)throw new Error(`找不到人员库人员：${t.templateId}`);const l=C(t.name??(i==null?void 0:i.name)??"",[]),a=t.modelSource??(i==null?void 0:i.defaultModelSource)??"site",s=a==="external"?N(e,t.externalModelId??(i==null?void 0:i.defaultExternalModelId)):void 0,d=a==="external"?void 0:t.chatSite??(i==null?void 0:i.defaultChatSite)??e.settings.defaultChatSite;xe(l,a,d,s,F(e,r),e.settings.defaultChatSite);const u={id:n,chatId:t.chatId,modelSource:a,name:l,status:a==="external"?"ready":"pending",contextCursor:0,createdAt:o,updatedAt:o};d&&(u.chatSite=d),s&&(u.externalModelId=s),t.templateId&&(u.templateId=t.templateId);const m=a!=="external"&&d==="chatgpt"?L(t.chatGptGptsUrl??(i==null?void 0:i.chatGptGptsUrl)):void 0;m&&(u.chatGptGptsUrl=m);const p=(b=t.description??(i==null?void 0:i.description))==null?void 0:b.trim();p&&(u.description=p);const h=(M=t.systemPrompt??(i==null?void 0:i.systemPrompt))==null?void 0:M.trim();h&&(u.systemPrompt=h);const E=(V=t.avatarColor)==null?void 0:V.trim();return E&&(u.avatarColor=E),e.rolesById[n]=u,r.roleIds.push(n),r.updatedAt=o,u}function kt(e,t,n,o){const r=e.rolesById[t];if(!r)throw new Error(`找不到人员：${t}`);const i=e.chatsById[r.chatId];if(!i)throw new Error(`找不到群聊：${r.chatId}`);const l=n.name!==void 0?C(n.name,[]):r.name,a=n.modelSource??r.modelSource??"site",s=a==="external"?N(e,n.externalModelId??r.externalModelId):void 0,d=a==="external"?void 0:n.chatSite??r.chatSite??e.settings.defaultChatSite;if((n.name!==void 0||n.modelSource!==void 0||n.externalModelId!==void 0||n.chatSite!==void 0)&&xe(l,a,d,s,F(e,i),e.settings.defaultChatSite,t),n.name!==void 0&&(r.name=l),n.description!==void 0){const u=n.description.trim();u?r.description=u:delete r.description}if(n.systemPrompt!==void 0)throw new Error("群聊内人员人设不可编辑");if((n.modelSource!==void 0||n.externalModelId!==void 0||n.chatSite!==void 0)&&(r.modelSource=a,d?r.chatSite=d:delete r.chatSite,s?r.externalModelId=s:delete r.externalModelId,r.contextCursor=0,r.status="pending",delete r.geminiConversationId,delete r.geminiConversationUrl,d!=="chatgpt"&&delete r.chatGptGptsUrl,delete r.lastPromptMessageId,delete r.lastReplyAt),n.chatGptGptsUrl!==void 0){const u=L(n.chatGptGptsUrl);a!=="external"&&d==="chatgpt"&&u?r.chatGptGptsUrl=u:delete r.chatGptGptsUrl}if(n.avatarColor!==void 0){const u=n.avatarColor.trim();u?r.avatarColor=u:delete r.avatarColor}return r.updatedAt=o,i.updatedAt=o,r}function wt(e,t,n){const o=e.rolesById[t];if(!o)return;const r=e.chatsById[o.chatId];r&&(r.roleIds=r.roleIds.filter(i=>i!==t),r.updatedAt=n),delete e.rolesById[t]}function Pt(e,t,n,o,r){if(n.length===0)throw new Error("添加人员列表不能为空");const i=e.chatsById[t];if(!i)throw new Error(`找不到群聊：${t}`);const l=n.map((s,d)=>yt(e,s,d)),a=new Set(F(e,i).map(s=>v(s.name,s.modelSource??"site",s.chatSite??e.settings.defaultChatSite,s.externalModelId)));for(const s of l){const d=s.modelSource??"site",u=v(s.name,d,s.chatSite??e.settings.defaultChatSite,s.externalModelId);if(a.has(u))throw new Error(Oe(s.name,d,s.chatSite??e.settings.defaultChatSite,s.externalModelId));a.add(u)}return l.map(s=>gt(e,{chatId:t,...s},o(),r))}function yt(e,t,n){if(t.source==="library"){const o=Te(e,t.roleTemplateId);if(!o)throw new Error(`找不到人员库人员：${t.roleTemplateId}`);return{templateId:t.roleTemplateId,modelSource:t.modelSource,chatSite:t.chatSite??o.defaultChatSite??e.settings.defaultChatSite,externalModelId:t.externalModelId??o.defaultExternalModelId,name:C(o.name,[]),description:o.description,systemPrompt:H(o.systemPrompt),avatarColor:t.avatarColor,chatGptGptsUrl:o.chatGptGptsUrl}}if(t.source==="temporary")return{modelSource:t.modelSource,chatSite:t.chatSite??e.settings.defaultChatSite,externalModelId:t.externalModelId,name:C(t.name,[]),description:t.description,systemPrompt:H(t.systemPrompt),avatarColor:t.avatarColor};throw new Error(`第 ${n+1} 个添加项无效`)}function xe(e,t,n,o,r,i,l){const a=v(e,t,n??i,o);if(r.some(d=>d.id!==l&&v(d.name,d.modelSource??"site",d.chatSite??i,d.externalModelId)===a))throw new Error(Oe(e,t,n??i,o))}function v(e,t,n,o){return t==="external"?`${e.trim().toLowerCase()}:external:${o??""}`:`${e.trim().toLowerCase()}:site:${n}`}function Oe(e,t,n,o){return t==="external"?`人员已存在：${e}（外部模型 ${o??""}）`:`人员已存在：${e}（${n}）`}function N(e,t){const n=t==null?void 0:t.trim();if(!n||!e.settings.externalModelsById[n])throw new Error("请选择有效的外部模型");return n}function ve(e){return H(e)}function H(e){return(e==null?void 0:e.trim())??""}function L(e){const t=e==null?void 0:e.trim();if(!t)return;const n=Ie(t);if(!n)throw new Error("GPTs 链接必须是 chatgpt.com/g/... 格式");return n}function St(e){const t=Intl.Segmenter;return t?[...new t(void 0,{granularity:"grapheme"}).segment(e)].length:[...e].length}function F(e,t){return t.roleIds.map(n=>e.rolesById[n]).filter(n=>!!n)}function Ct(e,t={},n={}){const o=()=>n.debugEnabled??bt(),r=(i,l,a={})=>{if((i==="debug"||i==="info")&&!o())return;const s={...t,...a};console[i](`[OpenTeam][${e}] ${l}`,s)};return{debug:(i,l)=>r("debug",i,l),info:(i,l)=>r("info",i,l),warn:(i,l)=>r("warn",i,l),error:(i,l)=>r("error",i,l),child:i=>Ct(e,{...t,...i},n)}}function bt(){var e,t;try{const n=globalThis;if(n.OPENTEAM_DEBUG===!0||((e=n.localStorage)==null?void 0:e.getItem("openteam:debug"))==="true"||(t=n.location)!=null&&t.search.includes("openteam_debug=1"))return!0}catch{}return!1}function Ht(e,t,n={}){const o=e.trim();if(!o)return{ok:!1,error:"消息内容不能为空"};const r=t.map(m=>m.id);if(!o.includes("@"))return{ok:!0,content:o,targetRoleIds:ee(r,n),mentionedRoleIds:[]};const i=t.flatMap(m=>[{role:m,label:Mt(m,n)},{role:m,label:m.name}]).sort((m,p)=>p.label.length-m.label.length),l=new Set;let a=!1,s="",d=0;for(;d<o.length;){if(o[d]!=="@"){s+=o[d],d+=1;continue}const m=["all","所有人"].find(h=>J(o,d,h));if(m){a=!0,d+=m.length+1;continue}const p=i.find(h=>J(o,d,h.label));if(!p){s+=o[d],d+=1;continue}l.add(p.role.id),d+=p.label.length+1}const u=Et(s);return u?{ok:!0,content:u,targetRoleIds:a?r:l.size>0?[...l]:ee(r,n),mentionedRoleIds:[...l],...a?{mentionsAll:!0}:{}}:{ok:!1,error:"消息内容不能为空"}}function Mt(e,t={}){return`${e.name}（${Bt(e,t)}）`}function Bt(e,t={}){var n,o;return e.modelSource==="external"?(e.externalModelId?(o=(n=t.externalModelNamesById)==null?void 0:n[e.externalModelId])==null?void 0:o.trim():void 0)||"API":Rt(e.chatSite??t.defaultChatSite)}function $t(e){return{defaultChatSite:e.defaultChatSite,externalModelNamesById:Object.fromEntries(Object.entries(e.externalModelsById).map(([t,n])=>[t,n.name]))}}function Rt(e){return e==="chatgpt"?"ChatGPT":e==="claude"?"Claude":e==="deepseek"?"DeepSeek":e==="kimi"?"Kimi":e==="qwen"?"千问":"Gemini"}function J(e,t,n){if(!e.startsWith(`@${n}`,t))return!1;const o=e[t+n.length+1];return o===void 0||/\s|[，。！？,.!?;；:：]/.test(o)}function ee(e,t){return t.defaultTarget==="none"?[]:e}function Et(e){return e.replace(/[ \t]+/g," ").replace(/\n{3,}/g,`

`).trim()}export{Ae as D,w as M,Z as R,gt as a,vt as b,Ct as c,Pt as d,At as e,Gt as f,Nt as g,It as h,Lt as i,kt as j,wt as k,it as l,_e as m,te as n,O as o,Ht as p,Mt as q,$t as r,ie as s,Bt as t,xt as u,Ot as v,Ut as w,Tt as x,ot as y,_t as z};
