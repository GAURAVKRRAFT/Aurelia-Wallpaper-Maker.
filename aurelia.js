(function(){
"use strict";

function mulberry32(a){
  return function(){
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function lerp(a,b,t){return a+(b-a)*t;}
function degToRad(d){return d*Math.PI/180;}

function makeNoise2D(rng){
  const perm = new Uint8Array(512);
  const p = new Uint8Array(256);
  for(let i=0;i<256;i++) p[i]=i;
  for(let i=255;i>0;i--){
    const j = Math.floor(rng()*(i+1));
    const tmp=p[i]; p[i]=p[j]; p[j]=tmp;
  }
  for(let i=0;i<512;i++) perm[i]=p[i&255];
  function fade(t){return t*t*t*(t*(t*6-15)+10);}
  function grad(hash,x,y){
    const h = hash & 3;
    const u = h<2 ? x : y;
    const v = h<2 ? y : x;
    return ((h&1)?-u:u) + ((h&2)?-v:v);
  }
  return function(x,y){
    const X = Math.floor(x)&255, Y=Math.floor(y)&255;
    x -= Math.floor(x); y -= Math.floor(y);
    const u = fade(x), v = fade(y);
    const aa = perm[X+perm[Y]], ab=perm[X+perm[Y+1]];
    const ba = perm[X+1+perm[Y]], bb=perm[X+1+perm[Y+1]];
    const x1 = lerp(grad(aa,x,y), grad(ba,x-1,y), u);
    const x2 = lerp(grad(ab,x,y-1), grad(bb,x-1,y-1), u);
    return (lerp(x1,x2,v)+1)/2;
  };
}
function fbm(noise2D, x,y,octaves){
  let val=0, amp=0.5, freq=1, max=0;
  for(let i=0;i<octaves;i++){
    val += noise2D(x*freq,y*freq)*amp;
    max += amp;
    amp*=0.5; freq*=2;
  }
  return val/max;
}
function hexToRgb(hex){
  hex = hex.replace('#','');
  if(hex.length===3) hex = hex.split('').map(c=>c+c).join('');
  const n = parseInt(hex,16);
  return {r:(n>>16)&255, g:(n>>8)&255, b:n&255};
}
function rgbToHex(r,g,b){
  return '#'+[r,g,b].map(v=>clamp(Math.round(v),0,255).toString(16).padStart(2,'0')).join('');
}
function rgbToHsl(r,g,b){
  r/=255;g/=255;b/=255;
  const max=Math.max(r,g,b), min=Math.min(r,g,b);
  let h,s,l=(max+min)/2;
  if(max===min){h=s=0;}
  else{
    const d=max-min;
    s = l>0.5 ? d/(2-max-min) : d/(max+min);
    switch(max){
      case r: h=(g-b)/d+(g<b?6:0); break;
      case g: h=(b-r)/d+2; break;
      default: h=(r-g)/d+4;
    }
    h/=6;
  }
  return {h:h*360,s:s*100,l:l*100};
}
function hslToRgb(h,s,l){
  h/=360; s/=100; l/=100;
  let r,g,b;
  if(s===0){r=g=b=l;}
  else{
    const hue2rgb=(p,q,t)=>{
      if(t<0)t+=1; if(t>1)t-=1;
      if(t<1/6) return p+(q-p)*6*t;
      if(t<1/2) return q;
      if(t<2/3) return p+(q-p)*(2/3-t)*6;
      return p;
    };
    const q = l<0.5 ? l*(1+s) : l+s-l*s;
    const p = 2*l-q;
    r=hue2rgb(p,q,h+1/3); g=hue2rgb(p,q,h); b=hue2rgb(p,q,h-1/3);
  }
  return {r:r*255,g:g*255,b:b*255};
}
function hexToHsl(hex){ const {r,g,b}=hexToRgb(hex); return rgbToHsl(r,g,b); }
function hslToHex(h,s,l){ const {r,g,b}=hslToRgb(h,s,l); return rgbToHex(r,g,b); }
function pick(rng, arr){ return arr[Math.floor(rng()*arr.length)]; }


const PALETTE_PRESETS = [
  {name:"Material", colors:["#6200EE","#03DAC6","#3700B3","#018786","#B00020"]},
  {name:"Pastel Dream", colors:["#FFD3E0","#C9E4DE","#FAE8E0","#C6DEF1","#DBCDF0"]},
  {name:"Monochrome", colors:["#101114","#3a3d44","#6a6f7a","#a3a8b3","#e8eaee"]},
  {name:"Neon Nights", colors:["#FF2E92","#00F0FF","#7B2FFF","#39FF14","#FFEA00"]},
  {name:"Earth Tones", colors:["#8B5E34","#C68B59","#D9C4A3","#5C4033","#7A8450"]},
  {name:"Cyberpunk", colors:["#F72585","#7209B7","#3A0CA3","#4361EE","#4CC9F0"]},
  {name:"Vaporwave", colors:["#FF71CE","#01CDFE","#05FFA1","#B967FF","#FFFB96"]},
  {name:"Scandinavian", colors:["#F5F1EA","#DCD3C0","#A9BCA6","#8C7B6B","#2E2A25"]},
  {name:"Bauhaus", colors:["#E63946","#F1C40F","#264653","#2A9D8F","#F4A261"]},
  {name:"Japanese Ink", colors:["#1B1B1B","#B7472A","#DCD6C9","#4A5A4A","#C9A063"]},
  {name:"Sunset", colors:["#FF6B6B","#FFA36C","#FFD56B","#845EC2","#2C2C54"]},
  {name:"Ocean", colors:["#03045E","#0077B6","#00B4D8","#90E0EF","#CAF0F8"]},
];

const RANDOM_PALETTE_MODES = ["analogous","complementary","triadic","monochrome","split"];
function generateRandomPalette(rng, mode){
  mode = mode || pick(rng, RANDOM_PALETTE_MODES);
  const baseH = rng()*360;
  const s = 55+rng()*35;
  const l = 45+rng()*20;
  const colors = [];
  const count = 4+Math.floor(rng()*2);
  for(let i=0;i<count;i++){
    let h=baseH, sat=s, li=l;
    if(mode==="analogous") h = baseH + (i-count/2)*22;
    else if(mode==="complementary") h = (i%2===0) ? baseH : baseH+180;
    else if(mode==="triadic") h = baseH + (i%3)*120;
    else if(mode==="monochrome"){ h = baseH; li = 20+i*(60/count); }
    else if(mode==="split"){ h = baseH + (i%3===0?0:(i%3===1?150:210)); }
    colors.push(hslToHex(((h%360)+360)%360, clamp(sat,20,90), clamp(li,15,85)));
  }
  return colors;
}
function complementaryOf(colors){
  return colors.map(c=>{
    const hsl = hexToHsl(c);
    return hslToHex((hsl.h+180)%360, hsl.s, hsl.l);
  });
}


const CATEGORIES = [
  {id:"geometric", name:"Geometric"},
  {id:"abstract", name:"Abstract Shapes"},
  {id:"minimalist", name:"Minimalist"},
  {id:"mountains", name:"Mountain Landscape"},
  {id:"scribble", name:"Scribble Art"},
  {id:"wavy", name:"Wavy Lines"},
  {id:"blobs", name:"Fluid Blobs"},
  {id:"polygon", name:"Polygon Art"},
  {id:"isometric", name:"Isometric"},
  {id:"dots", name:"Dots & Circles"},
  {id:"hexgrid", name:"Hexagonal Grid"},
  {id:"trimesh", name:"Triangular Mesh"},
  {id:"concentric", name:"Concentric Circles"},
  {id:"noise", name:"Noise Texture"},
  {id:"gradientmesh", name:"Gradient Mesh"},
  {id:"lowpoly", name:"Low-Poly"},
  {id:"brushstrokes", name:"Organic Brush"},
  {id:"japanese", name:"Japanese Minimal"},
  {id:"scandi", name:"Scandinavian"},
  {id:"vaporwave", name:"Retro Vaporwave"},
  {id:"bauhaus", name:"Bauhaus"},
  {id:"random", name:"Random Composition"},
];


const NOISE_USING_CATEGORIES = new Set([
  "mountains","wavy","blobs","trimesh","lowpoly","noise","random"
]);


const DEVICE_PRESETS = [
  {name:"Android Phone (FHD+)", w:1080, h:2340},
  {name:"iPhone 15 Pro", w:1179, h:2556},
  {name:"iPhone SE", w:750, h:1334},
  {name:"Tablet (Android)", w:1600, h:2560},
  {name:"iPad Pro 12.9\"", w:2048, h:2732},
  {name:"iPad Air", w:1640, h:2360},
  {name:"Small Laptop (HD)", w:1366, h:768},
  {name:"Standard Laptop (FHD)", w:1920, h:1080},
  {name:"MacBook Pro 14\"", w:3024, h:1964},
  {name:"MacBook Air 13\"", w:2560, h:1664},
  {name:"Ultrawide Monitor", w:3440, h:1440},
  {name:"Desktop Monitor (FHD)", w:1920, h:1080},
  {name:"Desktop Monitor (QHD)", w:2560, h:1440},
  {name:"4K Monitor (UHD)", w:3840, h:2160},
  {name:"5K Display", w:5120, h:2880},
  {name:"8K Display", w:7680, h:4320},
  {name:"Dual Monitor (2× FHD)", w:3840, h:1080},
  {name:"Triple Monitor (3× FHD)", w:5760, h:1080},
];
const RESOLUTION_PRESETS = [
  {name:"720×1280", w:720, h:1280},
  {name:"1080×1920", w:1080, h:1920},
  {name:"1440×2560", w:1440, h:2560},
  {name:"2160×3840", w:2160, h:3840},
  {name:"1366×768", w:1366, h:768},
  {name:"1920×1080", w:1920, h:1080},
  {name:"2560×1440", w:2560, h:1440},
  {name:"3440×1440", w:3440, h:1440},
  {name:"3840×2160", w:3840, h:2160},
  {name:"5120×2880", w:5120, h:2880},
  {name:"7680×4320", w:7680, h:4320},
];
const ASPECT_RATIOS = [
  {name:"16:9", r:16/9}, {name:"16:10", r:16/10}, {name:"21:9", r:21/9},
  {name:"32:9", r:32/9}, {name:"4:3", r:4/3}, {name:"3:2", r:3/2},
  {name:"1:1", r:1}, {name:"9:16", r:9/16}, {name:"18:9", r:18/9},
  {name:"19.5:9", r:19.5/9},
];


function defaultState(){
  return {
    category:"geometric",
    palette:["#7c9cff","#c792ea","#ff9d6c","#69db8f","#ff6b6b"],
    lockedColors:false,
    bgMode:"dark",
    bgCustom:"#0b0d12",
    shapeCount:60,
    shapeSize:90,
    rotation:0,
    scale:100,
    density:50,
    opacity:85,
    layerCount:3,
    strokeWidth:2,
    fillStyle:"fill",
    symmetry:1,
    repetition:false,
    gridSpacing:120,
    noiseIntensity:30,
    blurAmount:0,
    shadowIntensity:20,
    glowIntensity:0,
    grainAmount:10,
    seed:12345,
    // mountains
    mLayers:4,
    peakHeight:55,
    timePreset:"sunset",
    sunMoon:"sun",
    snowCaps:true,
    fog:true,
    stars:false,
    clouds:true,
    skyGradient:true,
    reflection:false,
    atmospheric:true,
    // scribble
    scribbleStyle:"ink",
    doodleCount:18,
    scribbleRandomness:40,
    handDrawn:true,
    // canvas
    width:1920,
    height:1080,
    hdpi:false,
  };
}
let state = defaultState();
let history = [JSON.stringify(state)];
let historyIndex = 0;
let isApplyingHistory = false;

function pushHistory(label){
  if(isApplyingHistory) return;
  history = history.slice(0, historyIndex+1);
  history.push(JSON.stringify(state));
  if(history.length>60) history.shift();
  historyIndex = history.length-1;
  renderHistoryPanel(label);
}
function applyHistoryIndex(i){
  if(i<0||i>=history.length) return;
  isApplyingHistory = true;
  state = JSON.parse(history[i]);
  historyIndex = i;
  syncUIFromState();
  scheduleRender();
  isApplyingHistory = false;
}
function undo(){ if(historyIndex>0) applyHistoryIndex(historyIndex-1); updateUndoRedoButtons(); }
function redo(){ if(historyIndex<history.length-1) applyHistoryIndex(historyIndex+1); updateUndoRedoButtons(); }
function updateUndoRedoButtons(){
  document.getElementById('undoBtn').disabled = historyIndex<=0;
  document.getElementById('redoBtn').disabled = historyIndex>=history.length-1;
}

let savedPresets = [];


const workCanvas = document.createElement('canvas');
const workCtx = workCanvas.getContext('2d');
const previewCanvas = document.getElementById('previewCanvas');
const previewCtx = previewCanvas.getContext('2d');
let lastRenderedDataURL = null;
let compareMode = false;
let compareSnapshot = null;

function resolveBackground(rng){
  if(state.bgMode==="light") return "#f4f1ea";
  if(state.bgMode==="amoled") return "#000000";
  if(state.bgMode==="custom") return state.bgCustom;
  return "#0e1016";
}

function applySymmetryDraw(ctx, w, h, count, drawFn){
  const sym = state.symmetry;
  if(sym<=1){ for(let i=0;i<count;i++) drawFn(i); return; }
  const cx=w/2, cy=h/2;
  for(let i=0;i<count;i++){
    for(let s=0;s<sym;s++){
      ctx.save();
      ctx.translate(cx,cy);
      ctx.rotate((Math.PI*2/sym)*s);
      ctx.translate(-cx,-cy);
      drawFn(i);
      ctx.restore();
    }
  }
}

function withGridRepetition(w,h,drawOnce){
  if(!state.repetition){ drawOnce(0,0,w,h); return; }
  const spacing = state.gridSpacing;
  const cols = Math.ceil(w/spacing);
  const rows = Math.ceil(h/spacing);
  for(let gy=0; gy<rows; gy++){
    for(let gx=0; gx<cols; gx++){
      drawOnce(gx*spacing, gy*spacing, spacing, spacing);
    }
  }
}

function polygonPath(ctx, cx, cy, radius, sides, rotation){
  ctx.beginPath();
  for(let i=0;i<=sides;i++){
    const a = rotation + (Math.PI*2*i/sides);
    const x = cx+Math.cos(a)*radius, y=cy+Math.sin(a)*radius;
    if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  }
  ctx.closePath();
}
function finishShape(ctx, colorHex, opacity, strokeColorHex){
  const style = state.fillStyle;
  if(style==="fill" || style==="both"){
    ctx.globalAlpha = opacity;
    ctx.fillStyle = colorHex;
    ctx.fill();
  }
  if(style==="stroke" || style==="both"){
    ctx.globalAlpha = Math.min(1, opacity+0.15);
    ctx.strokeStyle = strokeColorHex || colorHex;
    ctx.lineWidth = state.strokeWidth || 1;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
function applyShadowGlow(ctx, colorHex){
  ctx.shadowBlur = 0; ctx.shadowColor='transparent';
  if(state.shadowIntensity>0){
    ctx.shadowColor = `rgba(0,0,0,${state.shadowIntensity/140})`;
    ctx.shadowBlur = state.shadowIntensity/2.2;
    ctx.shadowOffsetY = state.shadowIntensity/12;
  }
  if(state.glowIntensity>0){
    ctx.shadowColor = colorHex;
    ctx.shadowBlur = state.glowIntensity/1.4;
  }
}

const Generators = {};

Generators.geometric = function(ctx,w,h,rng,noise2D){
  const shapes = ["rect","circle","triangle","polygon"];
  applySymmetryDraw(ctx,w,h,state.shapeCount,(i)=>{
    const cx = rng()*w, cy = rng()*h;
    const size = (state.shapeSize*(0.3+rng()*0.9)) * (state.scale/100);
    const rot = degToRad(state.rotation) + rng()*Math.PI*2*(state.density/100);
    const color = pick(rng, state.palette);
    applyShadowGlow(ctx,color);
    ctx.save(); ctx.translate(cx,cy); ctx.rotate(rot);
    const shape = pick(rng, shapes);
    if(shape==="rect"){ ctx.beginPath(); ctx.rect(-size/2,-size/2,size,size); }
    else if(shape==="circle"){ ctx.beginPath(); ctx.arc(0,0,size/2,0,Math.PI*2); }
    else if(shape==="triangle"){ polygonPath(ctx,0,0,size/2,3,0); }
    else { polygonPath(ctx,0,0,size/2, 5+Math.floor(rng()*3), 0); }
    finishShape(ctx,color, state.opacity/100);
    ctx.restore();
  });
};

Generators.abstract = function(ctx,w,h,rng){
  const n = Math.max(6, Math.floor(state.shapeCount/3));
  for(let i=0;i<n;i++){
    const color = pick(rng, state.palette);
    applyShadowGlow(ctx,color);
    ctx.save();
    ctx.globalAlpha = state.opacity/100;
    ctx.fillStyle = color;
    ctx.beginPath();
    const cx=rng()*w, cy=rng()*h;
    const r = state.shapeSize*(0.6+rng())*(state.scale/100);
    const pts = 6+Math.floor(rng()*5);
    for(let p=0;p<=pts;p++){
      const a = (Math.PI*2*p/pts);
      const rr = r*(0.5+rng()*0.9);
      const x = cx+Math.cos(a)*rr, y = cy+Math.sin(a)*rr*0.8;
      if(p===0) ctx.moveTo(x,y); else ctx.quadraticCurveTo(cx+Math.cos(a-0.3)*rr*1.1, cy+Math.sin(a-0.3)*rr*0.9, x,y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha=1;
    ctx.restore();
  }
};

Generators.minimalist = function(ctx,w,h,rng){
  const n = clamp(Math.floor(state.shapeCount/12),1,14);
  ctx.lineWidth = Math.max(1,state.strokeWidth);
  for(let i=0;i<n;i++){
    const color = pick(rng, state.palette);
    applyShadowGlow(ctx,color);
    const type = pick(rng, ["line","circle","dot"]);
    ctx.globalAlpha = state.opacity/100;
    if(type==="line"){
      ctx.strokeStyle=color;
      const y = h*(0.15+rng()*0.7);
      ctx.beginPath(); ctx.moveTo(w*0.1, y); ctx.lineTo(w*0.9,y); ctx.stroke();
    } else if(type==="circle"){
      ctx.strokeStyle=color;
      const r = state.shapeSize*(0.5+rng())*(state.scale/100);
      ctx.beginPath(); ctx.arc(w*(0.2+rng()*0.6), h*(0.2+rng()*0.6), r, 0, Math.PI*2); ctx.stroke();
    } else {
      ctx.fillStyle=color;
      ctx.beginPath(); ctx.arc(w*rng(), h*rng(), 4+rng()*10, 0, Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha=1;
  }
};

Generators.mountains = function(ctx,w,h,rng,noise2D){
  const preset = state.timePreset;
  const skies = {
    day:["#8ec5ff","#e8f4ff"], sunset:["#2b1055","#ff7e5f"], sunrise:["#ffd9a0","#8ecdf0"], night:["#02040a","#141b34"]
  };
  const sky = skies[preset]||skies.day;
  if(state.skyGradient){
    const g = ctx.createLinearGradient(0,0,0,h*0.75);
    g.addColorStop(0, sky[0]); g.addColorStop(1, sky[1]);
    ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
  } else {
    ctx.fillStyle = sky[0]; ctx.fillRect(0,0,w,h);
  }
  if(state.stars || preset==="night"){
    ctx.fillStyle="#ffffff";
    for(let i=0;i<220;i++){
      const x=rng()*w, y=rng()*h*0.55;
      const r = rng()*1.6;
      ctx.globalAlpha = 0.3+rng()*0.7;
      ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha=1;
  }
  if(state.sunMoon!=="none"){
    const sx = w*(0.68+ (rng()-0.5)*0.05), sy = h*0.28;
    const rad = Math.min(w,h)*0.075;
    if(state.sunMoon==="sun"){
      const g = ctx.createRadialGradient(sx,sy,0,sx,sy,rad*2.4);
      g.addColorStop(0,"#fff6d8"); g.addColorStop(0.4,"#ffcf7a"); g.addColorStop(1,"rgba(255,190,110,0)");
      ctx.fillStyle=g; ctx.beginPath(); ctx.arc(sx,sy,rad*2.4,0,Math.PI*2); ctx.fill();
      ctx.fillStyle="#fff2c9"; ctx.beginPath(); ctx.arc(sx,sy,rad,0,Math.PI*2); ctx.fill();
    } else {
      ctx.fillStyle="#eef1f8"; ctx.beginPath(); ctx.arc(sx,sy,rad*0.8,0,Math.PI*2); ctx.fill();
      ctx.fillStyle= sky[1]; ctx.beginPath(); ctx.arc(sx-rad*0.28,sy-rad*0.12,rad*0.72,0,Math.PI*2); ctx.fill();
    }
  }
  if(state.clouds){
    for(let i=0;i<7;i++){
      const cx=rng()*w, cy=h*(0.12+rng()*0.28);
      ctx.globalAlpha=0.35+rng()*0.25;
      ctx.fillStyle="#ffffff";
      for(let k=0;k<5;k++){
        const ox=(k-2)*28*(state.scale/100), oy=Math.sin(k)*8;
        ctx.beginPath(); ctx.ellipse(cx+ox,cy+oy, 40+rng()*30, 16+rng()*10, 0,0,Math.PI*2); ctx.fill();
      }
    }
    ctx.globalAlpha=1;
  }
  const layers = state.mLayers;
  const horizon = h * (state.reflection ? 0.62 : 0.82);
  for(let L=0; L<layers; L++){
    const depth = L/(layers-1||1);
    const peakY = horizon - (h*(state.peakHeight/100)) * (1-depth*0.55);
    const baseColor = state.palette[L % state.palette.length];
    let color = baseColor;
    if(state.atmospheric){
      const hsl = hexToHsl(baseColor);
      color = hslToHex(hsl.h, hsl.s*(0.4+depth*0.4), clamp(hsl.l + (1-depth)*22, 5, 92));
    }
    ctx.beginPath();
    ctx.moveTo(0, horizon);
    const segs = 24;
    const freq = 1.5+L*0.6;
    for(let i=0;i<=segs;i++){
      const x = (i/segs)*w;
      const nz = fbm(noise2D, (x/w)*freq + L*10 + state.seed*0.0001, L*3.3, 4);
      const y = peakY + (1-nz)*h*0.18*(1-depth*0.4);
      ctx.lineTo(x,y);
    }
    ctx.lineTo(w,horizon); ctx.closePath();
    ctx.fillStyle=color; ctx.fill();
    if(state.snowCaps && L<Math.ceil(layers/2)){
      ctx.beginPath();
      for(let i=0;i<=segs;i++){
        const x=(i/segs)*w;
        const nz = fbm(noise2D, (x/w)*freq + L*10 + state.seed*0.0001, L*3.3, 4);
        const y = peakY + (1-nz)*h*0.18*(1-depth*0.4);
        const snowY = y + h*0.025;
        if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
        if(i===segs){
          for(let j=segs;j>=0;j--){
            const xx=(j/segs)*w;
            const nzz = fbm(noise2D, (xx/w)*freq + L*10 + state.seed*0.0001, L*3.3, 4);
            const yy = peakY + (1-nzz)*h*0.18*(1-depth*0.4);
            ctx.lineTo(xx, Math.min(yy+h*0.02, yy + (nzz>0.55? h*0.03: -h*0.05)));
          }
        }
      }
      ctx.closePath();
      ctx.globalAlpha=0.85;
      ctx.fillStyle="rgba(255,255,255,0.9)";
      ctx.fill();
      ctx.globalAlpha=1;
    }
  }
  if(state.reflection){
    
    ctx.save();
    ctx.translate(0, horizon*2);
    ctx.scale(1,-1);
    ctx.globalAlpha=0.25;
    ctx.drawImage(ctx.canvas, 0, 0, w, horizon, 0, 0, w, horizon);
    ctx.restore();
    const g = ctx.createLinearGradient(0,horizon,0,h);
    g.addColorStop(0, "rgba(10,14,26,0.1)"); g.addColorStop(1,"rgba(10,14,26,0.75)");
    ctx.fillStyle=g; ctx.fillRect(0,horizon,w,h-horizon);
  }
  if(state.fog){
    const g = ctx.createLinearGradient(0,horizon-h*0.15,0,horizon+h*0.05);
    g.addColorStop(0,"rgba(255,255,255,0)");
    g.addColorStop(1,`rgba(255,255,255,${0.35})`);
    ctx.fillStyle=g;
    ctx.fillRect(0,horizon-h*0.15,w,h*0.2);
  }
};

Generators.scribble = function(ctx,w,h,rng){
  const styleMap = {
    pencil:{alpha:0.55, width:1.2, jitter:2.2},
    ink:{alpha:0.95, width:2.4, jitter:1},
    marker:{alpha:0.8, width:9, jitter:1.4},
    chalk:{alpha:0.6, width:6, jitter:5},
    brush:{alpha:0.85, width:14, jitter:3},
  };
  const s = styleMap[state.scribbleStyle]||styleMap.ink;
  const randomness = state.scribbleRandomness/100;
  for(let i=0;i<state.doodleCount;i++){
    const color = pick(rng, state.palette);
    ctx.strokeStyle = color;
    ctx.lineWidth = s.width * (0.6+rng()*0.8) * (state.strokeWidth>0? state.strokeWidth/3 : 1);
    ctx.globalAlpha = s.alpha*(state.opacity/100);
    ctx.lineJoin='round'; ctx.lineCap='round';
    const cx = rng()*w, cy = rng()*h;
    const scribbleSize = state.shapeSize*(0.7+rng()*1.4)*(state.scale/100);
    ctx.beginPath();
    let x=cx,y=cy;
    ctx.moveTo(x,y);
    const strokes = 4+Math.floor(rng()*8);
    let angle = rng()*Math.PI*2;
    for(let k=0;k<strokes;k++){
      angle += (rng()-0.5)*Math.PI*0.9*randomness + (rng()-0.5)*0.3;
      const len = scribbleSize*(0.15+rng()*0.35);
      const midX = x + Math.cos(angle)*len*0.5 + (state.handDrawn?(rng()-0.5)*s.jitter*3:0);
      const midY = y + Math.sin(angle)*len*0.5 + (state.handDrawn?(rng()-0.5)*s.jitter*3:0);
      x += Math.cos(angle)*len; y += Math.sin(angle)*len;
      ctx.quadraticCurveTo(midX,midY,x,y);
    }
    ctx.stroke();
    ctx.globalAlpha=1;
  }
};

Generators.wavy = function(ctx,w,h,rng,noise2D){
  const lines = Math.max(4, Math.floor(state.shapeCount/6));
  ctx.lineWidth = Math.max(0.6,state.strokeWidth);
  for(let i=0;i<lines;i++){
    const t = i/lines;
    const color = pick(rng, state.palette);
    ctx.strokeStyle = color;
    ctx.globalAlpha = state.opacity/100;
    applyShadowGlow(ctx,color);
    ctx.beginPath();
    const baseY = h*t;
    const amp = h*0.05*(state.shapeSize/90)*(state.scale/100);
    const freq = 2+ (state.density/100)*6;
    const segs = 80;
    for(let s=0;s<=segs;s++){
      const x = (s/segs)*w;
      const nz = fbm(noise2D, x/w*freq + i*0.6 + state.seed*0.0002, t*5, 3);
      const y = baseY + Math.sin(x/w*Math.PI*2*freq + t*10 + state.rotation*0.02) * amp * (0.4+nz*0.9) * (state.noiseIntensity/60+0.3);
      if(s===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha=1;
};

Generators.blobs = function(ctx,w,h,rng,noise2D){
  const n = clamp(Math.floor(state.shapeCount/8),2,30);
  for(let i=0;i<n;i++){
    const color = pick(rng, state.palette);
    applyShadowGlow(ctx,color);
    ctx.globalAlpha = state.opacity/100;
    if(state.blurAmount>0) ctx.filter = `blur(${state.blurAmount*0.4}px)`;
    ctx.fillStyle = color;
    const cx = rng()*w, cy = rng()*h;
    const r = state.shapeSize*(0.8+rng()*1.6)*(state.scale/100);
    const pts=16;
    ctx.beginPath();
    for(let p=0;p<=pts;p++){
      const a = (Math.PI*2*p/pts);
      const nz = fbm(noise2D, Math.cos(a)*2+i*10+state.seed*0.0003, Math.sin(a)*2+i*10, 3);
      const rr = r*(0.65+nz*0.75);
      const x = cx+Math.cos(a)*rr, y=cy+Math.sin(a)*rr;
      if(p===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.filter='none';
  }
  ctx.globalAlpha=1;
};

Generators.polygon = function(ctx,w,h,rng){
  applySymmetryDraw(ctx,w,h,state.shapeCount,(i)=>{
    const cx=rng()*w, cy=rng()*h;
    const r = state.shapeSize*(0.5+rng())*(state.scale/100);
    const sides = 3+Math.floor(rng()*6);
    const rot = degToRad(state.rotation)+rng()*Math.PI;
    const color = pick(rng,state.palette);
    applyShadowGlow(ctx,color);
    polygonPath(ctx,cx,cy,r,sides,rot);
    finishShape(ctx,color,state.opacity/100);
  });
};

Generators.isometric = function(ctx,w,h,rng){
  const size = state.shapeSize*(state.scale/100)*0.5+20;
  const cols = Math.ceil(w/size)+2, rows = Math.ceil(h/(size*0.87))+2;
  for(let r=-1;r<rows;r++){
    for(let c=-1;c<cols;c++){
      if(rng()>state.density/100) continue;
      const x = c*size*0.87 + (r%2)*size*0.435;
      const y = r*size*0.75;
      const color = pick(rng,state.palette);
      const h2 = size*(0.3+rng()*0.9)*(state.shapeSize/90);
      applyShadowGlow(ctx,color);
      ctx.globalAlpha = state.opacity/100;
      const hsl = hexToHsl(color);
      // top
      ctx.fillStyle = hslToHex(hsl.h,hsl.s,clamp(hsl.l+10,0,95));
      ctx.beginPath();
      ctx.moveTo(x,y-h2); ctx.lineTo(x+size*0.43,y-h2+size*0.25); ctx.lineTo(x,y-h2+size*0.5); ctx.lineTo(x-size*0.43,y-h2+size*0.25); ctx.closePath(); ctx.fill();
      // left
      ctx.fillStyle = hslToHex(hsl.h,hsl.s,clamp(hsl.l-10,0,95));
      ctx.beginPath();
      ctx.moveTo(x-size*0.43,y-h2+size*0.25); ctx.lineTo(x,y-h2+size*0.5); ctx.lineTo(x,y+size*0.5); ctx.lineTo(x-size*0.43,y+size*0.25); ctx.closePath(); ctx.fill();
      // right
      ctx.fillStyle = hslToHex(hsl.h,hsl.s,clamp(hsl.l-22,0,95));
      ctx.beginPath();
      ctx.moveTo(x+size*0.43,y-h2+size*0.25); ctx.lineTo(x,y-h2+size*0.5); ctx.lineTo(x,y+size*0.5); ctx.lineTo(x+size*0.43,y+size*0.25); ctx.closePath(); ctx.fill();
      ctx.globalAlpha=1;
    }
  }
};

Generators.dots = function(ctx,w,h,rng){
  withGridRepetition(w,h,(ox,oy,gw,gh)=>{
    const count = state.repetition ? Math.max(1,Math.floor(state.shapeCount/40)) : state.shapeCount;
    for(let i=0;i<count;i++){
      const x = ox + rng()*gw, y = oy + rng()*gh;
      const r = (state.shapeSize/6)*(0.3+rng())*(state.scale/100);
      const color = pick(rng,state.palette);
      applyShadowGlow(ctx,color);
      ctx.beginPath(); ctx.arc(x,y,Math.max(0.6,r),0,Math.PI*2);
      finishShape(ctx,color,state.opacity/100);
    }
  });
};

Generators.hexgrid = function(ctx,w,h,rng){
  const hexSize = clamp(state.shapeSize*0.4*(state.scale/100), 10, 200);
  const hw = hexSize*Math.sqrt(3), hh = hexSize*1.5;
  const cols = Math.ceil(w/hw)+2, rows=Math.ceil(h/hh)+2;
  for(let r=-1;r<rows;r++){
    for(let c=-1;c<cols;c++){
      if(rng()>state.density/100) continue;
      const x = c*hw + (r%2)*hw/2;
      const y = r*hh;
      const color = pick(rng,state.palette);
      applyShadowGlow(ctx,color);
      polygonPath(ctx, x, y, hexSize*0.94, 6, degToRad(30+state.rotation));
      finishShape(ctx,color,state.opacity/100);
    }
  }
};

Generators.trimesh = function(ctx,w,h,rng,noise2D){
  const cell = clamp(state.shapeSize*1.2, 30, 400);
  const cols = Math.ceil(w/cell)+2, rows = Math.ceil(h/cell)+2;
  const pts = [];
  for(let r=0;r<=rows;r++){
    pts.push([]);
    for(let c=0;c<=cols;c++){
      const jitter = cell*0.35*(state.noiseIntensity/100+0.2);
      pts[r].push([c*cell + (rng()-0.5)*jitter, r*cell + (rng()-0.5)*jitter]);
    }
  }
  for(let r=0;r<rows;r++){
    for(let c=0;c<cols;c++){
      const p1=pts[r][c], p2=pts[r][c+1], p3=pts[r+1][c], p4=pts[r+1][c+1];
      [[p1,p2,p3],[p2,p4,p3]].forEach(tri=>{
        const color = pick(rng, state.palette);
        ctx.beginPath();
        ctx.moveTo(tri[0][0],tri[0][1]); ctx.lineTo(tri[1][0],tri[1][1]); ctx.lineTo(tri[2][0],tri[2][1]); ctx.closePath();
        finishShape(ctx,color,state.opacity/100);
      });
    }
  }
};
Generators.lowpoly = Generators.trimesh;

Generators.concentric = function(ctx,w,h,rng){
  const centers = clamp(Math.floor(state.shapeCount/20),1,10);
  for(let i=0;i<centers;i++){
    const cx = rng()*w, cy=rng()*h;
    const rings = 6+Math.floor(state.density/6);
    const maxR = state.shapeSize*2*(state.scale/100)+80;
    for(let r=rings;r>0;r--){
      const color = state.palette[r % state.palette.length];
      applyShadowGlow(ctx,color);
      ctx.beginPath();
      ctx.arc(cx,cy, maxR*(r/rings), 0, Math.PI*2);
      finishShape(ctx, color, (state.opacity/100)*(0.35+0.5*(r/rings)), color);
    }
  }
};

Generators.noise = function(ctx,w,h,rng,noise2D){
  const img = ctx.createImageData(w,h);
  const scale = clamp(0.002+ (100-state.density)/100*0.02, 0.002, 0.03);
  const c1 = hexToRgb(state.palette[0]);
  const c2 = hexToRgb(state.palette[state.palette.length-1]);
  const alpha255 = 255*(state.opacity/100);
  const data = img.data;
  for(let y=0;y<h;y+=2){
    for(let x=0;x<w;x+=2){
      const nz = fbm(noise2D, x*scale, y*scale, 5);
      const t = clamp(nz + (state.noiseIntensity-50)/200,0,1);
      const r = lerp(c1.r,c2.r,t), g=lerp(c1.g,c2.g,t), b=lerp(c1.b,c2.b,t);
      for(let dy=0;dy<2 && y+dy<h; dy++){
        for(let dx=0;dx<2 && x+dx<w; dx++){
          const idx=((y+dy)*w+(x+dx))*4;
          data[idx]=r; data[idx+1]=g; data[idx+2]=b; data[idx+3]=alpha255;
        }
      }
    }
  }
  ctx.putImageData(img,0,0);
};

Generators.gradientmesh = function(ctx,w,h,rng){
  const blobs = clamp(Math.floor(state.shapeCount/15),3,18);
  for(let i=0;i<blobs;i++){
    const color = pick(rng,state.palette);
    const cx = rng()*w, cy=rng()*h;
    const r = (state.shapeSize*3+200)*(state.scale/100);
    const g = ctx.createRadialGradient(cx,cy,0,cx,cy,r);
    g.addColorStop(0, withAlphaSafe(color, state.opacity/100));
    g.addColorStop(1, withAlphaSafe(color, 0));
    ctx.fillStyle=g;
    ctx.fillRect(0,0,w,h);
  }
};
function withAlphaSafe(hex,a){
  const {r,g,b}=hexToRgb(hex);
  return `rgba(${r},${g},${b},${clamp(a,0,1)})`;
}

Generators.brushstrokes = function(ctx,w,h,rng){
  const n = clamp(Math.floor(state.shapeCount/5),4,60);
  for(let i=0;i<n;i++){
    const color = pick(rng,state.palette);
    ctx.strokeStyle=color;
    ctx.lineCap='round'; ctx.lineJoin='round';
    ctx.lineWidth = (state.strokeWidth||6)*(1.5+rng()*2);
    ctx.globalAlpha = (state.opacity/100)*(0.5+rng()*0.5);
    applyShadowGlow(ctx,color);
    const x1=rng()*w,y1=rng()*h;
    const len = state.shapeSize*(1.5+rng()*2)*(state.scale/100);
    const angle = rng()*Math.PI*2;
    const x2 = x1+Math.cos(angle)*len, y2=y1+Math.sin(angle)*len;
    const midx = (x1+x2)/2 + (rng()-0.5)*len*0.4;
    const midy = (y1+y2)/2 + (rng()-0.5)*len*0.4;
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.quadraticCurveTo(midx,midy,x2,y2); ctx.stroke();
  }
  ctx.globalAlpha=1;
};

Generators.japanese = function(ctx,w,h,rng){
  const color = state.palette[0];
  ctx.strokeStyle=color; ctx.fillStyle=color;
  const circles = 1+Math.floor(rng()*2);
  for(let i=0;i<circles;i++){
    const cx = w*(0.25+rng()*0.5), cy=h*(0.3+rng()*0.4);
    const r = Math.min(w,h)*(0.14+rng()*0.1)*(state.scale/100);
    ctx.lineWidth = 4+rng()*10;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(cx,cy,r, rng()*0.6, Math.PI*1.8+rng()*0.5);
    ctx.stroke();
  }
  // branch
  ctx.globalAlpha=0.9;
  ctx.lineWidth=3;
  let x=w*0.15,y=h*0.85;
  ctx.beginPath(); ctx.moveTo(x,y);
  for(let i=0;i<7;i++){
    x += w*0.04+rng()*w*0.03;
    y -= h*0.05+rng()*h*0.04;
    ctx.lineTo(x,y);
  }
  ctx.stroke();
  const accent = state.palette[state.palette.length-1];
  for(let i=0;i<state.shapeCount/8;i++){
    ctx.fillStyle=accent;
    ctx.globalAlpha=0.75;
    ctx.beginPath();
    ctx.ellipse(w*0.1+rng()*w*0.5, h*0.2+rng()*h*0.6, 5+rng()*7, 3+rng()*4, rng()*Math.PI, 0, Math.PI*2);
    ctx.fill();
  }
  ctx.globalAlpha=1;
};

Generators.scandi = function(ctx,w,h,rng){
  const n = clamp(Math.floor(state.shapeCount/10),3,20);
  for(let i=0;i<n;i++){
    const color = pick(rng,state.palette);
    ctx.fillStyle=color;
    ctx.globalAlpha=state.opacity/100;
    const type = pick(rng,["circle","arc","triangle","stripe"]);
    const cx=rng()*w, cy=rng()*h, size=state.shapeSize*(0.6+rng())*(state.scale/100);
    if(type==="circle"){ ctx.beginPath(); ctx.arc(cx,cy,size/2,0,Math.PI*2); ctx.fill(); }
    else if(type==="arc"){ ctx.beginPath(); ctx.arc(cx,cy,size/2, 0, Math.PI); ctx.fill(); }
    else if(type==="triangle"){ polygonPath(ctx,cx,cy,size/2,3,degToRad(state.rotation)); ctx.fill(); }
    else { ctx.fillRect(cx-size/2, cy-size/10, size, size/5); }
  }
  ctx.globalAlpha=1;
};

Generators.vaporwave = function(ctx,w,h,rng){
  const g = ctx.createLinearGradient(0,0,0,h);
  g.addColorStop(0, state.palette[0]); g.addColorStop(1, state.palette[1]||state.palette[0]);
  ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
  const sunY = h*0.55, sunR = Math.min(w,h)*0.28*(state.scale/100);
  const sunColor = state.palette[2]||"#ffcf7a";
  ctx.fillStyle = sunColor;
  ctx.beginPath(); ctx.arc(w/2,sunY,sunR,0,Math.PI*2); ctx.fill();
  ctx.fillStyle = resolveBackground(rng);
  const stripes = 7;
  for(let i=0;i<stripes;i++){
    const yy = sunY - sunR*0.15*i;
    ctx.fillRect(w/2-sunR, yy, sunR*2, sunR*0.04);
  }
  // grid floor
  ctx.strokeStyle = state.palette[3]||"#00F0FF";
  ctx.lineWidth=2;
  const horizon = h*0.62;
  for(let i=-10;i<=10;i++){
    ctx.beginPath(); ctx.moveTo(w/2 + i*40, h); ctx.lineTo(w/2 + i*8, horizon); ctx.stroke();
  }
  for(let i=1;i<12;i++){
    const t=i/12;
    const yy = lerp(h,horizon, t*t);
    ctx.beginPath(); ctx.moveTo(0,yy); ctx.lineTo(w,yy); ctx.stroke();
  }
};

Generators.bauhaus = function(ctx,w,h,rng){
  const n = clamp(Math.floor(state.shapeCount/6),4,40);
  for(let i=0;i<n;i++){
    const color = pick(rng,state.palette);
    ctx.fillStyle=color;
    ctx.globalAlpha = state.opacity/100;
    const type = pick(rng,["circle","rect","triangle","quarter"]);
    const size = state.shapeSize*(0.6+rng()*1.2)*(state.scale/100);
    const x = rng()*w, y = rng()*h;
    if(type==="circle"){ ctx.beginPath(); ctx.arc(x,y,size/2,0,Math.PI*2); ctx.fill(); }
    else if(type==="rect"){ ctx.save(); ctx.translate(x,y); ctx.rotate(pick(rng,[0,Math.PI/2])); ctx.fillRect(-size/2,-size/4,size,size/2); ctx.restore(); }
    else if(type==="triangle"){ polygonPath(ctx,x,y,size/2,3, pick(rng,[0,Math.PI/2,Math.PI])); ctx.fill(); }
    else { ctx.beginPath(); ctx.moveTo(x,y); ctx.arc(x,y,size/2, 0, Math.PI/2); ctx.closePath(); ctx.fill(); }
  }
  ctx.globalAlpha=1;
};

Generators.random = function(ctx,w,h,rng,noise2D){
  const keys = Object.keys(Generators).filter(k=>k!=="random");
  const fn = Generators[pick(rng,keys)];
  fn(ctx,w,h,rng,noise2D);
  const fn2 = Generators[pick(rng,keys)];
  ctx.globalAlpha=0.55;
  fn2(ctx,w,h,rng,noise2D);
  ctx.globalAlpha=1;
};

function applyGrain(ctx,w,h,amount,rng){
  if(amount<=0) return;
  const img = ctx.getImageData(0,0,w,h);
  const d = img.data;
  const strength = amount*0.9;
  for(let i=0;i<d.length;i+=4){
    if(rng()<0.6){
      const n = (rng()-0.5)*strength;
      d[i]=clamp(d[i]+n,0,255);
      d[i+1]=clamp(d[i+1]+n,0,255);
      d[i+2]=clamp(d[i+2]+n,0,255);
    }
  }
  ctx.putImageData(img,0,0);
}

function renderToContext(ctx, w, h){
  const rng = mulberry32(state.seed>>>0);
  
  const needsNoise = NOISE_USING_CATEGORIES.has(state.category);
  const noise2D = needsNoise ? makeNoise2D(mulberry32((state.seed*7+13)>>>0)) : null;
  ctx.clearRect(0,0,w,h);
  ctx.save();
  const bg = resolveBackground(rng);
  ctx.fillStyle = bg;
  ctx.fillRect(0,0,w,h);

  if(state.blurAmount>0 && state.category!=="blobs"){
    ctx.filter = `blur(${state.blurAmount}px)`;
  }

  const layers = Math.max(1, state.layerCount);
  const gen = Generators[state.category] || Generators.geometric;
  const singleLayerCategory = state.category==="mountains" || state.category==="vaporwave" || state.category==="noise" || state.category==="gradientmesh";
  const layerCountToRun = singleLayerCategory ? 1 : layers;
  for(let L=0; L<layerCountToRun; L++){
    ctx.save();
    if(layers>1 && !singleLayerCategory){
      ctx.globalAlpha = 1 - (L*0.12);
    }
    const layerRng = mulberry32((state.seed + L*7919)>>>0);
    const layerNoise = needsNoise ? makeNoise2D(mulberry32((state.seed*7+13+L*101)>>>0)) : null;
    gen(ctx,w,h,layerRng,layerNoise);
    ctx.restore();
  }
  ctx.filter='none';
  ctx.restore();

  if(state.grainAmount>0){
    applyGrain(ctx,w,h,state.grainAmount, mulberry32((state.seed*3+1)>>>0));
  }
}

let renderScheduled = false;
function scheduleRender(){
  if(renderScheduled) return;
  renderScheduled = true;
  requestAnimationFrame(()=>{
    renderScheduled = false;
    doRender();
  });
}
let lastRenderW = null, lastRenderH = null;
function doRender(){
  document.getElementById('loadingBadge').classList.add('show');
  setTimeout(()=>{
    const w = state.width, h = state.height;
    previewCanvas.width = w;
    previewCanvas.height = h;
    renderToContext(previewCtx, w, h);
    document.getElementById('dimReadout').textContent = `${w} × ${h}`;
    document.getElementById('loadingBadge').classList.remove('show');
   
    if(w !== lastRenderW || h !== lastRenderH){
      lastRenderW = w; lastRenderH = h;
      fitToScreen(false);
    }
    lastRenderedDataURL = null;
  }, 10);
}


const $ = (id)=>document.getElementById(id);

function buildCategoryGrid(){
  const grid = $('categoryGrid');
  grid.innerHTML='';
  CATEGORIES.forEach((c,idx)=>{
    const el = document.createElement('div');
    el.className='category-card'+(state.category===c.id?' active':'');
    el.dataset.id = c.id;
    el.innerHTML = `<span class="cname">${c.name}</span><span class="cnum">${String(idx+1).padStart(2,'0')}</span>`;
    el.addEventListener('click', ()=>{
      state.category = c.id;
      document.querySelectorAll('.category-card').forEach(x=>x.classList.remove('active'));
      el.classList.add('active');
      $('categoryTag').textContent = c.name;
      toggleContextualSections();
      pushHistory('category');
      scheduleRender();
    });
    grid.appendChild(el);
  });
}

function toggleContextualSections(){
  $('mountainSection').style.display = state.category==='mountains' ? '' : 'none';
  $('scribbleSection').style.display = state.category==='scribble' ? '' : 'none';
}

function buildPaletteGrid(){
  const grid = $('paletteGrid');
  grid.innerHTML='';
  PALETTE_PRESETS.forEach(p=>{
    const el = document.createElement('div');
    el.className='preset-palette';
    el.innerHTML = `<div class="swatches">${p.colors.map(c=>`<i style="background:${c}"></i>`).join('')}</div><div class="pname">${p.name}</div>`;
    el.addEventListener('click', ()=>{
      if(!state.lockedColors){
        state.palette = p.colors.slice();
        renderPaletteSwatches();
        pushHistory('palette');
        scheduleRender();
      }
    });
    grid.appendChild(el);
  });
}

function renderPaletteSwatches(){
  const wrap = $('paletteSwatches');
  wrap.innerHTML='';
  state.palette.forEach((c,i)=>{
    const sw = document.createElement('div');
    sw.className='swatch-wrap';
    sw.innerHTML = `<span class="swatch" style="background:${c}"><input type="color" value="${c}"></span>${state.palette.length>2?'<div class="swatch-remove">×</div>':''}`;
    const input = sw.querySelector('input');
    input.addEventListener('input', (e)=>{
      state.palette[i] = e.target.value;
      sw.querySelector('.swatch').style.background = e.target.value;
      scheduleRender();
    });
    input.addEventListener('change', ()=>pushHistory('color'));
    const rm = sw.querySelector('.swatch-remove');
    if(rm){
      rm.addEventListener('click',(e)=>{
        e.stopPropagation();
        state.palette.splice(i,1);
        renderPaletteSwatches();
        pushHistory('palette');
        scheduleRender();
      });
    }
    wrap.appendChild(sw);
  });
  const add = document.createElement('div');
  add.className='add-swatch';
  add.textContent='+';
  add.addEventListener('click', ()=>{
    const rng = mulberry32(Date.now()>>>0);
    state.palette.push(hslToHex(rng()*360,60,55));
    renderPaletteSwatches();
    pushHistory('palette');
    scheduleRender();
  });
  wrap.appendChild(add);
  $('paletteCount').textContent = state.palette.length+' colors';
}

function buildDevicePresets(){
  const sel = $('devicePreset');
  sel.innerHTML = '<option value="">Custom…</option>' + DEVICE_PRESETS.map((d,i)=>`<option value="${i}">${d.name} — ${d.w}×${d.h}</option>`).join('');
  sel.addEventListener('change', ()=>{
    if(sel.value===''){ return; }
    const d = DEVICE_PRESETS[+sel.value];
    state.width=d.w; state.height=d.h;
    $('customWidth').value=d.w; $('customHeight').value=d.h;
    pushHistory('device');
    scheduleRender();
  });
}
function buildAspectChips(){
  const wrap = $('aspectChips');
  wrap.innerHTML = ASPECT_RATIOS.map(a=>`<div class="chip" data-r="${a.r}">${a.name}</div>`).join('');
  wrap.querySelectorAll('.chip').forEach(chip=>{
    chip.addEventListener('click', ()=>{
      wrap.querySelectorAll('.chip').forEach(c=>c.classList.remove('active'));
      chip.classList.add('active');
      const r = parseFloat(chip.dataset.r);
      const base = Math.max(state.width, state.height, 1080);
      let w,h;
      if(r>=1){ w=base; h=Math.round(base/r); } else { h=base; w=Math.round(base*r); }
      state.width=w; state.height=h;
      $('customWidth').value=w; $('customHeight').value=h;
      pushHistory('aspect');
      scheduleRender();
    });
  });
}

function buildChipGroup(containerId, stateKey, castFn){
  const wrap = $(containerId);
  wrap.querySelectorAll('.chip').forEach(chip=>{
    chip.addEventListener('click', ()=>{
      wrap.querySelectorAll('.chip').forEach(c=>c.classList.remove('active'));
      chip.classList.add('active');
      state[stateKey] = castFn ? castFn(chip.dataset.v) : chip.dataset.v;
      pushHistory(stateKey);
      scheduleRender();
    });
  });
}
function syncChipGroup(containerId, value){
  document.querySelectorAll('#'+containerId+' .chip').forEach(c=>{
    c.classList.toggle('active', c.dataset.v == value);
  });
}

function buildToggle(id, stateKey){
  const el = $(id);
  el.addEventListener('click', ()=>{
    state[stateKey] = !state[stateKey];
    el.classList.toggle('on', state[stateKey]);
    pushHistory(stateKey);
    scheduleRender();
  });
}
function syncToggle(id, value){ $(id).classList.toggle('on', !!value); }

const SLIDER_IDS = ["shapeCount","shapeSize","rotation","scale","density","opacity","layerCount","strokeWidth",
  "gridSpacing","noiseIntensity","blurAmount","shadowIntensity","glowIntensity","grainAmount","seed",
  "mLayers","peakHeight","doodleCount","scribbleRandomness"];

function bindSliders(){
  SLIDER_IDS.forEach(id=>{
    const el = $(id);
    if(!el) return;
    el.addEventListener('input', ()=>{
      const v = parseFloat(el.value);
      state[id] = v;
      $('v_'+id).textContent = formatSliderVal(id,v);
      scheduleRender();
    });
    el.addEventListener('change', ()=>pushHistory(id));
  });
}
function formatSliderVal(id,v){
  if(id==="opacity"||id==="density"||id==="noiseIntensity"||id==="shadowIntensity"||id==="glowIntensity"||id==="grainAmount"||id==="scribbleRandomness") return v+'%';
  if(id==="rotation") return v+'°';
  if(id==="peakHeight") return v+'%';
  if(id==="scale") return v+'%';
  return v;
}
function syncSliders(){
  SLIDER_IDS.forEach(id=>{
    const el = $(id);
    if(!el) return;
    el.value = state[id];
    $('v_'+id).textContent = formatSliderVal(id,state[id]);
  });
}

function syncUIFromState(){
  syncSliders();
  renderPaletteSwatches();
  document.querySelectorAll('.category-card').forEach(c=>c.classList.toggle('active', c.dataset.id===state.category));
  $('categoryTag').textContent = (CATEGORIES.find(c=>c.id===state.category)||{}).name || '';
  $('bgMode').value = state.bgMode;
  $('bgCustomColor').value = state.bgCustom;
  syncChipGroup('fillStyleChips', state.fillStyle);
  syncChipGroup('symmetryChips', state.symmetry);
  syncToggle('repetitionToggle', state.repetition);
  syncChipGroup('timePresetChips', state.timePreset);
  syncChipGroup('sunMoonChips', state.sunMoon);
  syncToggle('snowCapsToggle', state.snowCaps);
  syncToggle('fogToggle', state.fog);
  syncToggle('starsToggle', state.stars);
  syncToggle('cloudsToggle', state.clouds);
  syncToggle('skyGradientToggle', state.skyGradient);
  syncToggle('reflectionToggle', state.reflection);
  syncToggle('atmosphericToggle', state.atmospheric);
  syncChipGroup('scribbleStyleChips', state.scribbleStyle);
  syncToggle('handDrawnToggle', state.handDrawn);
  $('customWidth').value = state.width;
  $('customHeight').value = state.height;
  syncToggle('hdpiToggle', state.hdpi);
  toggleContextualSections();
  updateUndoRedoButtons();
}

document.querySelectorAll('.section-head').forEach(head=>{
  head.addEventListener('click', ()=>{
    head.parentElement.classList.toggle('collapsed');
  });
});

$('bgMode').addEventListener('change', e=>{ state.bgMode = e.target.value; pushHistory('bg'); scheduleRender(); });
$('bgCustomColor').addEventListener('input', e=>{ state.bgCustom = e.target.value; if(state.bgMode==='custom') scheduleRender(); });
$('bgCustomColor').addEventListener('change', ()=>pushHistory('bg'));

$('randomPaletteBtn').addEventListener('click', ()=>{
  if(state.lockedColors) return;
  const rng = mulberry32(Date.now()>>>0);
  state.palette = generateRandomPalette(rng);
  renderPaletteSwatches(); pushHistory('palette'); scheduleRender();
});
$('complementBtn').addEventListener('click', ()=>{
  state.palette = complementaryOf(state.palette);
  renderPaletteSwatches(); pushHistory('palette'); scheduleRender();
});

$('customWidth').addEventListener('change', e=>{ state.width = clamp(parseInt(e.target.value)||1920,16,10000); pushHistory('size'); scheduleRender(); });
$('customHeight').addEventListener('change', e=>{ state.height = clamp(parseInt(e.target.value)||1080,16,10000); pushHistory('size'); scheduleRender(); });

$('seedBtn').addEventListener('click', ()=>{
  state.seed = Math.floor(Math.random()*99999)+1;
  $('seed').value = state.seed; $('v_seed').textContent = state.seed;
  pushHistory('seed'); scheduleRender();
});

buildChipGroup('fillStyleChips','fillStyle');
buildChipGroup('symmetryChips','symmetry', v=>parseInt(v));
buildChipGroup('timePresetChips','timePreset');
buildChipGroup('sunMoonChips','sunMoon');
buildChipGroup('scribbleStyleChips','scribbleStyle');
buildToggle('repetitionToggle','repetition');
buildToggle('snowCapsToggle','snowCaps');
buildToggle('fogToggle','fog');
buildToggle('starsToggle','stars');
buildToggle('cloudsToggle','clouds');
buildToggle('skyGradientToggle','skyGradient');
buildToggle('reflectionToggle','reflection');
buildToggle('atmosphericToggle','atmospheric');
buildToggle('handDrawnToggle','handDrawn');
buildToggle('hdpiToggle','hdpi');


$('undoBtn').addEventListener('click', undo);
$('redoBtn').addEventListener('click', redo);
$('randomizeBtn').addEventListener('click', ()=>{
  const rng = mulberry32(Date.now()>>>0);
  state.shapeCount = Math.floor(10+rng()*300);
  state.shapeSize = Math.floor(10+rng()*250);
  state.rotation = Math.floor(rng()*360);
  state.scale = Math.floor(50+rng()*150);
  state.density = Math.floor(10+rng()*90);
  state.opacity = Math.floor(50+rng()*50);
  state.layerCount = 1+Math.floor(rng()*5);
  state.strokeWidth = Math.round(rng()*10*10)/10;
  state.fillStyle = pick(rng,["fill","stroke","both"]);
  state.symmetry = pick(rng,[1,1,2,4,6]);
  state.gridSpacing = Math.floor(40+rng()*200);
  state.noiseIntensity = Math.floor(rng()*100);
  state.blurAmount = Math.floor(rng()*8);
  state.shadowIntensity = Math.floor(rng()*60);
  state.glowIntensity = Math.floor(rng()*40);
  state.grainAmount = Math.floor(rng()*40);
  state.seed = Math.floor(rng()*99999)+1;
  if(!state.lockedColors) state.palette = generateRandomPalette(mulberry32(Date.now()>>>0));
  syncUIFromState();
  pushHistory('randomize');
  scheduleRender();
});
$('lockColorsBtn').addEventListener('click', ()=>{
  state.lockedColors = !state.lockedColors;
  $('lockColorsBtn').classList.toggle('active', state.lockedColors);
});
$('compareBtn').addEventListener('click', ()=>{
  if(!compareMode){
   
    if(historyIndex<=0){
      flashButton($('compareBtn'), '');
      return;
    }
    compareSnapshot = previewCanvas.toDataURL();
    const prevState = JSON.parse(history[historyIndex-1]);
    const tmp = state; state = prevState;
    previewCanvas.width = state.width; previewCanvas.height = state.height;
    renderToContext(previewCtx, state.width, state.height);
    state = tmp;
    $('compareBadge').style.display='flex';
    compareMode = true;
  } else {
    doRender();
    $('compareBadge').style.display='none';
    compareMode = false;
  }
});
$('compareBadge').addEventListener('click', ()=>{
  if(compareMode) $('compareBtn').click();
});
$('themeBtn').addEventListener('click', ()=>{
  const html = document.documentElement;
  const cur = html.getAttribute('data-theme');
  html.setAttribute('data-theme', cur==='light' ? 'dark' : 'light');
});

/* Fullscreen preview */
$('fsBtn').addEventListener('click', ()=>{
  document.getElementById('app').classList.add('fullscreen-mode');
  $('fsExitBtn').style.display='inline-flex';
  fitToScreen(true);
});
$('fsExitBtn').addEventListener('click', ()=>{
  document.getElementById('app').classList.remove('fullscreen-mode');
  $('fsExitBtn').style.display='none';
  fitToScreen(true);
});

function isMobile(){ return window.innerWidth<=900; }
function updateMobileUI(){
  $('sidebarToggleBtn').style.display = isMobile() ? 'flex' : 'none';
}
$('sidebarToggleBtn').addEventListener('click', ()=>{
  $('sidebar').classList.toggle('open');
  $('sidebarScrim').classList.toggle('show');
});
$('sidebarScrim').addEventListener('click', ()=>{
  $('sidebar').classList.remove('open');
  $('sidebarScrim').classList.remove('show');
});
/*  */
window.addEventListener('resize', ()=>{ updateMobileUI(); fitToScreen(false); });


let zoom = 1, panX=0, panY=0, fitMode=true;
const stage = $('canvasStage');
const viewport = $('canvasViewport');
function applyTransform(){
  viewport.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
  $('zoomLabel').textContent = fitMode ? 'Fit' : Math.round(zoom*100)+'%';
}
function fitToScreen(recenter){
  const rect = stage.getBoundingClientRect();
  const pad = 60;
  const sx = (rect.width-pad)/state.width;
  const sy = (rect.height-pad)/state.height;
  zoom = Math.min(sx, sy, 2);
  fitMode = true;
  panX = (rect.width - state.width*zoom)/2;
  panY = (rect.height - state.height*zoom)/2;
  applyTransform();
}
$('zoomInBtn').addEventListener('click', ()=>{ fitMode=false; zoom = clamp(zoom*1.2,0.02,8); applyTransform(); });
$('zoomOutBtn').addEventListener('click', ()=>{ fitMode=false; zoom = clamp(zoom/1.2,0.02,8); applyTransform(); });
$('zoomFitBtn').addEventListener('click', ()=>fitToScreen(true));
stage.addEventListener('wheel', (e)=>{
  e.preventDefault();
  fitMode=false;
  const rect = stage.getBoundingClientRect();
  const mx = e.clientX-rect.left, my = e.clientY-rect.top;
  const prevZoom = zoom;
  zoom = clamp(zoom * (e.deltaY<0?1.1:0.9), 0.02, 8);
  panX = mx - (mx-panX)*(zoom/prevZoom);
  panY = my - (my-panY)*(zoom/prevZoom);
  applyTransform();
},{passive:false});
let dragging=false, dragStart={x:0,y:0}, panStart={x:0,y:0};
stage.addEventListener('pointerdown', (e)=>{
  dragging=true; stage.classList.add('panning');
  dragStart={x:e.clientX,y:e.clientY}; panStart={x:panX,y:panY};
});
window.addEventListener('pointermove', (e)=>{
  if(!dragging) return;
  panX = panStart.x + (e.clientX-dragStart.x);
  panY = panStart.y + (e.clientY-dragStart.y);
  applyTransform();
});
window.addEventListener('pointerup', ()=>{ dragging=false; stage.classList.remove('panning'); });


let exportFormat='png';
buildChipGroup2('exportFormatChips', (v)=>{ exportFormat=v; $('qualityField').style.display = v==='png'?'none':'flex'; });
function buildChipGroup2(id, cb){
  document.querySelectorAll('#'+id+' .chip').forEach(chip=>{
    chip.addEventListener('click', ()=>{
      document.querySelectorAll('#'+id+' .chip').forEach(c=>c.classList.remove('active'));
      chip.classList.add('active');
      cb(chip.dataset.v);
    });
  });
}
$('exportQuality').addEventListener('input', e=>{ $('v_exportQuality').textContent=e.target.value+'%'; });

function buildExportResSelect(){
  const sel = $('exportResSelect');
  sel.innerHTML = `<option value="current">Current canvas (${state.width}×${state.height})</option>` +
    RESOLUTION_PRESETS.map((r,i)=>`<option value="${i}">${r.name}</option>`).join('');
}
$('exportOpenBtn').addEventListener('click', ()=>{ buildExportResSelect(); $('exportModal').classList.add('show'); });
document.querySelectorAll('.modal-overlay').forEach(m=>{
  m.addEventListener('click', (e)=>{ if(e.target===m) m.classList.remove('show'); });
});

function renderAtResolution(w,h){
  const c = document.createElement('canvas');
  c.width=w; c.height=h;
  const ctx = c.getContext('2d');
  const savedW = state.width, savedH = state.height;
  state.width=w; state.height=h;
  renderToContext(ctx, w, h);
  state.width=savedW; state.height=savedH;
  return c;
}
function getExportDims(){
  const sel = $('exportResSelect').value;
  if(sel==='current') return {w:state.width,h:state.height};
  const r = RESOLUTION_PRESETS[+sel];
  return {w:r.w,h:r.h};
}
function exportCanvasBlob(canvas, cb){
  const mime = exportFormat==='png' ? 'image/png' : exportFormat==='jpeg' ? 'image/jpeg' : 'image/webp';
  const q = parseInt($('exportQuality').value)/100;
  canvas.toBlob(cb, mime, exportFormat==='png'?undefined:q);
}
$('downloadBtn').addEventListener('click', ()=>{
  const {w,h} = getExportDims();
  const c = (w===state.width && h===state.height) ? previewCanvas : renderAtResolution(w,h);
  exportCanvasBlob(c, (blob)=>{
    if(!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href=url; a.download = `wallpaper-${state.category}-${w}x${h}.${exportFormat==='jpeg'?'jpg':exportFormat}`;
    a.click();
    setTimeout(()=>URL.revokeObjectURL(url), 4000);
  });
});
$('copyClipboardBtn').addEventListener('click', async ()=>{
  const {w,h} = getExportDims();
  const c = (w===state.width && h===state.height) ? previewCanvas : renderAtResolution(w,h);
  /* . */
  c.toBlob((blob)=>{
    if(!blob) return;
    navigator.clipboard.write([new ClipboardItem({'image/png':blob})])
      .then(()=>flashButton($('copyClipboardBtn'), 'Copied!'))
      .catch(()=>flashButton($('copyClipboardBtn'), 'Copy failed'));
  }, 'image/png');
});
$('batchExportBtn').addEventListener('click', async ()=>{
  flashButton($('batchExportBtn'), 'Exporting…');
  const picks = [DEVICE_PRESETS[6], DEVICE_PRESETS[1], DEVICE_PRESETS[13]]; // laptop, iphone, 4k
  for(const d of picks){
    const c = renderAtResolution(d.w,d.h);
    await new Promise(res=>{
      exportCanvasBlob(c, (blob)=>{
        if(!blob){ res(); return; }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href=url; a.download = `wallpaper-${d.name.replace(/[^a-z0-9]+/gi,'_')}-${d.w}x${d.h}.${exportFormat==='jpeg'?'jpg':exportFormat}`;
        a.click();
        setTimeout(()=>{URL.revokeObjectURL(url); res();}, 300);
      });
    });
  }
  flashButton($('batchExportBtn'), 'Batch export devices');
});
function flashButton(btn, text){
  if(!text) return;
  const orig = btn.textContent;
  btn.textContent = text;
  setTimeout(()=>{btn.textContent=orig;}, 1600);
}


$('savePresetBtn').addEventListener('click', ()=>{ $('presetNameInput').value=''; $('saveModal').classList.add('show'); });
$('cancelSaveBtn').addEventListener('click', ()=>$('saveModal').classList.remove('show'));
$('confirmSaveBtn').addEventListener('click', ()=>{
  const name = $('presetNameInput').value.trim() || `Preset ${savedPresets.length+1}`;
  savedPresets.push({name, state: JSON.parse(JSON.stringify(state))});
  renderPresetList();
  $('saveModal').classList.remove('show');
});
function renderPresetList(){
  const list = $('presetList');
  if(savedPresets.length===0){ list.innerHTML='<div class="empty-hint">No saved presets yet</div>'; return; }
  list.innerHTML='';
  savedPresets.forEach((p,i)=>{
    const el = document.createElement('div');
    el.className='preset-item';
    el.innerHTML = `<span>${p.name}</span><button data-a="load" title="Load">↺</button><button data-a="del" title="Delete">×</button>`;
    el.querySelector('[data-a="load"]').addEventListener('click', ()=>{
      state = JSON.parse(JSON.stringify(p.state));
      syncUIFromState(); pushHistory('load-preset'); scheduleRender();
    });
    el.querySelector('[data-a="del"]').addEventListener('click', ()=>{
      savedPresets.splice(i,1); renderPresetList();
    });
    list.appendChild(el);
  });
}
$('resetBtn').addEventListener('click', ()=>{
  const seed = state.seed;
  state = defaultState();
  state.seed = seed;
  syncUIFromState(); pushHistory('reset'); scheduleRender();
});
$('exportPresetsBtn').addEventListener('click', ()=>{
  const blob = new Blob([JSON.stringify(savedPresets,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download='wallpaper-presets.json'; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),3000);
});
$('importPresetsBtn').addEventListener('click', ()=>$('importPresetsFile').click());
$('importPresetsFile').addEventListener('change', (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = (ev)=>{
    try{
      const arr = JSON.parse(ev.target.result);
      if(Array.isArray(arr)){
        savedPresets = savedPresets.concat(arr);
        renderPresetList();
      } else {
        alert('Invalid preset file: expected a JSON array.');
      }
    }catch(err){ alert('Invalid preset file.'); }
  };
  reader.onerror = ()=> alert('Could not read preset file.');
  reader.readAsText(file);
  e.target.value='';
});


function renderHistoryPanel(label){
  updateUndoRedoButtons();
  const panel = $('historyPanel');
  if(history.length<=1){ panel.innerHTML='<div class="empty-hint">History appears as you edit</div>'; return; }
  panel.innerHTML='';
  history.forEach((h,i)=>{
    const el = document.createElement('div');
    el.className='preset-item';
    el.style.opacity = i===historyIndex ? '1':'0.6';
    el.innerHTML = `<span>${i===0?'Initial state':'Edit #'+i}</span><button data-i="${i}">${i===historyIndex?'●':'○'}</button>`;
    el.querySelector('button').addEventListener('click', ()=>applyHistoryIndex(i));
    panel.appendChild(el);
  });
  panel.scrollTop = panel.scrollHeight;
}

/* =========================================================================
   ========================================================================= */
$('presetSearch').addEventListener('input', (e)=>{
  const q = e.target.value.toLowerCase().trim();
  document.querySelectorAll('.category-card').forEach(card=>{
    const name = card.querySelector('.cname').textContent.toLowerCase();
    card.style.display = (!q || name.includes(q)) ? '' : 'none';
  });
});


function init(){
  buildCategoryGrid();
  buildPaletteGrid();
  buildDevicePresets();
  buildAspectChips();
  bindSliders();
  renderPaletteSwatches();
  syncUIFromState();
  updateMobileUI();
  $('categoryTag').textContent = CATEGORIES.find(c=>c.id===state.category).name;
  scheduleRender();
  setTimeout(()=>fitToScreen(true), 50);
}
init();

})();
