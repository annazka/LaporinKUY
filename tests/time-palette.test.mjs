import test from 'node:test';
import assert from 'node:assert/strict';
import {phases,fromHex,interpolate,toRgb,contrast,smoothstep,secondsInJakarta,schedule,getTheme,timePaletteBootstrap} from '../lib/time-palette.mjs';

const at=time=>new Date(`2026-10-20T${time}+07:00`);
const rgbDistance=(a,b)=>Math.max(...toRgb(a).map((value,i)=>Math.abs(value-toRgb(b)[i])));

test('WIB uses Asia/Jakarta independently of the host date or timezone, including fractions of a second',()=>{
 assert.equal(secondsInJakarta(new Date('2026-10-19T22:00:01.250Z')),5*3600+1.25);
 assert.equal(secondsInJakarta(new Date('2026-10-19T17:00:00Z')),0);
});

test('every peak and its surrounding plateau retain the exact requested palette',()=>{
 for(const [phase,times] of Object.entries({night:['00:00:00','03:59:00','19:01:00'],morning:['06:01:00','07:30:00','08:59:00'],day:['11:01:00','12:30:00','13:59:00'],evening:['16:01:00','16:30:00','16:59:00']})){
  for(const time of times){const theme=getTheme(at(time));assert.equal(theme.from,phase);assert.equal(theme.to,phase);theme.primary.forEach((color,i)=>assert.ok(rgbDistance(color,fromHex(phases[phase][i]))<1e-6,`${phase} ${time}`));}
 }
});

test('two-hour windows use smoothstep and exact OKLCH midpoints at session boundaries',()=>{
 assert.equal(smoothstep(.25),.15625);
 for(const [hour,from,to] of [[5,'night','morning'],[10,'morning','day'],[15,'day','evening'],[18,'evening','night']]){
  const time=hour.toString().padStart(2,'0')+':00:00';
  const theme=getTheme(at(time));assert.deepEqual(schedule(at(time)),{from,to,amount:.5});
  theme.primary.forEach((color,i)=>assert.ok(rgbDistance(color,interpolate(fromHex(phases[from][i]),fromHex(phases[to][i]),.5))<1e-7));
  const start=at(`${(hour-1).toString().padStart(2,'0')}:00:00`);
  assert.equal(schedule(new Date(+start+30*60*1000)).amount,.15625);
 }
});

test('hue takes the short arc and achromatic endpoints inherit the chromatic hue',()=>{
 const c=(h,chroma=.1)=>({l:.6,c:chroma,h});
 assert.equal(interpolate(c(350),c(10),.5).h,0);
 assert.equal(interpolate(c(0,0),c(260),.5).h,260);
 assert.equal(interpolate(c(40),c(0,0),.5).h,40);
});

test('colors are continuous at every transition endpoint and through midnight',()=>{
 for(const time of ['04:00:00','06:00:00','09:00:00','11:00:00','14:00:00','16:00:00','17:00:00','19:00:00']){
  const boundary=+at(time),before=getTheme(new Date(boundary-1)),after=getTheme(new Date(boundary+1));
  before.primary.forEach((color,i)=>assert.ok(rgbDistance(color,after.primary[i])<1e-6,time));
 }
 const before=getTheme(at('23:59:59.999')),after=getTheme(new Date(+at('23:59:59.999')+2));
 assert.deepEqual(before.properties,after.properties);
 const a=getTheme(at('17:30:00.000')),b=getTheme(at('17:30:00.500'));
 assert.notDeepEqual(a.properties,b.properties,'seconds must affect the interpolation');
});

test('night UI roles are monochrome and text/button contrast stays readable across the whole day',()=>{
 for(const color of Object.values(getTheme(at('00:00:00')).tokens))assert.equal(color.c,0);
 for(let seconds=0;seconds<86400;seconds+=60){
  const {tokens}=getTheme(new Date(+at('00:00:00')+seconds*1000));
  for(const fg of ['text','muted','subtle'])for(const bg of ['canvas','canvas-end','surface-0','surface-1','surface-2','surface-accent']){
   assert.ok(contrast(tokens[fg],tokens[bg])>=4.5,`${fg} on ${bg} at ${seconds}: ${contrast(tokens[fg],tokens[bg])}`);
  }
  assert.ok(contrast(tokens['on-accent'],tokens.accent)>=4.5);
  assert.ok(contrast(tokens['on-accent'],tokens['accent-hover'])>=4.5);
 }
});

test('pre-paint engine is self-contained and resynchronizes to wall time on resume',()=>{
 const script=timePaletteBootstrap();
 assert.doesNotThrow(()=>new Function(script));
 let current=at('07:30:00'),frame,callbacks={},hidden=false;
 const style={values:{},setProperty(k,v){this.values[k]=v;}};
 const doc={get hidden(){return hidden;},addEventListener(k,v){callbacks[k]=v;},removeEventListener(){}};
 const win={requestAnimationFrame(fn){frame=fn;return 1;},cancelAnimationFrame(){},addEventListener(k,v){callbacks[k]=v;},removeEventListener(){}};
 doc.defaultView=win;
 const root={style,dataset:{},ownerDocument:doc};
 const RealDate=Date;
 class ClockDate extends RealDate{constructor(...args){super(...(args.length?args:[current]));}}
 new Function('document','Date',script)({documentElement:root},ClockDate);
 assert.deepEqual(style.values,getTheme(current).properties);
 current=at('16:30:00');hidden=true;callbacks.visibilitychange();hidden=false;callbacks.visibilitychange();
 assert.deepEqual(style.values,getTheme(current).properties,'returning tab immediately adopts current WIB time');
 current=at('18:00:00');callbacks.focus();assert.deepEqual(style.values,getTheme(current).properties);
 current=at('18:00:01');frame(500);assert.deepEqual(style.values,getTheme(current).properties);
 current=at('00:00:00');callbacks.pageshow();assert.deepEqual(style.values,getTheme(current).properties);
 win.__laporkuyTimePalette();
});
