// Shared 2D point-angle math — originally written for PitchMechanics2D's joint tracking,
// reused here so ROM entry doesn't duplicate the same trig.
export function angleAt(A:{x:number,y:number},B:{x:number,y:number},C:{x:number,y:number}):number{
  const v1={x:A.x-B.x,y:A.y-B.y}, v2={x:C.x-B.x,y:C.y-B.y}
  const dot=v1.x*v2.x+v1.y*v2.y
  const m1=Math.hypot(v1.x,v1.y), m2=Math.hypot(v2.x,v2.y)
  const cos=Math.max(-1,Math.min(1,dot/(m1*m2)))
  return Math.acos(cos)*180/Math.PI
}
