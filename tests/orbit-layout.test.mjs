import test from 'node:test';
import assert from 'node:assert/strict';
import {orbitLayout,orbitSlots} from '../lib/orbit-layout.mjs';

// Project the two vertical card edges like the browser's perspective matrix.
// This checks visible gaps rather than equal world-space centers/angles.
function projectedBounds(card,{width,perspective,depth,tilt}){
 const rotation=card.angle*Math.PI/180*tilt;
 const corners=[-width/2,width/2].map(u=>{
  const x=card.x+u*Math.cos(rotation),z=card.z*depth-u*Math.sin(rotation);
  return x/(1-z/perspective);
 });
 return {left:Math.min(...corners),right:Math.max(...corners)};
}

test('all visible neighbors retain the same projected gap throughout a rotation and on resize',()=>{
 for(const [width,perspective] of [[300,1400],[240,1400],[280.8,1000]]){
  const config={width,perspective,depth:width*1.65,tilt:.78,gap:12};
  for(let step=0;step<=480;step++){
   const phase=step*orbitSlots/480;
   const visible=orbitLayout(phase,config).filter(card=>card.opacity>.3).sort((a,b)=>a.logical-b.logical);
   for(let i=1;i<visible.length;i++){
    const previous=projectedBounds(visible[i-1],config),current=projectedBounds(visible[i],config);
    assert.ok(Math.abs(current.left-previous.right-config.gap)<1e-7,`Uneven gap at phase ${phase}, width ${width}`);
   }
  }
 }
});

test('visible positions and speed stay continuous when the central anchor changes',()=>{
 const epsilon=1e-5;
 for(const phase of [0,1,5,12,24]){
  const x=p=>orbitLayout(p).find(card=>card.logical===phase).x;
  const left=(x(phase)-x(phase-epsilon))/epsilon,right=(x(phase+epsilon)-x(phase))/epsilon;
  assert.ok(Math.abs(x(phase+epsilon)-x(phase-epsilon))<.01);
  assert.ok(Math.abs(left-right)<.01,`Speed changes at phase ${phase}`);
 }
 const first=orbitLayout(.37),next=orbitLayout(.37+orbitSlots);
 first.forEach((card,index)=>{
  assert.equal(next[index].logical,card.logical+orbitSlots);
  assert.ok(Math.abs(next[index].x-card.x)<1e-8);
 });
});
