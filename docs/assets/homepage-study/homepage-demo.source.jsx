/* Design exploration, 2026-10-07. This is a prototype, not an extension entry point. */
const {useState, useEffect, useRef} = React;
const STORAGE = 'oh-my-tab-homepage-study-v2';
const LEGACY_STORAGE = 'oh-my-tab-homepage-study-v1';
const BACKGROUND_STORAGE = `${LEGACY_STORAGE}-background`;
const THEMES = [
  {id:'paper', name:'纸感书桌', note:'暖白纸面 · 鼠尾草绿'},
  {id:'mist', name:'雾蓝工作台', note:'冷蓝雾面 · 轻透轮廓'},
  {id:'ink', name:'墨黑仪表台', note:'深墨黑 · 酸橙刻度'},
];
const WIDGETS = HomepageModel.WIDGETS;
const TITLES = {calendar:'撕页日历',focus:'专注计时',tasks:'今日待办',note:'随手便签'};
const seed = HomepageModel.defaults;
function load() {
  try {
    const saved=JSON.parse(localStorage.getItem(STORAGE)||localStorage.getItem(LEGACY_STORAGE)||'null');
    return HomepageModel.loadConfig(saved,localStorage.getItem(BACKGROUND_STORAGE)||'');
  }catch{return seed();}
}
function Icon({name,size=18,...props}) {
  const paths={
    home:<><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/></>,
    grid:<><rect x="3" y="3" width="7" height="7" rx="1.4"/><rect x="14" y="3" width="7" height="7" rx="1.4"/><rect x="3" y="14" width="7" height="7" rx="1.4"/><rect x="14" y="14" width="7" height="7" rx="1.4"/></>,
    note:<><path d="M14 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V10Z"/><path d="M14 3v7h7M7 14h9M7 17h6"/></>,
    settings:<><path d="m9 3-1 3-3 1-2 3 2 2-1 3 2 3 3-1 3 2 3-2 3 1 2-3-1-3 2-2-2-3-3-1-1-3Z"/><circle cx="12" cy="12" r="3"/></>,
    search:<><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></>,
    arrow:<><path d="M5 12h14m-5-5 5 5-5 5"/></>,
    chevron:<path d="m9 5 7 7-7 7"/>,
    plus:<path d="M12 5v14M5 12h14"/>,
    check:<path d="m5 12 4 4L19 6"/>,
    close:<path d="m6 6 12 12M6 18 18 6"/>,
    play:<path d="m9 5 11 7-11 7Z"/>,
    pause:<><path d="M8 5v14M16 5v14"/></>,
    reset:<><path d="M3 10a9 9 0 1 1 2 9M3 4v6h6"/></>,
    grip:<><circle cx="8" cy="5" r=".5"/><circle cx="16" cy="5" r=".5"/><circle cx="8" cy="12" r=".5"/><circle cx="16" cy="12" r=".5"/><circle cx="8" cy="19" r=".5"/><circle cx="16" cy="19" r=".5"/></>,
    expand:<><path d="M8 16h8V8M16 16l-8-8"/><path d="m6 21 15-15"/></>,
    leaf:<><path d="M20 3c0 11-4 18-11 18a6 6 0 0 1-6-6C3 8 10 3 20 3Z"/><path d="M5 19 15 9"/></>,
    moon:<path d="M21 14a9 9 0 0 1-11-11A9 9 0 1 0 21 14Z"/>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]||paths.grid}</svg>;
}
function useWallpaperContrast(background,theme,contentKey,appearance) {
  const rootRef=useRef(null);
  useEffect(()=>{
    const root=rootRef.current;
    if(!root)return;
    const regions=[...root.querySelectorAll('[data-wallpaper-text]')];
    const {parseHex,coverRect,chooseForeground,chooseFloatingForeground,chooseSearchForeground}=HomepageBackgroundContrast;
    const choose=(element,samples)=>element.classList.contains('homepage-search')?chooseSearchForeground(samples,parseHex(getComputedStyle(root).getPropertyValue('--surface').trim()),appearance.search.transparency):element.hasAttribute('data-wallpaper-floating')?chooseFloatingForeground(samples):chooseForeground(samples);
    const apply=(element,result)=>{
      element.style.setProperty('--wallpaper-ink',result.color);
      element.style.setProperty('--wallpaper-protection',`rgba(${result.overlay.join(',')},${result.opacity})`);
      element.dataset.wallpaperTone=result.tone;
      element.dataset.wallpaperContrast=result.minContrast.toFixed(2);
      element.dataset.wallpaperReady=result.fallback?'fallback':'sampled';
    };
    if(background.type==='material'){
      regions.forEach(element=>{
        element.style.removeProperty('--wallpaper-ink');element.style.removeProperty('--wallpaper-protection');
        delete element.dataset.wallpaperTone;delete element.dataset.wallpaperContrast;delete element.dataset.wallpaperReady;
      });
      return;
    }
    // Keep a readable fallback while decoding a new image; old samples no longer apply.
    regions.forEach(element=>apply(element,choose(element,[])));
    let disposed=false,frame=0,dirty=true,image=null,raster=null;
    const renderWallpaper=()=>{
      if(background.type==='color')return;
      if(!image?.naturalWidth){raster=null;return;}
      const bounds=root.querySelector('.background-photo')?.getBoundingClientRect();
      if(!bounds?.width||!bounds.height)return;
      const scale=Math.min(1,384/Math.max(bounds.width,bounds.height));
      const canvas=document.createElement('canvas');canvas.width=Math.ceil(bounds.width*scale);canvas.height=Math.ceil(bounds.height*scale);
      const context=canvas.getContext('2d',{willReadFrequently:true});
      if(!context){raster=null;return;}
      const base=getComputedStyle(root).getPropertyValue('--bg').trim();
      context.fillStyle=base;context.fillRect(0,0,canvas.width,canvas.height);
      const cover=coverRect(image.naturalWidth,image.naturalHeight,bounds.width,bounds.height,background.position);
      // Transparent PNGs composite on the theme base, just as on the page.
      context.filter=`blur(${background.blur*scale}px)`;
      context.drawImage(image,cover.x*scale,cover.y*scale,cover.width*scale,cover.height*scale);
      context.filter='none';context.globalAlpha=background.shade/100;
      context.fillStyle=base;context.fillRect(0,0,canvas.width,canvas.height);
      const pixels=context.getImageData(0,0,canvas.width,canvas.height);
      raster={bounds,scale,pixels};
    };
    const update=()=>{
      frame=0;if(disposed)return;
      try {
        if(dirty){renderWallpaper();dirty=false;}
        regions.forEach(element=>{
          const rect=element.getBoundingClientRect();
          if(!rect.width||!rect.height)return;
          const samples=[];
          if(background.type==='color')samples.push(parseHex(background.color));
          else if(raster){
            const {bounds,scale,pixels}=raster;
            const left=Math.max(0,Math.floor((rect.left-bounds.left)*scale)),right=Math.min(pixels.width,Math.ceil((rect.right-bounds.left)*scale));
            const top=Math.max(0,Math.floor((rect.top-bounds.top)*scale)),bottom=Math.min(pixels.height,Math.ceil((rect.bottom-bounds.top)*scale));
            for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){
              const offset=(y*pixels.width+x)*4;
              samples.push([pixels.data[offset],pixels.data[offset+1],pixels.data[offset+2]]);
            }
          }
          apply(element,choose(element,samples));
        });
      }catch{regions.forEach(element=>apply(element,choose(element,[])));}
    };
    const schedule=(rerender=false)=>{dirty=dirty||rerender;if(!frame)frame=requestAnimationFrame(update);};
    const resized=()=>schedule(true),scrolled=()=>schedule();
    const observer=new ResizeObserver(resized);observer.observe(root);
    regions.forEach(element=>observer.observe(element));
    // Opening the drawer or hiding sites can move text without resizing the glyphs.
    const layoutObserver=new MutationObserver(()=>schedule());
    layoutObserver.observe(root,{attributes:true,attributeFilter:['data-settings-open','data-focus']});
    window.addEventListener('resize',resized);window.addEventListener('scroll',scrolled,{passive:true});
    if(background.type==='image'){
      image=new Image();image.onload=()=>{if(!disposed)schedule(true);};image.onerror=()=>{if(!disposed){raster=null;schedule();}};image.src=background.image;
    }
    schedule(true);
    return()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();layoutObserver.disconnect();window.removeEventListener('resize',resized);window.removeEventListener('scroll',scrolled);if(image){image.onload=null;image.onerror=null;}};
  },[background.type,background.color,background.image,background.shade,background.blur,background.position,theme,contentKey,appearance]);
  return rootRef;
}
function App() {
  const [state,setState]=useState(load), [now,setNow]=useState(new Date());
  const clock=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',...(state.appearance.clock.showSeconds?{second:'2-digit'}:{}),hour12:false}).format(now);
  const dateline=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'long',day:'numeric',weekday:'long'}).format(now);
  const appRef=useWallpaperContrast(state.background,state.theme,state.shortcuts.map(site=>`${site.id}:${site.name}`).join('|')+'|'+dateline,state.appearance);
  const [compact,setCompact]=useState(false),[contextMenu,setContextMenu]=useState(null),[draggedSite,setDraggedSite]=useState(null),[siteTarget,setSiteTarget]=useState(null);
  const siteGesture=useRef(null),suppressSiteClick=useRef(false);
  const [query,setQuery]=useState(''), [draft,setDraft]=useState(''), [taskError,setTaskError]=useState('');
  const [editing,setEditing]=useState(false), [dragged,setDragged]=useState(null), [dropTarget,setDropTarget]=useState(null);
  const [calendarOffset,setCalendarOffset]=useState(0), [flip,setFlip]=useState(0);
  const [remaining,setRemaining]=useState(state.minutes*60), [running,setRunning]=useState(false);
  const [dock,setDock]=useState(true), [settings,setSettings]=useState(false), [saved,setSaved]=useState(true), [message,setMessage]=useState('');
  const [settingsTab,setSettingsTab]=useState('clock');
  const [osReduced,setOsReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [picker,setPicker]=useState(false),[siteDraft,setSiteDraft]=useState(null),[siteError,setSiteError]=useState(''),[removedSite,setRemovedSite]=useState(null);
  const [backgroundError,setBackgroundError]=useState(''), [colorDraft,setColorDraft]=useState(state.background.color);
  const searchRef=useRef(null), dialogRef=useRef(null), settingsRef=useRef(null), uploadRef=useRef(null), deadline=useRef(null), toastTimeout=useRef(null);
  const motion=state.motion&&!osReduced;
  const update=patch=>setState(s=>({...s,...patch}));
  const updateAppearance=(group,patch)=>setState(s=>({...s,appearance:HomepageModel.normalizeAppearance({...s.appearance,[group]:{...s.appearance[group],...patch}})}));
  const announce=text=>{setMessage(text);clearTimeout(toastTimeout.current);toastTimeout.current=setTimeout(()=>setMessage(''),2600);};
  useEffect(()=>{try {const config={...state,background:{...state.background,image:undefined}};localStorage.setItem(STORAGE,JSON.stringify(config));setSaved(true);} catch {setSaved(false);}},[state]);
  useEffect(()=>setColorDraft(state.background.color),[state.background.color]);
  useEffect(()=>{const timer=setInterval(()=>setNow(new Date()),1000);return()=>clearInterval(timer);},[]);
  useEffect(()=>{const m=matchMedia('(prefers-reduced-motion: reduce)');const change=()=>setOsReduced(m.matches);m.addEventListener('change',change);return()=>m.removeEventListener('change',change);},[]);
  useEffect(()=>{
    const key=e=>{if(!settings&&!picker&&!siteDraft&&(e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();searchRef.current?.focus();}if(e.key==='Escape'){setSettings(false);setPicker(false);setSiteDraft(null);setContextMenu(null);setEditing(false);}};
    document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key);
  },[settings,picker,siteDraft]);
  useEffect(()=>{
    if(!running) return;
    const tick=()=>{const left=Math.max(0,Math.ceil((deadline.current-Date.now())/1000));setRemaining(left);if(left===0){setRunning(false);announce('这一段专注结束了，休息一下。');}};
    const timer=setInterval(tick,250);tick();return()=>clearInterval(timer);
  },[running]);
  useEffect(()=>{
    if(!settings) return;
    const previous=document.activeElement;
    dialogRef.current?.querySelector('button')?.focus();
    return()=>previous?.focus();
  },[settings]);
  useEffect(()=>{if(settings)dialogRef.current?.querySelector('.appearance-content')?.scrollTo({top:0});},[settings,settingsTab]);
  useEffect(()=>()=>clearTimeout(toastTimeout.current),[]);
  const dateParts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const datePart=type=>dateParts.find(p=>p.type===type).value;
  const calendarDate=new Date(`${datePart('year')}-${datePart('month')}-${datePart('day')}T12:00:00`);
  calendarDate.setDate(calendarDate.getDate()+calendarOffset);
  const calendarMonth=new Intl.DateTimeFormat('en-GB',{month:'long'}).format(calendarDate);
  const calendarWeek=new Intl.DateTimeFormat('zh-CN',{weekday:'long'}).format(calendarDate);
  const done=state.tasks.filter(t=>t.done).length;
  const move=(id,delta)=>setState(s=>{const order=[...s.order],i=order.indexOf(id),j=i+delta;if(j<0||j>=order.length)return s;[order[i],order[j]]=[order[j],order[i]];return {...s,order};});
  const startDrag=(id,e)=>{
    if(e.button!==0||!editing) return;
    e.preventDefault();const handle=e.currentTarget,startX=e.clientX,startY=e.clientY;let started=false;
    handle.setPointerCapture(e.pointerId);
    const targetAt=event=>document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-widget]')?.getAttribute('data-widget');
    const movePointer=event=>{if(!started&&Math.hypot(event.clientX-startX,event.clientY-startY)>6){started=true;setDragged(id);}if(started){event.preventDefault();const target=targetAt(event);setDropTarget(target&&target!==id?target:null);}};
    const stop=event=>{if(started&&event.type==='pointerup'){const target=targetAt(event);if(target&&target!==id){setState(s=>{const destination=s.order.indexOf(target);const order=s.order.filter(item=>item!==id);order.splice(destination,0,id);return {...s,order};});announce(`${TITLES[id]}已移动`);}}setDragged(null);setDropTarget(null);handle.removeEventListener('pointermove',movePointer);handle.removeEventListener('pointerup',stop);handle.removeEventListener('pointercancel',stop);};
    handle.addEventListener('pointermove',movePointer);handle.addEventListener('pointerup',stop);handle.addEventListener('pointercancel',stop);
  };
  const resize=(id,span)=>setState(s=>({...s,spans:{...s.spans,[id]:Math.max(3,Math.min(9,span))}}));
  const updateBackground=patch=>setState(s=>({...s,background:{...s.background,...patch}}));
  const chooseBackground=type=>{setBackgroundError('');if(type==='image'&&!state.background.image){uploadRef.current?.click();return;}updateBackground({type});};
  const uploadBackground=e=>{
    const file=e.target.files?.[0];if(!file)return;
    setBackgroundError('');
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)){setBackgroundError('请选择 PNG、JPEG 或 WebP 图片。');e.target.value='';return;}
    if(file.size>2*1024*1024){setBackgroundError('样稿暂支持 2 MB 以内的图片，请先缩小图片。');e.target.value='';return;}
    const reader=new FileReader();reader.onerror=()=>setBackgroundError('图片暂时无法读取，请重新选择。');
    reader.onload=()=>{const data=reader.result;if(typeof data!=='string')return;const image=new Image();image.onerror=()=>setBackgroundError('图片无法打开，请换一张图片。');image.onload=()=>{try{localStorage.setItem(BACKGROUND_STORAGE,data);updateBackground({type:'image',image:data,name:file.name});announce('背景已保存在此浏览器');}catch{setBackgroundError('浏览器剩余空间不足，请使用更小的图片。');}};image.src=data;};
    reader.readAsDataURL(file);e.target.value='';
  };
  const clearBackground=()=>{try{localStorage.removeItem(BACKGROUND_STORAGE);updateBackground({type:'material',image:'',name:''});setBackgroundError('');}catch{setBackgroundError('暂时无法移除图片。');}};
  const applyColor=()=>{if(/^#[0-9a-f]{6}$/i.test(colorDraft)){updateBackground({color:colorDraft,type:'color'});setBackgroundError('');}else setBackgroundError('请输入六位颜色值，例如 #DCE4D6。');};
  const startResize=(id,e)=>{
    e.preventDefault();const handle=e.currentTarget;handle.setPointerCapture(e.pointerId);
    const start=e.clientX,initial=state.spans[id];const grid=handle.closest('.widget-grid');const unit=grid.getBoundingClientRect().width/12;
    const movePointer=event=>resize(id,initial+Math.round((event.clientX-start)/(unit*3))*3);
    const stop=()=>{handle.removeEventListener('pointermove',movePointer);handle.removeEventListener('pointerup',stop);handle.removeEventListener('pointercancel',stop);};
    handle.addEventListener('pointermove',movePointer);handle.addEventListener('pointerup',stop);handle.addEventListener('pointercancel',stop);
  };
  const addTask=e=>{e.preventDefault();if(!draft.trim()){setTaskError('先写下一件小事。');return;}if(state.tasks.length>=30){setTaskError('样稿最多保存 30 条待办。');return;}update({tasks:[...state.tasks,{id:`t-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,text:draft.trim(),done:false}]});setDraft('');setTaskError('');};
  const selectMinutes=minutes=>{update({minutes});setRemaining(minutes*60);setRunning(false);};
  const toggleTimer=()=>{if(running){setRemaining(Math.max(0,Math.ceil((deadline.current-Date.now())/1000)));setRunning(false);}else{const seconds=remaining||state.minutes*60;setRemaining(seconds);deadline.current=Date.now()+seconds*1000;setRunning(true);}};
  const reset=()=>{const base=seed();setState({...base,background:{...base.background,image:state.background.image,name:state.background.name}});setRemaining(1500);setRunning(false);setCalendarOffset(0);setQuery('');setDraft('');setEditing(false);setTaskError('');setBackgroundError('');announce('已恢复示例内容与默认布局');};
  const openNewSite=()=>{if(state.shortcuts.length>=40){announce('样稿最多保存 40 个网站');return;}setSiteDraft({id:'',name:'',url:''});setSiteError('');};
  const saveSite=e=>{
    e.preventDefault();const site=HomepageModel.normalizeWebsite(siteDraft.name,siteDraft.url);
    if(!site){setSiteError('名称请填写 1–30 个字符，地址使用有效的 HTTP(S) 网页链接。');return;}
    const id=siteDraft.id||(typeof crypto.randomUUID==='function'?crypto.randomUUID():`site-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    setState(s=>({...s,shortcuts:siteDraft.id?s.shortcuts.map(item=>item.id===id?{id,...site}:item):[...s.shortcuts,{id,...site}]}));
    setSiteDraft(null);setSiteError('');setRemovedSite(null);announce('网站已保存');
  };
  const moveSite=(id,delta)=>setState(s=>{const shortcuts=[...s.shortcuts],i=shortcuts.findIndex(item=>item.id===id),j=i+delta;if(i<0||j<0||j>=shortcuts.length)return s;[shortcuts[i],shortcuts[j]]=[shortcuts[j],shortcuts[i]];return {...s,shortcuts};});
  const removeSite=site=>{const item=site||siteDraft,index=state.shortcuts.findIndex(s=>s.id===item.id);setRemovedSite({site:state.shortcuts[index],index});update({shortcuts:state.shortcuts.filter(s=>s.id!==item.id)});setSiteDraft(null);setContextMenu(null);announce('网站已移除');};
  const startSiteHold=(e,id)=>{
    if(e.button!==0)return;
    siteGesture.current?.();suppressSiteClick.current=false;
    const node=e.currentTarget,pressedAt=performance.now(),pointer=e.pointerId,startX=e.clientX,startY=e.clientY;
    let active=false,lastX=startX,lastY=startY,canceled=false;
    const targetAt=()=>document.elementFromPoint(lastX,lastY)?.closest('[data-site]')?.dataset.site;
    let timer;
    const activate=()=>{if(canceled)return;const elapsed=performance.now()-pressedAt;if(!HomepageModel.siteHoldReady(pressedAt,performance.now())){timer=setTimeout(activate,Math.ceil(HomepageModel.SITE_HOLD_MS-elapsed));return;}active=true;suppressSiteClick.current=true;setDraggedSite(id);setSiteTarget(targetAt()===id?null:targetAt());};
    timer=setTimeout(activate,HomepageModel.SITE_HOLD_MS);
    const move=event=>{lastX=event.clientX;lastY=event.clientY;if(Math.hypot(lastX-startX,lastY-startY)>8)suppressSiteClick.current=true;if(!active&&event.pointerType!=='mouse'&&Math.hypot(lastX-startX,lastY-startY)>8){clearTimeout(timer);return;}if(active){event.preventDefault();const target=targetAt();setSiteTarget(target&&target!==id?target:null);}};
    const cleanup=()=>{canceled=true;clearTimeout(timer);node.removeEventListener('pointermove',move);node.removeEventListener('pointerup',stop);node.removeEventListener('pointercancel',stop);setDraggedSite(null);setSiteTarget(null);siteGesture.current=null;};
    const stop=event=>{lastX=event.clientX;lastY=event.clientY;if(active&&event.type==='pointerup'){const target=targetAt();if(target&&target!==id){setState(s=>({...s,shortcuts:HomepageModel.reorderSites(s.shortcuts,id,target)}));announce('网站顺序已保存');}}cleanup();};
    node.setPointerCapture(pointer);node.addEventListener('pointermove',move);node.addEventListener('pointerup',stop);node.addEventListener('pointercancel',stop);siteGesture.current=cleanup;
  };
  useEffect(()=>()=>siteGesture.current?.(),[]);
  const undoSite=()=>{if(!removedSite)return;setState(s=>{const shortcuts=[...s.shortcuts];if(!shortcuts.some(item=>item.id===removedSite.site.id))shortcuts.splice(removedSite.index,0,removedSite.site);return {...s,shortcuts};});setRemovedSite(null);announce('网站已恢复');};
  const addWidget=id=>{setState(s=>({...s,order:HomepageModel.addWidget(s.order,id)}));announce(`已添加${TITLES[id]}`);};
  const removeWidget=id=>{update({order:state.order.filter(item=>item!==id)});if(id==='focus')setRunning(false);announce(`${TITLES[id]}已移出首页，内容保留`);};
  const themeButtons=place=><div className={`theme-options ${place}`} role="group" aria-label="首页风格">{THEMES.map(t=><button key={t.id} className={state.theme===t.id?'selected':''} aria-pressed={state.theme===t.id} onClick={()=>update({theme:t.id})}><span className={`theme-swatch ${t.id}`}/>{t.name}</button>)}</div>;
  const widgetBody=id=>{
    if(id==='calendar')return <>
      <div className="small-heading"><h2>日历</h2><span>一日一页</span></div>
      <button className={`calendar-paper ${motion?'can-flip':''}`} key={flip} onClick={()=>{setCalendarOffset(n=>n+1);setFlip(n=>n+1);}} aria-label="日历翻页" title="点击翻到下一天">
        <span className="calendar-binding"><i/><i/></span><span className="calendar-month">{calendarMonth} <b>{calendarDate.getFullYear()}</b></span><span className="calendar-number">{calendarDate.getDate().toString().padStart(2,'0')}</span><span className="calendar-week">{calendarWeek}</span><span className="calendar-rule"/><span className="calendar-motto">今天，留一点空白。</span><span className="page-corner"/>
      </button>
      <div className="calendar-footer"><span>点击纸页，向前一天</span><button className="icon-button" aria-label="日历回到今天" disabled={!calendarOffset} onClick={()=>{setCalendarOffset(0);setFlip(n=>n+1);}}><Icon name="reset" size={14}/></button></div>
    </>;
    if(id==='focus')return <>
      <div className="small-heading"><h2>专注一下</h2><span className="candidate">候选组件</span></div>
      <div className={`timer-dial ${running?'is-running':''}`} role="timer" aria-label={`剩余 ${Math.floor(remaining/60)} 分 ${remaining%60} 秒`}><div className="timer-face"><span className="timer-label">{running?'此刻，只做一件事':remaining===0?'休息一下吧':'给注意力一点空间'}</span><strong>{Math.floor(remaining/60).toString().padStart(2,'0')}<span>:</span>{(remaining%60).toString().padStart(2,'0')}</strong><span className="timer-indicator"/></div></div>
      <div className="timer-presets" role="group" aria-label="专注时长">{[15,25,45].map(m=><button key={m} aria-pressed={state.minutes===m} onClick={()=>selectMinutes(m)}>{m} 分</button>)}</div>
      <button className="focus-button" onClick={toggleTimer}><Icon name={running?'pause':'play'} size={14}/>{running?'暂停专注':remaining===0?'再来一段':'开始专注'}</button>
    </>;
    if(id==='tasks')return <>
      <div className="card-heading"><div><span className="eyebrow">ONE THING AT A TIME</span><h2>今日待办</h2></div><span className="task-progress">{done}<span> / {state.tasks.length}</span></span></div>
      <div className="tasks-list">{state.tasks.map(task=><label className={`task-row ${task.done?'completed':''}`} key={task.id}><input type="checkbox" checked={task.done} onChange={()=>update({tasks:state.tasks.map(t=>t.id===task.id?{...t,done:!t.done}:t)})}/><span className="task-checkbox"><Icon name="check" size={12}/></span><span className="task-text">{task.text}</span></label>)}{!state.tasks.length&&<p className="empty-tasks">从一件小事开始。</p>}</div>
      <form className="task-form" onSubmit={addTask}><Icon name="plus" size={16}/><input aria-label="添加待办" placeholder="再记一件小事…" maxLength={60} value={draft} onChange={e=>{setDraft(e.target.value);setTaskError('');}} aria-invalid={!!taskError} aria-describedby={taskError?'task-error':undefined}/><button type="submit" aria-label="确认添加待办"><Icon name="arrow" size={16}/></button></form>
      {taskError&&<p className="field-error" id="task-error" role="alert">{taskError}</p>}
    </>;
    return <>
      <div className="note-heading"><h2>随手记下</h2><span className="note-pin" aria-hidden="true"/><Icon name="note" size={18}/></div>
      <textarea aria-label="随手便签" spellCheck="false" maxLength={600} value={state.note} onChange={e=>update({note:e.target.value})}/>
      <div className="note-footer"><span><i className={saved?'saved-dot':'failed-dot'}/>{saved?'已保存在此浏览器':'保存失败，暂留此页'}</span><span>{state.note.length} / 600</span></div>
    </>;
  };
  return <div className="app" ref={appRef} data-settings-open={settings?'on':'off'} data-focus={compact?'on':'off'} data-clock-font={state.appearance.clock.font} data-clock-align={state.appearance.clock.align} data-clock-shadow={state.appearance.clock.shadow} data-clock-seconds={state.appearance.clock.showSeconds?'on':'off'} data-search-align={state.appearance.search.align} data-theme={state.theme} data-motion={motion?'on':'off'} data-background={state.background.type} style={{'--clock-size':`${state.appearance.clock.size}px`,'--clock-weight':state.appearance.clock.weight,'--clock-top':`${state.appearance.clock.top}px`,'--search-gap':`${state.appearance.search.gap}px`,'--search-width':`${state.appearance.search.width}px`,'--search-surface-opacity':`${100-state.appearance.search.transparency}%`,'--search-blur':`${state.appearance.search.blur}px`,'--custom-color':state.background.color,'--background-blur':`${state.background.blur}px`,'--background-shade':state.background.shade/100}}>
    <input ref={uploadRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadBackground} aria-label="背景图片文件" className="hidden-upload"/>
    {state.background.type==='image'&&<><div className="background-photo" aria-hidden="true" style={{backgroundImage:`url("${state.background.image}")`,backgroundPosition:state.background.position}}/><div className="background-shade" aria-hidden="true"/></>}
    <a className="skip-link" href="#workspace">跳到工作台</a>
    <main id="workspace" className="workspace">
      <header className="topbar"><span className="wordmark" data-wallpaper-text="brand">oh, my tab<span>.</span></span><div className="home-actions"><button className="add-component-button" onClick={()=>setPicker(true)}><Icon name="plus" size={15}/>添加组件</button><button className={`edit-shortcut ${editing?'active':''}`} onClick={()=>setEditing(!editing)}><Icon name={editing?'check':'grid'} size={15}/>{editing?'完成编辑':'编辑首页'}</button><button ref={settingsRef} className="appearance-button" aria-label="外观设置" title="外观设置" onClick={()=>setSettings(true)}><Icon name="settings" size={18}/></button></div></header>
      <div className="home-stack">
        <section className="time-stage" aria-label="时间与日期"><button className="clock-toggle" aria-label={compact?'展开网站与组件':'收起网站与组件'} aria-pressed={compact} title={compact?'点击时间展开首页':'点击时间只保留时间与搜索'} onClick={()=>setCompact(value=>!value)}><time className="main-clock" data-wallpaper-text="clock" data-wallpaper-floating="true" dateTime={now.toISOString()}>{Array.from(clock).map((digit,index)=><span className="clock-glyph" key={index} data-wallpaper-text={'clock-glyph-'+index} data-wallpaper-floating="true">{digit}</span>)}</time></button>{state.appearance.clock.showDate&&<span className="home-date" data-wallpaper-text="date" data-wallpaper-floating="true">{Array.from(dateline).map((character,index)=><span className="date-glyph" key={index} data-wallpaper-text={'date-glyph-'+index} data-wallpaper-floating="true">{character}</span>)}</span>}</section>
        <HomepageSearch query={query} onQuery={setQuery} engine={state.engine} onEngine={engine=>update({engine})} inputRef={searchRef}/>
        <SiteSection sites={state.shortcuts} onAdd={openNewSite} onMove={moveSite} onContext={(site,x,y)=>setContextMenu({site,x,y})} onHold={startSiteHold} onClick={e=>{if(suppressSiteClick.current&&e.detail!==0)e.preventDefault();}} dragged={draggedSite} target={siteTarget}/>
      </div>
      {editing&&state.order.length>0&&<div className="edit-banner" role="status"><Icon name="grip" size={16}/><span>拖动标题栏排序；宽窗口可拖动右下角缩放。也可用箭头按钮与方向键。</span><button onClick={()=>setEditing(false)}>完成 <Icon name="check" size={14}/></button></div>}
      {state.order.length>0&&<section className={`widget-grid ${editing?'is-editing':''}`} aria-label="首页组件">{state.order.map((id,index)=><article key={id} id={`widget-${id}`} data-widget={id} data-span={state.spans[id]} style={{'--span':state.spans[id]}} className={`widget widget-${id} ${dragged===id?'dragging':''} ${dropTarget===id?'drop-target':''}`}>
        {editing&&<div className="widget-tools"><button className="drag-handle" aria-label={`拖动${TITLES[id]}`} onPointerDown={e=>startDrag(id,e)}><Icon name="grip" size={15}/>{TITLES[id]}</button><div><button aria-label={`${TITLES[id]}向前移动`} disabled={index===0} onClick={()=>move(id,-1)}><Icon name="chevron" size={14} style={{transform:'rotate(180deg)'}}/></button><button aria-label={`${TITLES[id]}向后移动`} disabled={index===state.order.length-1} onClick={()=>move(id,1)}><Icon name="chevron" size={14}/></button></div></div>}
        <button className="remove-widget" aria-label={`移除${TITLES[id]}`} title={`移除${TITLES[id]}`} onClick={()=>removeWidget(id)}><Icon name="close" size={13}/></button><div className="widget-content">{widgetBody(id)}</div>
        {editing&&<button className="resize-handle" role="slider" aria-label={`${TITLES[id]}宽度`} aria-valuemin={3} aria-valuemax={9} aria-valuenow={state.spans[id]} aria-valuetext={`${state.spans[id]} / 12 列`} onPointerDown={e=>startResize(id,e)} onKeyDown={e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();resize(id,state.spans[id]+(e.key==='ArrowLeft'?-3:3));}}} title="拖动调整宽度；左右方向键调整"><Icon name="expand" size={16}/></button>}
      </article>)}</section>}
      <footer className="workspace-footer"><span data-wallpaper-text="footer-left"><Icon name="leaf" size={13}/> 不必填满每一分钟。</span><span data-wallpaper-text="footer-right">Make room for a good day.</span></footer>
    </main>
    {dock?<aside className="review-dock" aria-label="样稿评审工具"><div className="review-label"><span className="review-dot"/><strong>交互样稿</strong><small>示例数据 · {saved?'仅保存此浏览器':'保存不可用'}</small></div>{themeButtons('dock-themes')}<span className="dock-divider"/><button className="motion-button" aria-pressed={state.motion} onClick={()=>update({motion:!state.motion})}><span className={`toggle ${state.motion?'on':''}`}/>{osReduced?'系统减少动效':state.motion?'动效开':'动效关'}</button><button className="icon-button" aria-label="恢复样稿" title="恢复示例内容与默认布局" onClick={reset}><Icon name="reset" size={16}/></button><a className="proposal-link" href="homepage-style-proposal.html" target="_blank" rel="noopener">方案 <Icon name="arrow" size={13}/></a><button className="icon-button" aria-label="收起评审工具" onClick={()=>setDock(false)}><Icon name="close" size={15}/></button></aside>:<button className="show-review" onClick={()=>setDock(true)}><Icon name="grid" size={14}/> 展开样稿评审</button>}
    {message&&<div className="toast" role="status"><Icon name="check" size={15}/>{message}{removedSite&&<button onClick={undoSite}>撤销移除</button>}</div>}
    {contextMenu&&<SiteContextMenu context={contextMenu} onClose={()=>setContextMenu(null)} onEdit={site=>{setContextMenu(null);setSiteDraft({...site});setSiteError('');}} onRemove={removeSite} onAdd={()=>{setContextMenu(null);openNewSite();}}/>}
    {siteDraft&&<SiteEditor draft={siteDraft} error={siteError} onChange={setSiteDraft} onSave={saveSite} onClose={()=>setSiteDraft(null)} onRemove={()=>removeSite()}/>}
    {picker&&<ComponentPicker order={state.order} onAdd={addWidget} onClose={()=>setPicker(false)}/>}
    {settings&&<div className="appearance-backdrop"><section className="settings-dialog appearance-drawer" role="dialog" aria-modal="false" aria-labelledby="settings-title" ref={dialogRef}>
      <div className="dialog-heading"><div><span className="eyebrow">MAKE IT YOURS</span><h2 id="settings-title">外观设置</h2></div><button className="icon-button" aria-label="关闭外观设置" onClick={()=>setSettings(false)}><Icon name="close"/></button></div>
      <p className="appearance-intro">调整立即预览，自动保存在此浏览器。</p>
      <div className="appearance-tabs" role="tablist" aria-label="外观设置分类" onKeyDown={e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const tabs=['clock','search','background'],index=tabs.indexOf(settingsTab),next=e.key==='Home'?0:e.key==='End'?2:(index+(e.key==='ArrowRight'?1:-1)+3)%3;setSettingsTab(tabs[next]);e.currentTarget.querySelectorAll('[role="tab"]')[next]?.focus();}}}>{[{id:'clock',name:'时间'},{id:'search',name:'搜索框'},{id:'background',name:'背景与风格'}].map(tab=><button key={tab.id} role="tab" id={`appearance-${tab.id}-tab`} aria-selected={settingsTab===tab.id} aria-controls={`appearance-${tab.id}-panel`} tabIndex={settingsTab===tab.id?0:-1} onClick={()=>setSettingsTab(tab.id)}>{tab.name}</button>)}</div>
      <div className="appearance-content">
      {settingsTab!=='background'&&<HomepageAppearanceControls tab={settingsTab} appearance={state.appearance} onChange={updateAppearance} clock={clock}/>}
      {settingsTab==='background'&&<div className="appearance-panel" role="tabpanel" id="appearance-background-panel" aria-labelledby="appearance-background-tab">{themeButtons('settings-themes')}<div className="settings-current">{THEMES.find(t=>t.id===state.theme).note}</div>
      <section className="background-settings" aria-labelledby="background-title"><div className="background-heading"><h3 id="background-title">自定义背景</h3><button onClick={()=>{updateBackground({type:'material',shade:35,blur:0,position:'center'});setBackgroundError('');}}>恢复默认</button></div><div className="background-modes" role="group" aria-label="背景类型">{[{id:'material',name:'默认材质'},{id:'color',name:'纯色'},{id:'image',name:'图片'}].map(item=><button key={item.id} aria-pressed={state.background.type===item.id} onClick={()=>chooseBackground(item.id)}>{item.name}</button>)}</div>
        {state.background.type==='color'&&<div className="color-controls"><input type="color" aria-label="选择背景色" value={state.background.color} onChange={e=>{updateBackground({color:e.target.value});setBackgroundError('');}}/><input type="text" aria-label="背景颜色值" value={colorDraft} onChange={e=>setColorDraft(e.target.value)} onBlur={applyColor} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();applyColor();}}} maxLength={7}/><button onClick={applyColor}>应用颜色</button></div>}
        <div className={`background-upload ${state.background.image?'has-image':''}`}>
          {state.background.image?<img className="background-thumbnail" src={state.background.image} alt="已选背景缩略图"/>:<Icon name="plus" size={19}/>}
          <span><strong>{state.background.name||'用你自己的照片或插画'}</strong><small>PNG / JPEG / WebP · 样稿上限 2 MB</small></span><button onClick={()=>uploadRef.current?.click()}>{state.background.image?'更换图片':'上传图片'}</button>{state.background.image&&<button className="icon-button" aria-label="移除背景图片" onClick={clearBackground}><Icon name="close" size={14}/></button>}
        </div>
        {state.background.type==='image'&&<div className="image-adjustments"><label><span>遮罩强度 <output>{state.background.shade}%</output></span><input type="range" aria-label="背景遮罩强度" min="0" max="85" value={state.background.shade} onChange={e=>updateBackground({shade:Number(e.target.value)})}/></label><label><span>背景模糊 <output>{state.background.blur} px</output></span><input type="range" aria-label="背景模糊" min="0" max="20" value={state.background.blur} onChange={e=>updateBackground({blur:Number(e.target.value)})}/></label><label className="position-select"><span>画面位置</span><select aria-label="背景画面位置" value={state.background.position} onChange={e=>updateBackground({position:e.target.value})}><option value="center">居中</option><option value="top">靠上</option><option value="bottom">靠下</option></select></label></div>}
        {backgroundError&&<p className="field-error" role="alert">{backgroundError}</p>}<p className="background-tip">图片保存在此浏览器。文字会随局部明暗自动换色，复杂区域自动补对比保护。</p>
      </section></div>}</div>
      <div className="appearance-bottom"><label className="settings-switch"><span>启用细节动效<small>{osReduced?'当前系统已要求减少动态效果':'翻页、悬停和状态切换时轻轻响应'}</small></span><input type="checkbox" checked={state.motion} onChange={e=>update({motion:e.target.checked})}/></label>{state.order.length>0&&<button className="dialog-edit" onClick={()=>{setSettings(false);setEditing(true);}}>调整组件布局 <Icon name="arrow" size={16}/></button>}<button className="primary-action appearance-done" onClick={()=>setSettings(false)}>完成 <Icon name="check" size={15}/></button><a className="dialog-plan" href="homepage-style-proposal.html" target="_blank" rel="noopener">查看完整风格方案 ↗</a></div></section></div>}
  </div>;
}
ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
