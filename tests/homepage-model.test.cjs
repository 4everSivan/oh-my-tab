const {test}=require('node:test');
const assert=require('node:assert/strict');
const model=require('../docs/assets/homepage-study/homepage-model.js');
test('new homepage starts with no optional widgets and defaults to Google',()=>{
  assert.deepEqual(model.defaults().order,[]);
  assert.equal(model.defaults().engine,'google');
});
test('website names and addresses can be validated and edited',()=>{
  assert.deepEqual(model.normalizeWebsite(' My Docs ','example.com/notes'),{name:'My Docs',url:'https://example.com/notes'});
});
test('default website data is independently configurable',()=>{
  assert.ok(model.defaults().shortcuts.length>0);
  const first=model.defaults();first.shortcuts[0].name='Changed';
  assert.equal(model.defaults().shortcuts[0].name,'GitHub');
});
test('website URL validation rejects executable protocols and credentials',()=>{
  for(const address of ['javascript:alert(1)','data:text/html,<script>alert(1)</script>','file:///etc/passwd','ftp://example.com','https://user:password@example.com','not a url'])assert.equal(model.normalizeWebsite('Site',address),null,address);
  assert.equal(model.normalizeWebsite('', 'https://example.com'),null);
  assert.equal(model.normalizeWebsite('A'.repeat(31),'https://example.com'),null);
  assert.equal(model.normalizeWebsite('Docs','HTTP://EXAMPLE.COM/docs').url,'http://example.com/docs');
});
test('fallback uses the first English letter, Chinese character or complete emoji',()=>{
  assert.equal(model.fallbackInitial('  github  '),'G');
  assert.equal(model.fallbackInitial('飞书'),'飞');
  assert.equal(model.fallbackInitial('🧑‍💻 Work'),'🧑‍💻');
});
test('icon requests stay on the configured site origin',()=>{
  assert.deepEqual(model.faviconSources('https://example.com/path?q=secret'),['https://example.com/favicon.ico','https://example.com/apple-touch-icon.png']);
  assert.deepEqual(model.faviconSources('javascript:alert(1)'),[]);
});
test('search safely encodes queries and switches the engine parameter',()=>{
  assert.equal(model.searchURL('google',' a & b 中文 '),'https://www.google.com/search?q=a+%26+b+%E4%B8%AD%E6%96%87');
  assert.equal(model.searchURL('baidu','图标'),'https://www.baidu.com/s?wd=%E5%9B%BE%E6%A0%87');
  assert.equal(model.searchURL('bing',''),null);
});
test('widgets are added at most once and unknown widgets are rejected',()=>{
  assert.deepEqual(model.addWidget([], 'calendar'),['calendar']);
  assert.deepEqual(model.addWidget(['calendar'], 'calendar'),['calendar']);
  assert.throws(()=>model.addWidget([], 'links'),RangeError);
});
test('saved site edits, selected engine and optional widgets survive loading',()=>{
  const saved=model.defaults();saved.shortcuts[0]={id:'github',name:'My GitHub',url:'https://github.com/sivan'};saved.engine='bing';saved.order=['note','calendar'];
  const loaded=model.loadConfig(JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(loaded.shortcuts[0],saved.shortcuts[0]);assert.equal(loaded.engine,'bing');assert.deepEqual(loaded.order,['note','calendar']);
});
test('intentional empty site and widget lists remain empty after refresh',()=>{
  assert.deepEqual(model.loadConfig({...model.defaults(),shortcuts:[],order:[]}).shortcuts,[]);
  assert.deepEqual(model.loadConfig({...model.defaults(),shortcuts:[],order:[]}).order,[]);
});
test('old automatic cards are hidden while legacy notes, tasks and background are preserved',()=>{
  const legacy={order:['links','calendar','focus','tasks','note'],note:'Keep my note',tasks:[{id:'t',text:'Keep my task',done:false}],background:{type:'image',shade:20,blur:2,position:'top'}};
  const loaded=model.loadConfig(legacy,'data:image/png;base64,abc');
  assert.deepEqual(loaded.order,[]);assert.equal(loaded.note,legacy.note);assert.deepEqual(loaded.tasks,legacy.tasks);assert.equal(loaded.background.type,'image');assert.equal(loaded.background.shade,20);
});
test('corrupt saved configuration falls back without creating duplicate or unknown cards',()=>{
  const loaded=model.loadConfig({version:2,engine:'unknown',order:['calendar','calendar'],shortcuts:[{id:'bad',name:'Bad',url:'javascript:alert(1)'}]});
  assert.equal(loaded.engine,'google');assert.deepEqual(loaded.order,[]);assert.equal(loaded.shortcuts[0].name,'GitHub');
});
test('long-press ordering moves a site forward or backward without losing data',()=>{
  const sites=model.defaults().shortcuts,ids=list=>list.map(site=>site.id);
  assert.deepEqual(ids(model.reorderSites(sites,'github','notion')),['figma','notion','github','linear','feishu','chatgpt']);
  assert.deepEqual(ids(model.reorderSites(sites,'notion','github')),['notion','github','figma','linear','feishu','chatgpt']);
  assert.deepEqual(ids(sites),['github','figma','notion','linear','feishu','chatgpt']);
  assert.deepEqual(model.loadConfig({...model.defaults(),shortcuts:model.reorderSites(sites,'github','notion')}).shortcuts,model.reorderSites(sites,'github','notion'));
});
test('dropping onto the same or an absent site preserves order',()=>{
  const sites=model.defaults().shortcuts;
  for(const [source,target] of [['github','github'],['missing','github'],['github','missing']])assert.deepEqual(model.reorderSites(sites,source,target),sites);
});
test('quick clicks do not reach the hold threshold',()=>{
  assert.equal(model.SITE_HOLD_MS,450);
  assert.equal(model.siteHoldReady(1000,1449),false);
  assert.equal(model.siteHoldReady(1000,1450),true);
  assert.equal(model.siteHoldReady(1000,1800),true);
});
test('appearance defaults use clean time with no outline and independent translucent search surface',()=>{
  const a=model.defaults().appearance;
  assert.equal(a.clock.shadow,'none');assert.equal(a.clock.align,'center');assert.equal(a.search.align,'center');
  assert.equal(a.clock.weight,400);assert.equal(a.search.transparency,15);assert.equal(a.search.blur,12);
  a.clock.weight=800;assert.equal(model.defaults().appearance.clock.weight,400);
});
test('legacy saved pages gain appearance controls without losing user content',()=>{
  const prior={...model.defaults(),appearance:undefined,note:'Keep this',engine:'bing',order:['note']};
  const loaded=model.loadConfig(prior);
  assert.deepEqual(loaded.appearance,model.defaults().appearance);assert.equal(loaded.note,'Keep this');assert.equal(loaded.engine,'bing');assert.deepEqual(loaded.order,['note']);
});
test('appearance settings clamp unsafe numeric values and reject style injections',()=>{
  const a=model.normalizeAppearance({clock:{size:999,weight:0,top:-99,font:'url(evil)',align:'absolute',shadow:'white-outline'},search:{width:0,gap:999,transparency:150,blur:-5,align:'center;position:fixed'}});
  assert.equal(a.clock.size,144);assert.equal(a.clock.weight,200);assert.equal(a.clock.top,0);assert.equal(a.clock.font,'modern');assert.equal(a.clock.align,'center');assert.equal(a.clock.shadow,'none');
  assert.equal(a.search.width,320);assert.equal(a.search.gap,120);assert.equal(a.search.transparency,100);assert.equal(a.search.blur,0);assert.equal(a.search.align,'center');
  assert.equal(model.normalizeAppearance({clock:{size:Infinity},search:{blur:'20'}}).clock.size,96);
  assert.equal(model.normalizeAppearance({clock:{showDate:'false'}}).clock.showDate,true);
});
test('custom time and search appearance survive loading independently',()=>{
  const appearance={clock:{font:'mono',size:120,weight:700,align:'left',top:88,shadow:'soft',showDate:false,showSeconds:true},search:{align:'right',width:420,gap:60,transparency:65,blur:24}};
  const loaded=model.loadConfig({...model.defaults(),appearance});assert.deepEqual(loaded.appearance,appearance);
});
