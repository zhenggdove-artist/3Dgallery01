// A GM testing spectator controls holds a real spectator slot while their
// former fighter seat stays reserved. Public overflow always respects both.
export function availableRoleSeat(rows,role,maxFighters=4,maxSpectators=100){
 if(role!=='fighter'&&role!=='spectator')return undefined;
 const limit=role==='fighter'?maxFighters:maxSpectators;
 const offset=role==='fighter'?0:maxFighters;
 const occupied=new Set();
 for(const row of rows||[]){
  if(row.role===role&&Number.isInteger(row.seat))occupied.add(row.seat);
  if(role==='fighter'&&row.role==='spectator'&&Number.isInteger(row.preview_seat))
   occupied.add(row.preview_seat);
 }
 for(let i=offset;i<offset+limit;i++)if(!occupied.has(i))return i;
 return undefined;
}
