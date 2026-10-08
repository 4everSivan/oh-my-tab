/* Pure background geometry and contrast rules; bundled inline in the standalone demo. */
const HomepageBackgroundContrast = (() => {
  const TARGET = 4.8; // Margin above 4.5:1 for ordinary text; sampled pixels aren't a compliance audit.
  const LIGHT = [255,255,255], DARK = [20,28,32];
  /** @param {string} hex @returns {number[]} */
  function parseHex(hex) {
    if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new TypeError('Expected a six-digit RGB color');
    return [1,3,5].map(start => parseInt(hex.slice(start,start+2),16));
  }
  /** WCAG sRGB luminance: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html */
  function luminance(rgb) {
    const linear = rgb.map(value => {const s=value/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4;});
    return linear[0]*.2126 + linear[1]*.7152 + linear[2]*.0722;
  }
  function contrastRatio(a,b) {
    const x=luminance(a), y=luminance(b);
    return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
  }
  /** Alpha compositing in sRGB, matching the wallpaper shade and local CSS protection. */
  function blend(background,overlay,opacity) {
    return background.map((value,i) => value*(1-opacity)+overlay[i]*opacity);
  }
  /** Match CSS background-size:cover, horizontally centered and vertically positioned. */
  function coverRect(imageWidth,imageHeight,frameWidth,frameHeight,position='center') {
    if (![imageWidth,imageHeight,frameWidth,frameHeight].every(n=>Number.isFinite(n)&&n>0)) throw new RangeError('Invalid image or frame size');
    const scale=Math.max(frameWidth/imageWidth,frameHeight/imageHeight);
    const width=imageWidth*scale, height=imageHeight*scale;
    return {x:(frameWidth-width)/2,y:position==='top'?0:(frameHeight-height)*(position==='bottom'?1:.5),width,height};
  }
  /** @param {number[][]} samples RGB pixels behind one text region. */
  function chooseForeground(samples) {
    if (!Array.isArray(samples) || !samples.length || !samples.every(rgb=>Array.isArray(rgb)&&rgb.length===3&&rgb.every(n=>Number.isFinite(n)&&n>=0&&n<=255))) {
      return {tone:'light',color:'#ffffff',rgb:LIGHT,overlay:[0,0,0],opacity:.72,minContrast:contrastRatio(LIGHT,[71.4,71.4,71.4]),fallback:true};
    }
    const candidates = [{tone:'light',color:'#ffffff',rgb:LIGHT,overlay:[0,0,0]}, {tone:'dark',color:'#141c20',rgb:DARK,overlay:LIGHT}];
    for (const candidate of candidates) {
      const minimum=opacity=>samples.reduce((min,pixel)=>Math.min(min,contrastRatio(candidate.rgb,blend(pixel,candidate.overlay,opacity))),Infinity);
      candidate.opacity=0;
      candidate.minContrast=minimum(0);
      if (candidate.minContrast<TARGET) {
        let low=0,high=1;
        for(let i=0;i<12;i++){const middle=(low+high)/2;if(minimum(middle)>=TARGET)high=middle;else low=middle;}
        // Round upward so serializing a CSS opacity cannot erode the target.
        candidate.opacity=Math.ceil(high*1000)/1000;
        candidate.minContrast=minimum(candidate.opacity);
      }
    }
    return candidates.sort((a,b)=>a.opacity-b.opacity || b.minContrast-a.minContrast)[0];
  }
  /** Floating text chooses ink only; optional shadows are handled by the appearance settings. */
  function chooseFloatingForeground(samples){
    if(!Array.isArray(samples)||!samples.length||samples.some(pixel=>!Array.isArray(pixel)||pixel.length!==3||pixel.some(n=>!Number.isFinite(n)||n<0||n>255)))return {...chooseForeground([]),opacity:0,minContrast:1};
    const candidates=[{tone:'light',color:'#ffffff',rgb:LIGHT},{tone:'dark',color:'#141c20',rgb:DARK}];
    for(const item of candidates){
      const ratios=samples.map(pixel=>contrastRatio(item.rgb,pixel));
      item.coverage=ratios.filter(value=>value>=4.5).length/samples.length;
      item.average=ratios.reduce((sum,value)=>sum+Math.log(value),0)/ratios.length;
      item.minContrast=ratios.reduce((lowest,value)=>Math.min(lowest,value),Infinity);item.overlay=[0,0,0];item.opacity=0;
    }
    return candidates.sort((a,b)=>b.coverage-a.coverage||b.average-a.average)[0];
  }
  /** Search text stays opaque; only its surface composites over the wallpaper. */
  function chooseSearchForeground(samples,surface,transparency){
    const alpha=1-Math.max(0,Math.min(100,transparency))/100;
    if(!Array.isArray(samples)||!samples.length)return alpha>=.5?chooseFloatingForeground([surface]):chooseFloatingForeground([]);
    return chooseFloatingForeground(samples.map(pixel=>blend(pixel,surface,alpha)));
  }
  return {TARGET,parseHex,luminance,contrastRatio,blend,coverRect,chooseForeground,chooseFloatingForeground,chooseSearchForeground};
})();
if (typeof module !== 'undefined' && module.exports) module.exports = HomepageBackgroundContrast;
