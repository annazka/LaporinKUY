// This factory is self-contained so the same engine can run on the server,
// in tests, and as a small pre-paint script without waiting for hydration.
export function createTimePaletteRuntime(){
 const phases={
  night:['#080808','#262626','#F5F5F5'],
  morning:['#080C18','#102A56','#244C85'],
  day:['#1264D8','#3399F5','#B9E3FF'],
  evening:['#B84725','#F58243','#FFD09A'],
 };
 const formatter=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Jakarta',hourCycle:'h23',hour:'2-digit',minute:'2-digit',second:'2-digit'});
 const smoothstep=t=>t*t*(3-2*t);
 const wrap=h=>(h%360+360)%360;
 function fromHex(hex){
  const rgb=hex.replace('#','').match(/../g).map(channel=>{
   const c=parseInt(channel,16)/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;
  });
  const [r,g,b]=rgb;
  const l=Math.cbrt(.4122214708*r+.5363325363*g+.0514459929*b);
  const m=Math.cbrt(.2119034982*r+.6806995451*g+.1073969566*b);
  const s=Math.cbrt(.0883024619*r+.2817188376*g+.6299787005*b);
  const L=.2104542553*l+.793617785*m-.0040720468*s;
  const a=1.9779984951*l-2.428592205*m+.4505937099*s;
  const bb=.0259040371*l+.7827717662*m-.808675766*s;
  const c=Math.hypot(a,bb);
  return {l:L,c:c<1e-7?0:c,h:c<1e-7?0:wrap(Math.atan2(bb,a)*180/Math.PI)};
 }
 function interpolate(a,b,t){
  if(t<=0)return {...a};if(t>=1)return {...b};
  // A neutral endpoint inherits the other hue, preventing a detour through red.
  const ah=a.c<1e-7?b.h:a.h,bh=b.c<1e-7?ah:b.h;
  const delta=((bh-ah+540)%360)-180;
  return {l:a.l+(b.l-a.l)*t,c:a.c+(b.c-a.c)*t,h:wrap(ah+delta*t)};
 }
 function linearRgb(color){
  const angle=color.h*Math.PI/180,a=color.c*Math.cos(angle),b=color.c*Math.sin(angle);
  const l=(color.l+.3963377774*a+.2158037573*b)**3;
  const m=(color.l-.1055613458*a-.0638541728*b)**3;
  const s=(color.l-.0894841775*a-1.291485548*b)**3;
  return [4.0767416621*l-3.3077115913*m+.2309699292*s,-1.2684380046*l+2.6097574011*m-.3413193965*s,-.0041960863*l-.7034186147*m+1.707614701*s];
 }
 function inGamut(color){return linearRgb(color).every(c=>c>=-1e-7&&c<=1.0000001);}
 function gamutMap(color){
  if(inGamut(color))return color;
  let low=0,high=color.c;
  for(let i=0;i<22;i++){const c=(low+high)/2;if(inGamut({...color,c}))low=c;else high=c;}
  return {...color,c:low};
 }
 function toRgb(color){
  return linearRgb(gamutMap(color)).map(c=>{
   c=Math.max(0,Math.min(1,c));return c<=.0031308?12.92*c:1.055*c**(1/2.4)-.055;
  });
 }
 function contrast(a,b){
  const luminance=color=>{const [r,g,b]=linearRgb(gamutMap(color));return .2126*r+.7152*g+.0722*b;};
  const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
 }
 const palettes=Object.fromEntries(Object.entries(phases).map(([key,colors])=>[key,colors.map(fromHex)]));
 function secondsInJakarta(date){
  const parts=Object.fromEntries(formatter.formatToParts(date).map(part=>[part.type,part.value]));
  return Number(parts.hour)*3600+Number(parts.minute)*60+Number(parts.second)+date.getUTCMilliseconds()/1000;
 }
 function schedule(date){
  const seconds=secondsInJakarta(date);
  for(const [hour,from,to] of [[5,'night','morning'],[10,'morning','day'],[15,'day','evening'],[18,'evening','night']]){
   const start=(hour-1)*3600,end=(hour+1)*3600;
   if(seconds>=start&&seconds<=end)return {from,to,amount:smoothstep((seconds-start)/(end-start))};
  }
  const phase=seconds<5*3600||seconds>=18*3600?'night':seconds<10*3600?'morning':seconds<15*3600?'day':'evening';
  return {from:phase,to:phase,amount:0};
 }
 function getTheme(date=new Date()){
  const state=schedule(date);
  const primary=palettes[state.from].map((color,i)=>interpolate(color,palettes[state.to][i],state.amount));
  // Derive readable surfaces from the current palette, never from a second phase.
  const tone=(source,l,cScale=1)=>gamutMap({l,c:source.c*cScale,h:source.h});
  const [first,middle,last]=primary;
  const tokens={
   'primary-0':first,'primary-1':middle,'primary-2':last,
   canvas:tone(first,Math.min(first.l,.19),.45),
   'canvas-end':tone(middle,Math.min(middle.l,.25),.5),
   'surface-0':tone(first,.17,.4),
   'surface-1':tone(middle,.22,.45),
   'surface-2':tone(middle,.28,.45),
   'surface-accent':tone(last,.3,.35),
   text:tone(last,.96,.12),
   muted:tone(last,.77,.12),
   subtle:tone(last,.69,.1),
   accent:tone(last,Math.max(.82,last.l),1),
   'accent-hover':tone(last,Math.max(.9,last.l),.6),
   'on-accent':tone(first,.16,.2),
   border:tone(middle,.48,.25),
   shadow:tone(first,.035,.1),
  };
  const css=color=>{const {l,c,h}=gamutMap(color);return `oklch(${(l*100).toFixed(6)}% ${c.toFixed(7)} ${h.toFixed(5)})`;};
  return {...state,primary,tokens,properties:Object.fromEntries(Object.entries(tokens).map(([name,color])=>[`--time-${name}`,css(color)]))};
 }
 function start(root){
  const doc=root.ownerDocument,win=doc.defaultView;
  // Root layouts persist across app navigation; avoid duplicate update loops.
  win.__laporkuyTimePalette?.();
  let frame=0,lastUpdate=-Infinity,previous={};
  const refresh=()=>{
   const theme=getTheme(new Date());
   for(const [name,value] of Object.entries(theme.properties))if(previous[name]!==value)root.style.setProperty(name,value);
   previous=theme.properties;
   root.dataset.timePalette=`${theme.from}:${theme.to}`;
  };
  const request=()=>{if(!frame&&!doc.hidden)frame=win.requestAnimationFrame(tick);};
  const tick=timestamp=>{frame=0;if(doc.hidden)return;if(timestamp-lastUpdate>=250){refresh();lastUpdate=timestamp;}request();};
  const resume=()=>{
   // Existing hover/header transitions must not animate from a stale palette
   // when a sleeping tab returns hours later.
   root.dataset.timeSync='true';refresh();root.getBoundingClientRect?.();delete root.dataset.timeSync;
   lastUpdate=-Infinity;request();
  };
  const visibility=()=>{if(doc.hidden){win.cancelAnimationFrame(frame);frame=0;}else resume();};
  refresh();request();
  doc.addEventListener('visibilitychange',visibility);win.addEventListener('focus',resume);win.addEventListener('pageshow',resume);
  const stop=()=>{win.cancelAnimationFrame(frame);doc.removeEventListener('visibilitychange',visibility);win.removeEventListener('focus',resume);win.removeEventListener('pageshow',resume);};
  win.__laporkuyTimePalette=stop;
  return stop;
 }
 return {phases,fromHex,interpolate,toRgb,contrast,smoothstep,secondsInJakarta,schedule,getTheme,start};
}

export const {phases,fromHex,interpolate,toRgb,contrast,smoothstep,secondsInJakarta,schedule,getTheme}=createTimePaletteRuntime();
export function timePaletteBootstrap(){return `(${createTimePaletteRuntime.toString()})().start(document.documentElement);`;}
