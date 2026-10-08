const {test} = require('node:test');
const assert = require('node:assert/strict');
const contrast = require('../docs/assets/homepage-study/homepage-background-contrast.js');

// Independent reference calculation checks resulting RGBs, not the helper's reported ratio.
function ratio(ink,paper) {
  const brightness=rgb=>rgb.map(n=>n/255).map(n=>n<=.04045?n/12.92:Math.pow((n+.055)/1.055,2.4)).reduce((sum,n,i)=>sum+n*[.2126,.7152,.0722][i],0);
  const a=brightness(ink),b=brightness(paper);
  return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
}

test('dark forest background uses light exposed text', () => {
  assert.equal(contrast.chooseForeground([[7,29,24], [12,43,36]]).tone, 'light');
});
test('light wallpaper uses dark exposed text', () => {
  assert.equal(contrast.chooseForeground([[247,247,240], [221,232,230]]).tone, 'dark');
});
test('split wallpaper evaluates each text region independently', () => {
  assert.notEqual(contrast.chooseForeground([[7,29,24]]).tone, contrast.chooseForeground([[247,247,240]]).tone);
});
test('mixed highlights and shadows need local protection', () => {
  assert.ok(contrast.chooseForeground([[0,0,0],[255,255,255]]).opacity > 0);
});
test('uniform light and dark regions do not unnecessarily cover the wallpaper', () => {
  for(const samples of [[[7,29,24]],[[247,247,240]]])assert.equal(contrast.chooseForeground(samples).opacity,0);
});
test('selected ink plus protection reaches the ordinary-text target for every sampled color', () => {
  const sets=[[[0,0,0],[255,255,255]],[[255,0,0],[0,255,0],[0,0,255]],[[19,22,18],[124,190,201],[249,240,222]],[[100,100,100],[135,135,135]]];
  for(const samples of sets){
    const result=contrast.chooseForeground(samples);
    for(const pixel of samples){
      const composite=pixel.map((n,i)=>n*(1-result.opacity)+result.overlay[i]*result.opacity);
      assert.ok(ratio(result.rgb,composite)>=4.8,JSON.stringify({pixel,result,ratio:ratio(result.rgb,composite)}));
    }
  }
});
test('theme shade is considered before deciding the foreground', () => {
  const original=[7,29,24],paper=[242,240,233];
  assert.equal(contrast.chooseForeground([original]).tone,'light');
  assert.equal(contrast.chooseForeground([contrast.blend(original,paper,.85)]).tone,'dark');
});
test('transparent image pixel composites onto the base surface', () => {
  assert.deepEqual(contrast.blend([242,240,233],[0,0,0],0),[242,240,233]);
  assert.deepEqual(contrast.blend([242,240,233],[0,0,0],1),[0,0,0]);
});
test('portrait cover respects center, top and bottom crops', () => {
  assert.deepEqual(contrast.coverRect(100,200,400,200,'center'),{x:0,y:-300,width:400,height:800});
  assert.equal(contrast.coverRect(100,200,400,200,'top').y,0);
  assert.equal(contrast.coverRect(100,200,400,200,'bottom').y,-600);
});
test('landscape cover accounts for horizontal cropping in a narrow window', () => {
  assert.deepEqual(contrast.coverRect(400,200,100,200),{x:-150,y:0,width:400,height:200});
  assert.throws(()=>contrast.coverRect(0,200,400,200),RangeError);
});
test('unavailable or invalid sampling has safe readable fallback over arbitrary images', () => {
  for(const samples of [[],null,[[NaN,0,0]],[[256,0,0]]]){
    const result=contrast.chooseForeground(samples);
    assert.equal(result.fallback,true);
    for(const pixel of [[0,0,0],[255,255,255]]){
      assert.ok(ratio(result.rgb,pixel.map((n,i)=>n*(1-result.opacity)+result.overlay[i]*result.opacity))>=4.8);
    }
  }
});
test('luminance reference and RGB input validation', () => {
  assert.equal(contrast.contrastRatio([0,0,0],[255,255,255]),21);
  assert.deepEqual(contrast.parseHex('#0C2B24'),[12,43,36]);
  assert.throws(()=>contrast.parseHex('#abc'),TypeError);
});
test('floating clock chooses white on dark backgrounds and dark ink on light ones',()=>{
  assert.equal(contrast.chooseFloatingForeground([[7,29,24]]).tone,'light');
  assert.equal(contrast.chooseFloatingForeground([[247,247,240]]).tone,'dark');
});
test('floating clock never gains a rectangular scrim, including mixed and invalid samples',()=>{
  for(const samples of [[[0,0,0],[255,255,255]],[],null,[[NaN,0,0]],[[256,0,0]]])assert.equal(contrast.chooseFloatingForeground(samples).opacity,0);
});
test('floating clock prefers ink covering most of a mixed region and reports raw contrast honestly',()=>{
  assert.equal(contrast.chooseFloatingForeground([[0,0,0],[0,0,0],[255,255,255]]).tone,'light');
  const result=contrast.chooseFloatingForeground([[0,0,0],[255,255,255]]);
  assert.ok(result.minContrast<4.5);
  assert.equal(result.minContrast,Math.min(ratio(result.rgb,[0,0,0]),ratio(result.rgb,[255,255,255])));
});
test('search ink considers the translucent surface instead of copying wallpaper ink',()=>{
  const dark=[[7,29,24]],surface=[252,251,247];
  assert.equal(contrast.chooseSearchForeground(dark,surface,0).tone,'dark');
  assert.equal(contrast.chooseSearchForeground(dark,surface,15).tone,'dark');
  assert.equal(contrast.chooseSearchForeground(dark,surface,100).tone,'light');
  assert.equal(contrast.chooseSearchForeground([],surface,0).tone,'dark');
});
