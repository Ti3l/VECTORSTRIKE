// IA dos bots de treino. Executada no servidor; nenhum cliente controla os bots.
import { ARENA, CRATES, ROOFS, GAME, SITE, clamp, collides, distance2, rayBox, WEAPONS } from './shared.js';

export const BOT_DIFFICULTIES = Object.freeze({
  easy:   { label: 'Fácil',   reactionMs: 1050, error: .079, speed: 2.20, shotDelay: 1.95, preferredRange: 6.3 },
  normal: { label: 'Normal',  reactionMs: 620,  error: .035, speed: 3.05, shotDelay: 1.55, preferredRange: 8.2 },
  hard:   { label: 'Difícil', reactionMs: 290,  error: .013, speed: 3.85, shotDelay: 1.18, preferredRange: 10.4 },
});
export const BOT_MAX = 4;
export const BOT_WEAPON = 'rifle';
export function trainingOptions(data = {}) {
  const count = Number(data.botCount);
  return {
    botCount: Number.isFinite(count) ? clamp(Math.trunc(count), 1, BOT_MAX) : 2,
    difficulty: Object.hasOwn(BOT_DIFFICULTIES, data.difficulty) ? data.difficulty : 'normal',
  };
}

// Malha de navegação 2D que respeita as colisões das caixas/contêineres.
const STEP = 1.65;
const MIN_X = -ARENA.halfWidth + 1.35;
const MIN_Z = -ARENA.halfDepth + 1.35;
const NX = Math.floor((ARENA.halfWidth * 2 - 2.7) / STEP) + 1;
const NZ = Math.floor((ARENA.halfDepth * 2 - 2.7) / STEP) + 1;
const key = (x,z) => z * NX + x;
const coord = id => ({x: id % NX, z: Math.floor(id / NX)});
const world = (x,z) => ({x: MIN_X + x * STEP, z: MIN_Z + z * STEP});
const navigable = Array.from({length: NX * NZ}, (_,id) => {
  const c = coord(id), p = world(c.x,c.z);
  return !collides(p.x,p.z,GAME.playerRadius + .10);
});
function nearestCell(position) {
  let x = clamp(Math.round((position.x-MIN_X)/STEP),0,NX-1);
  let z = clamp(Math.round((position.z-MIN_Z)/STEP),0,NZ-1);
  let best = -1, bestDistance = Infinity;
  for(let dz=-5;dz<=5;dz++) for(let dx=-5;dx<=5;dx++) {
    const cx=x+dx,cz=z+dz;
    if(cx<0||cx>=NX||cz<0||cz>=NZ)continue;
    const id=key(cx,cz),p=world(cx,cz);
    const d=(p.x-position.x)**2+(p.z-position.z)**2;
    if(navigable[id]&&d<bestDistance){bestDistance=d;best=id;}
  }
  return best;
}
const OFFSETS = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
const heuristic = (a,b) => Math.hypot(coord(a).x-coord(b).x,coord(a).z-coord(b).z);
export function findBotPath(from,to) {
  const start = nearestCell(from), goal = nearestCell(to);
  if(start<0||goal<0)return [];
  if(start===goal)return [world(coord(goal).x,coord(goal).z)];
  const scores=new Float32Array(navigable.length);scores.fill(Infinity);scores[start]=0;
  const parents=new Int32Array(navigable.length);parents.fill(-1);
  const open=[start];const visited=new Uint8Array(navigable.length);
  for(let iteration=0;open.length&&iteration<4800;iteration++){
    let index=0,lowest=Infinity;
    for(let n=0;n<open.length;n++){
      const f=scores[open[n]]+heuristic(open[n],goal);
      if(f<lowest){lowest=f;index=n;}
    }
    const current=open.splice(index,1)[0];
    if(current===goal){
      const path=[];let step=current;
      while(step>=0&&path.length<200){const c=coord(step);path.push(world(c.x,c.z));if(step===start)break;step=parents[step];}
      return path.reverse();
    }
    if(visited[current])continue;
    visited[current]=1;
    const c=coord(current);
    for(const [dx,dz] of OFFSETS){
      const x=c.x+dx,z=c.z+dz;
      if(x<0||x>=NX||z<0||z>=NZ)continue;
      const next=key(x,z);
      if(!navigable[next]||visited[next])continue;
      if(dx&&dz&&(!navigable[key(x,c.z)]||!navigable[key(c.x,z)]))continue;
      const candidate=scores[current]+(dx&&dz?Math.SQRT2:1);
      if(candidate<scores[next]){scores[next]=candidate;parents[next]=current;if(!open.includes(next))open.push(next);}
    }
  }
  return [];
}
export function lineOfSight(from,to){
  const start={x:from.x,y:from.y??1.35,z:from.z};
  const end={x:to.x,y:to.y??1.35,z:to.z};
  const dx=end.x-start.x,dy=end.y-start.y,dz=end.z-start.z;
  const dist=Math.hypot(dx,dy,dz);
  if(dist<=.001)return true;
  const dir={x:dx/dist,y:dy/dist,z:dz/dist};
  return ![...CRATES,...ROOFS].some(box=>{const hit=rayBox(start,dir,box,dist);return hit!==null&&hit<dist-.35;});
}
export function botAngles(from,to){
  const dx=to.x-from.x,dz=to.z-from.z;
  return {yaw:Math.atan2(-dx,-dz),pitch:Math.atan2((to.y??1.35)-(from.y??1.35),Math.hypot(dx,dz))};
}
export function prepareBot(bot) {
  bot.inventory.primary=BOT_WEAPON;
  bot.weapon=BOT_WEAPON;
  bot.mag[BOT_WEAPON]=WEAPONS[BOT_WEAPON].magazine;
  bot.reserve[BOT_WEAPON]=WEAPONS[BOT_WEAPON].reserve;
  bot.armor=25;bot.armorMax=25;
  bot.targetId=null;bot.spottedAt=0;bot.botPath=[];bot.pathAt=0;bot.pathTarget=null;
  bot.nextBotShot=0;bot.lastMoveAt=0;bot.botDirection=1;
}

