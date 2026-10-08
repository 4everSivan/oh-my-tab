/* UI controls for the minimal homepage prototype. */
// Symmetric continuous-corner approximation, shared by every site and the add button.
const SITE_SHAPE='M32 0C48 0 56 0 60 4C64 8 64 16 64 32C64 48 64 56 60 60C56 64 48 64 32 64C16 64 8 64 4 60C0 56 0 48 0 32C0 16 0 8 4 4C8 0 16 0 32 0Z';
function SiteIcon({site}){
  const sources=HomepageModel.faviconSources(site.url);
  const [index,setIndex]=useState(0),[loaded,setLoaded]=useState(false),[timedOut,setTimedOut]=useState(false);
  const timeoutRef=useRef(null),loadedRef=useRef(false);
  useEffect(()=>{timeoutRef.current=setTimeout(()=>{if(!loadedRef.current)setTimedOut(true);},5000);return()=>clearTimeout(timeoutRef.current);},[]);
  const fallback=timedOut||index>=sources.length;
  return <span className="site-icon" data-icon-state={loaded?'loaded':fallback?'fallback':'loading'}>
    <svg className="site-surface" viewBox="-.5 -.5 65 65" aria-hidden="true"><path d={SITE_SHAPE}/></svg>
    {!loaded&&<span className="site-initial" aria-hidden="true">{HomepageModel.fallbackInitial(site.name)}</span>}
    {!fallback&&<img className={loaded?'site-favicon is-loaded':'site-favicon'} src={sources[index]} alt="" referrerPolicy="no-referrer" onLoad={e=>{if(e.currentTarget.naturalWidth>1){loadedRef.current=true;clearTimeout(timeoutRef.current);setLoaded(true);}else setIndex(n=>n+1);}} onError={()=>{setLoaded(false);setIndex(n=>n+1);}}/>}
  </span>;
}
function SiteSection({sites,onAdd,onContext,onHold,onMove,onClick,dragged,target}){
  return <section className="site-section" aria-labelledby="sites-heading" id="homepage-sites">
    <div className="sites-heading"><h2 id="sites-heading" data-wallpaper-text="sites-heading">常用网站</h2></div>
    <div className="site-grid">
      {sites.map(site=><div className={`site-tile ${dragged===site.id?'site-dragging':''} ${target===site.id?'site-drop-target':''}`} key={site.id} data-site={site.id}>
        <a className="site-link" href={site.url} target="_blank" rel="noopener noreferrer" aria-label={`打开 ${site.name}`} title="右键编辑 · 长按拖动排序" draggable={false} onContextMenu={e=>{e.preventDefault();onContext(site,e.clientX,e.clientY);}} onPointerDown={e=>onHold(e,site.id)} onClick={onClick} onKeyDown={e=>{if(e.key==='ContextMenu'||(e.shiftKey&&e.key==='F10')){e.preventDefault();const rect=e.currentTarget.getBoundingClientRect();onContext(site,rect.left,rect.bottom);}if(e.altKey&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();onMove(site.id,e.key==='ArrowLeft'?-1:1);}}}><SiteIcon key={`${site.id}:${site.url}`} site={site}/><strong className="site-label" data-wallpaper-text={`site-${site.id}`}>{site.name}</strong></a>
      </div>)}
      <button className="add-site site-link" onClick={onAdd}><span className="site-icon"><svg className="site-surface" viewBox="-.5 -.5 65 65" aria-hidden="true"><path d={SITE_SHAPE}/></svg><Icon name="plus" size={22}/></span><strong className="site-label" data-wallpaper-text="add-site">添加网站</strong></button>
    </div>
  </section>;
}
function SiteContextMenu({context,onEdit,onRemove,onAdd,onClose}){
  const ref=useRef(null);
  const [position,setPosition]=useState({left:Math.max(8,Math.min(context.x,innerWidth-204)),top:Math.max(8,Math.min(context.y,innerHeight-208))});
  React.useLayoutEffect(()=>{const rect=ref.current.getBoundingClientRect();setPosition({left:Math.max(8,Math.min(context.x,innerWidth-rect.width-8)),top:Math.max(8,Math.min(context.y,innerHeight-rect.height-8))});},[context]);
  useEffect(()=>{
    const previous=document.activeElement;ref.current?.querySelector('[role="menuitem"]')?.focus();
    const outside=e=>{if(!ref.current?.contains(e.target))onClose();};
    const close=()=>onClose();document.addEventListener('pointerdown',outside);window.addEventListener('resize',close);window.addEventListener('scroll',close,{passive:true});
    return()=>{document.removeEventListener('pointerdown',outside);window.removeEventListener('resize',close);window.removeEventListener('scroll',close);if(previous?.isConnected)previous.focus();};
  },[]);
  const key=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();onClose();}if(['ArrowUp','ArrowDown','Home','End'].includes(e.key)){e.preventDefault();const items=[...ref.current.querySelectorAll('[role="menuitem"]')],i=items.indexOf(document.activeElement);items[e.key==='Home'?0:e.key==='End'?items.length-1:(i+(e.key==='ArrowDown'?1:-1)+items.length)%items.length]?.focus();}if(e.key==='Tab')onClose();};
  return <div className="site-context-menu" role="menu" aria-label={`${context.site.name}的网站菜单`} ref={ref} style={position} onKeyDown={key} onContextMenu={e=>e.preventDefault()}>
    <span className="context-site-name">{context.site.name}</span><button role="menuitem" onClick={()=>onEdit(context.site)}><Icon name="settings" size={14}/>编辑网站</button><a role="menuitem" href={context.site.url} target="_blank" rel="noopener noreferrer" onClick={onClose}><Icon name="arrow" size={14}/>在新标签页打开</a><button role="menuitem" className="context-remove" onClick={()=>onRemove(context.site)}><Icon name="close" size={14}/>移除网站</button><div className="context-divider"/><button role="menuitem" onClick={onAdd}><Icon name="plus" size={14}/>添加网站</button>
  </div>;
}
function HomepageSearch({query,onQuery,engine,onEngine,inputRef}){
  const spec=HomepageModel.searchSpec(engine);
  return <form className="homepage-search search-box" data-wallpaper-text="search" data-wallpaper-floating="true" role="search" aria-label="网页搜索" action={spec.action} method="get" target="_blank" rel="noopener noreferrer" onSubmit={e=>{if(!query.trim()){e.preventDefault();inputRef.current?.focus();}}}>
    <Icon name="search" size={19}/><select aria-label="搜索引擎" value={engine} onChange={e=>onEngine(e.target.value)}>{HomepageModel.ENGINES.map(item=><option value={item.id} key={item.id}>{item.name}</option>)}</select>
    <span className="search-divider" aria-hidden="true"/><input type="search" ref={inputRef} name={spec.parameter} aria-label="搜索网页" value={query} onChange={e=>onQuery(e.target.value)} placeholder="搜索网页，开始新的一页" autoComplete="off" required/>
    <button type="submit" aria-label="开始搜索" title="搜索网页"><Icon name="arrow" size={18}/></button>
  </form>;
}
function AppearanceRange({label,value,min,max,step=1,unit='',onChange}){
  return <label className="appearance-range"><span>{label}<output>{value}{unit}</output></span><input type="range" aria-label={label} min={min} max={max} step={step} value={value} onChange={e=>onChange(Number(e.target.value))}/></label>;
}
function AppearanceAlignment({label,value,onChange}){
  return <label className="appearance-select"><span>{label}</span><select aria-label={label} value={value} onChange={e=>onChange(e.target.value)}><option value="left">靠左</option><option value="center">居中</option><option value="right">靠右</option></select></label>;
}
function HomepageAppearanceControls({tab,appearance,onChange,clock}){
  const c=appearance.clock,s=appearance.search;
  const setClock=patch=>onChange('clock',patch),setSearch=patch=>onChange('search',patch);
  const reset=()=>onChange(tab,HomepageModel.defaultAppearance()[tab]);
  return <section className="appearance-panel" role="tabpanel" id={`appearance-${tab}-panel`} aria-labelledby={`appearance-${tab}-tab`}>
    <div className="appearance-section-heading"><h3>{tab==='clock'?'时间与日期':'搜索框'}</h3><button onClick={reset}>{tab==='clock'?'恢复时间默认':'恢复搜索默认'}</button></div>
    {tab==='clock'?<>
      <div className="clock-sample" aria-hidden="true">{clock}</div>
      <label className="appearance-select"><span>时间字体</span><select aria-label="时间字体" value={c.font} onChange={e=>setClock({font:e.target.value})}><option value="modern">现代 · 系统字体</option><option value="mono">等宽 · 数字时钟</option><option value="serif">衬线 · 经典钟面</option></select></label>
      <AppearanceRange label="时间字号" value={c.size} min={48} max={144} step={4} unit=" px" onChange={size=>setClock({size})}/>
      <AppearanceRange label="时间字重" value={c.weight} min={200} max={800} step={100} onChange={weight=>setClock({weight})}/>
      <AppearanceAlignment label="时间水平位置" value={c.align} onChange={align=>setClock({align})}/>
      <AppearanceRange label="时间顶部留白" value={c.top} min={0} max={240} step={2} unit=" px" onChange={top=>setClock({top})}/>
      <label className="appearance-select"><span>时间阴影</span><select aria-label="时间阴影" value={c.shadow} onChange={e=>setClock({shadow:e.target.value})}><option value="none">关闭 · 清爽文字</option><option value="soft">柔和深色投影</option></select></label>
      <label className="appearance-switch"><span>显示日期</span><input type="checkbox" checked={c.showDate} onChange={e=>setClock({showDate:e.target.checked})}/></label>
      <label className="appearance-switch"><span>显示秒数</span><input type="checkbox" checked={c.showSeconds} onChange={e=>setClock({showSeconds:e.target.checked})}/></label>
      <p className="appearance-help">时间随背景明暗换色。默认无描边，也没有背景框。</p>
    </>:<>
      <AppearanceAlignment label="搜索框水平位置" value={s.align} onChange={align=>setSearch({align})}/>
      <AppearanceRange label="搜索框上方间距" value={s.gap} min={0} max={120} step={2} unit=" px" onChange={gap=>setSearch({gap})}/>
      <AppearanceRange label="搜索框宽度" value={s.width} min={320} max={760} step={20} unit=" px" onChange={width=>setSearch({width})}/>
      <AppearanceRange label="搜索框背景透明度" value={s.transparency} min={0} max={100} step={5} unit="%" onChange={transparency=>setSearch({transparency})}/>
      <AppearanceRange label="搜索框背景模糊" value={s.blur} min={0} max={24} unit=" px" onChange={blur=>setSearch({blur})}/>
      <p className="appearance-help">透明度 0% 是实色，100% 是透明。模糊只作用于框后的背景，文字保持清晰。</p>
    </>}
  </section>;
}
function HomepageDialog({id,title,eyebrow,onClose,children,className=''}){
  const ref=useRef(null);
  useEffect(()=>{const previous=document.activeElement;(ref.current?.querySelector('input,textarea')||ref.current?.querySelector('button'))?.focus();return()=>{if(previous?.isConnected)previous.focus();else document.querySelector('.home-actions button')?.focus();};},[]);
  const keys=e=>{
    if(e.key==='Escape'){e.stopPropagation();onClose();}
    if(e.key==='Tab'){
      const items=[...ref.current.querySelectorAll('button,a,input,textarea,select')].filter(el=>!el.disabled&&el.getClientRects().length);
      const first=items[0],last=items[items.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
    }
  };
  return <div className="modal-backdrop" onClick={e=>{if(e.target===e.currentTarget)onClose();}}><section className={`settings-dialog ${className}`} role="dialog" aria-modal="true" aria-labelledby={id} ref={ref} onKeyDown={keys}><div className="dialog-heading"><div><span className="eyebrow">{eyebrow}</span><h2 id={id}>{title}</h2></div><button className="icon-button" aria-label={`关闭${title}`} onClick={onClose}><Icon name="close"/></button></div>{children}</section></div>;
}
function SiteEditor({draft,error,onChange,onSave,onClose,onRemove}){
  const [previewURL,setPreviewURL]=useState(draft.id?draft.url:'');
  return <HomepageDialog id="site-editor-title" title={draft.id?'编辑网站':'添加网站'} eyebrow="YOUR SHORTCUT" onClose={onClose} className="site-dialog"><p>填入名称和网址，把常用入口留在首页。</p><form onSubmit={onSave}>
    <label className="editor-field">网站名称<input value={draft.name} onChange={e=>onChange({...draft,name:e.target.value})} autoComplete="off" required maxLength={60} placeholder="例如：我的文档"/></label>
    <label className="editor-field">网站地址<input value={draft.url} onChange={e=>onChange({...draft,url:e.target.value})} onBlur={()=>setPreviewURL(HomepageModel.normalizeWebsite('site',draft.url)?.url||'')} autoComplete="url" required maxLength={2048} placeholder="https://example.com" inputMode="url"/></label>
    <div className="site-preview"><SiteIcon key={previewURL} site={{name:draft.name||'网站',url:previewURL}}/><span><strong>{draft.name.trim()||'网站名称'}</strong><small>图标自动来自网站，获取不到就显示名称首字。</small></span></div>
    {error&&<p className="field-error" role="alert">{error}</p>}
    <div className="editor-actions">{draft.id&&<button type="button" className="remove-site" onClick={onRemove}>移除网站</button>}<button type="button" className="secondary-action" onClick={onClose}>取消</button><button className="primary-action" type="submit">保存网站 <Icon name="check" size={15}/></button></div>
  </form></HomepageDialog>;
}
function ComponentPicker({order,onAdd,onClose}){
  const choices=[{id:'calendar',name:'撕页日历',caption:'每天翻一页，给时间一点仪式感。',icon:'grid'},{id:'focus',name:'专注计时',caption:'选一段时间，安静做好一件事。',icon:'play'},{id:'tasks',name:'今日待办',caption:'记下要做的事，一件件完成。',icon:'check'},{id:'note',name:'随手便签',caption:'留住想法，也给自己留点空白。',icon:'note'}];
  return <HomepageDialog id="component-picker-title" title="添加组件" eyebrow="A LITTLE MORE, WHEN YOU NEED IT" onClose={onClose} className="component-dialog"><p>首页由你安排。需要什么，再添什么。</p><div className="component-choices">{choices.map(item=><div className="component-choice" key={item.id}><span className={`component-preview preview-${item.id}`}><Icon name={item.icon} size={24}/></span><span><strong>{item.name}</strong><small>{item.caption}</small></span><button disabled={order.includes(item.id)} aria-label={`添加${item.name}`} onClick={e=>{onAdd(item.id);e.currentTarget.closest('.settings-dialog')?.querySelector('.picker-done')?.focus();}}>{order.includes(item.id)?<><Icon name="check" size={14}/>已添加</>:<><Icon name="plus" size={14}/>添加</>}</button></div>)}</div><button className="picker-done primary-action" onClick={onClose}>完成</button></HomepageDialog>;
}
