/* Prototype model: default layout, editable sites, search and backward-compatible loading. */
const HomepageModel=(()=>{
  const WIDGETS=['calendar','focus','tasks','note'];
  const SPANS={calendar:3,focus:3,tasks:6,note:6};
  const ENGINES=[
    {id:'google',name:'Google',action:'https://www.google.com/search',parameter:'q'},
    {id:'bing',name:'Bing',action:'https://www.bing.com/search',parameter:'q'},
    {id:'baidu',name:'百度',action:'https://www.baidu.com/s',parameter:'wd'},
    {id:'duckduckgo',name:'DuckDuckGo',action:'https://duckduckgo.com/',parameter:'q'},
  ];
  const SITES=[
    {id:'github',name:'GitHub',url:'https://github.com/'},
    {id:'figma',name:'Figma',url:'https://figma.com/'},
    {id:'notion',name:'Notion',url:'https://notion.so/'},
    {id:'linear',name:'Linear',url:'https://linear.app/'},
    {id:'feishu',name:'飞书',url:'https://feishu.cn/'},
    {id:'chatgpt',name:'ChatGPT',url:'https://chatgpt.com/'},
  ];
  /** @returns {{clock:object,search:object}} Independent, editable appearance defaults. */
  function defaultAppearance(){return {
    clock:{font:'modern',size:96,weight:400,align:'center',top:56,shadow:'none',showDate:true,showSeconds:false},
    search:{align:'center',width:600,gap:30,transparency:15,blur:12},
  };}
  /** Whitelist styles and clamp numbers before they reach CSS or persisted state. */
  function normalizeAppearance(value){
    const base=defaultAppearance(),clock=value?.clock||{},search=value?.search||{};
    const number=(value,min,max,fallback)=>typeof value==='number'&&Number.isFinite(value)?Math.max(min,Math.min(max,Math.round(value))):fallback;
    const alignment=value=>['left','center','right'].includes(value)?value:'center';
    return {
      clock:{font:['modern','mono','serif'].includes(clock.font)?clock.font:base.clock.font,
        size:number(clock.size,48,144,base.clock.size),weight:Math.round(number(clock.weight,200,800,base.clock.weight)/100)*100,
        align:alignment(clock.align),top:number(clock.top,0,240,base.clock.top),shadow:clock.shadow==='soft'?'soft':'none',
        showDate:typeof clock.showDate==='boolean'?clock.showDate:true,showSeconds:typeof clock.showSeconds==='boolean'?clock.showSeconds:false},
      search:{align:alignment(search.align),width:number(search.width,320,760,base.search.width),
        gap:number(search.gap,0,120,base.search.gap),transparency:number(search.transparency,0,100,base.search.transparency),blur:number(search.blur,0,24,base.search.blur)},
    };
  }
  /** @returns {object} A fresh configuration, with no optional widgets installed. */
  function defaults(){return {
    version:2,theme:'paper',motion:true,engine:'google',appearance:defaultAppearance(),order:[],spans:{...SPANS},shortcuts:SITES.map(site=>({...site})),
    tasks:[{id:'t1',text:'把今天最重要的一件事写下来',done:false},{id:'t2',text:'整理这一周收集的灵感',done:false},{id:'t3',text:'给自己留一点休息时间',done:true}],
    note:'好的想法，也需要一点空白。\n\n先做好一件小事，\n再开始下一件。',minutes:25,
    background:{type:'material',color:'#dce4d6',image:'',name:'',shade:35,blur:0,position:'center'},
  };}
  /** Normalize user input without permitting scripts, local-file protocols or URL credentials. */
  function normalizeWebsite(name,address){
    if(typeof name!=='string'||typeof address!=='string')return null;
    const label=name.trim(),value=address.trim();
    if(!label||Array.from(label).length>30||!value||value.length>2048)return null;
    try{
      const url=new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(value)?value:`https://${value}`);
      if(!['https:','http:'].includes(url.protocol)||!url.hostname||url.username||url.password)return null;
      return {name:label,url:url.href};
    }catch{return null;}
  }
  function fallbackInitial(name){
    const text=typeof name==='string'?name.trim():'';
    if(!text)return '?';
    const first=typeof Intl.Segmenter==='function'?[...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(text)][0].segment:Array.from(text)[0];
    return first.toLocaleUpperCase();
  }
  function faviconSources(address){
    const site=normalizeWebsite('site',address);
    if(!site)return [];
    const origin=new URL(site.url).origin;
    return [`${origin}/favicon.ico`,`${origin}/apple-touch-icon.png`];
  }
  function searchSpec(engine){return ENGINES.find(item=>item.id===engine)||ENGINES[0];}
  function searchURL(engine,query){
    if(typeof query!=='string'||!query.trim())return null;
    const spec=searchSpec(engine),url=new URL(spec.action);
    url.searchParams.set(spec.parameter,query.trim());return url.href;
  }
  function addWidget(order,id){
    if(!WIDGETS.includes(id))throw new RangeError('Unknown widget');
    return order.includes(id)?[...order]:[...order,id];
  }
  function reorderSites(sites,sourceId,targetId){
    const from=sites.findIndex(site=>site.id===sourceId),to=sites.findIndex(site=>site.id===targetId);
    if(from<0||to<0||from===to)return [...sites];
    const result=[...sites],item=result.splice(from,1)[0];result.splice(to,0,item);return result;
  }
  const SITE_HOLD_MS=450;
  function siteHoldReady(pressedAt,now){return Number.isFinite(pressedAt)&&Number.isFinite(now)&&now-pressedAt>=SITE_HOLD_MS;}
  /** Keep legacy notes, tasks and appearance; v1's preinstalled cards become opt-in. */
  function loadConfig(saved,image=''){
    const base=defaults();
    if(!saved||typeof saved!=='object'||Array.isArray(saved))return base;
    const validImage=typeof image==='string'&&/^data:image\/(png|jpeg|webp);base64,/.test(image)&&image.length<3000000;
    const bg=saved.background&&typeof saved.background==='object'?saved.background:{};
    const validOrder=saved.version===2&&Array.isArray(saved.order)&&saved.order.length<=4&&new Set(saved.order).size===saved.order.length&&saved.order.every(id=>WIDGETS.includes(id));
    const sites=saved.shortcuts;
    const validSites=Array.isArray(sites)&&sites.length<=40&&new Set(sites.map(s=>s?.id)).size===sites.length&&sites.every(s=>typeof s?.id==='string'&&s.id.length>0&&s.id.length<=100&&normalizeWebsite(s.name,s.url));
    return {...base,
      theme:['paper','mist','ink'].includes(saved.theme)?saved.theme:base.theme,
      motion:typeof saved.motion==='boolean'?saved.motion:true,
      appearance:normalizeAppearance(saved.appearance),
      engine:ENGINES.some(e=>e.id===saved.engine)?saved.engine:'google',
      order:validOrder?[...saved.order]:[],
      shortcuts:validSites?sites.map(s=>({id:s.id,...normalizeWebsite(s.name,s.url)})):base.shortcuts,
      spans:Object.fromEntries(WIDGETS.map(id=>[id,[3,6,9].includes(saved.spans?.[id])?saved.spans[id]:SPANS[id]])),
      tasks:Array.isArray(saved.tasks)&&saved.tasks.length<=30&&saved.tasks.every(t=>typeof t?.id==='string'&&typeof t.text==='string'&&t.text.length<=60&&typeof t.done==='boolean')?saved.tasks.map(t=>({...t})):base.tasks,
      note:typeof saved.note==='string'?saved.note.slice(0,600):base.note,
      minutes:[15,25,45].includes(saved.minutes)?saved.minutes:25,
      background:{...base.background,
        type:['material','color'].includes(bg.type)?bg.type:bg.type==='image'&&validImage?'image':'material',
        color:/^#[0-9a-f]{6}$/i.test(bg.color)?bg.color:base.background.color,
        image:validImage?image:'',name:typeof bg.name==='string'?bg.name.slice(0,150):'',
        shade:Number.isInteger(bg.shade)&&bg.shade>=0&&bg.shade<=85?bg.shade:35,
        blur:Number.isInteger(bg.blur)&&bg.blur>=0&&bg.blur<=20?bg.blur:0,
        position:['center','top','bottom'].includes(bg.position)?bg.position:'center',
      },
    };
  }
  return {WIDGETS,SPANS,ENGINES,defaults,defaultAppearance,normalizeAppearance,normalizeWebsite,fallbackInitial,faviconSources,searchSpec,searchURL,addWidget,reorderSites,SITE_HOLD_MS,siteHoldReady,loadConfig};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=HomepageModel;