// Executado no tick autoritativo do servidor, com todos os jogadores presentes.
// shoot é a função que valida disparos e aplica dano exatamente como faz para jogadores reais.
export function updateBot(bot, room, seconds, t, shoot, reload) {
  if(!bot.alive || room.phase!=='live')return;
  const config=BOT_DIFFICULTIES[room.difficulty] || BOT_DIFFICULTIES.normal;
  const foes=[...room.players.values()].filter(p=>p.alive&&p.team!==bot.team);
  if(!foes.length){bot.input={};return;}
  foes.sort((a,b)=>distance2(a,bot)-distance2(b,bot));
  const enemy=foes[0];
  if(bot.targetId!==enemy.id){bot.targetId=enemy.id;bot.spottedAt=t;}
  const distance=distance2(bot,enemy);
  const visible=lineOfSight({x:bot.x,y:1.4,z:bot.z},{x:enemy.x,y:(enemy.y??0)+1.3,z:enemy.z});
  const destination=room.bomb.state==='planted' && bot.team==='defenders' ? room.bomb : enemy;
  const closeToBomb=room.bomb.state==='planted'&&bot.team==='defenders'&&distance2(bot,room.bomb)<=2.55;
  const shouldAdvance=!visible||distance>config.preferredRange||closeToBomb;
  bot.input={interact:closeToBomb,aim:false,crouch:false};
  if(t-(bot.pathAt||0)>850 || !bot.botPath?.length || distance2(destination,bot.pathTarget||{x:999,z:999})>2.6){
    bot.botPath=findBotPath(bot,destination);
    bot.pathAt=t;bot.pathTarget={x:destination.x,z:destination.z};
  }
  if(shouldAdvance){
    while(bot.botPath.length && distance2(bot,bot.botPath[0])<.82)bot.botPath.shift();
    const waypoint=bot.botPath[0] || destination;
    const dx=waypoint.x-bot.x,dz=waypoint.z-bot.z,mag=Math.hypot(dx,dz);
    if(mag>.1){
      const step=Math.min(config.speed*seconds,mag);
      const vx=dx/mag*step,vz=dz/mag*step;
      if(!collides(bot.x+vx,bot.z))bot.x+=vx;
      if(!collides(bot.x,bot.z+vz))bot.z+=vz;
    }
  } else if(distance<config.preferredRange-.8 && t-bot.lastMoveAt>900){
    bot.lastMoveAt=t;bot.botDirection*=-1;
  }
  if(closeToBomb){
    bot.input.interact=true;
    bot.yaw=botAngles({x:bot.x,z:bot.z},room.bomb).yaw;
    bot.pitch=0;
  } else {
    // Atira na região do peito com erro intencional e atraso que dependem da dificuldade.
    const targetPoint={x:enemy.x,y:(enemy.y??0)+(enemy.input?.crouch ? .92 : 1.18),z:enemy.z};
    const aim=botAngles({x:bot.x,y:1.48,z:bot.z},targetPoint);
    bot.yaw=aim.yaw;bot.pitch=aim.pitch;
    if(visible && distance<29 && t-bot.spottedAt>=config.reactionMs && t>=bot.nextBotShot){
      if(bot.mag[bot.weapon]<=0){reload(bot,t);bot.nextBotShot=t+500;}
      else if(!bot.reloadEnd){
        const jitter=(Math.random()*2-1)*config.error;
        shoot(room,bot,{yaw:aim.yaw+jitter,pitch:aim.pitch+(Math.random()*2-1)*config.error},t);
        bot.nextBotShot=t+WEAPONS[bot.weapon].fireMs*config.shotDelay;
      }
    }
  }
  if(bot.mag[bot.weapon]===0 && !bot.reloadEnd && bot.reserve[bot.weapon]>0)reload(bot,t);
}
