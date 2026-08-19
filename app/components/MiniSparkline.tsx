'use client'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

export default function MiniSparkline({data, color, unit='', height=60}:{data:{date:string,value:number}[], color:string, unit?:string, height?:number}){
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{top:2,right:4,left:0,bottom:0}}>
        <XAxis dataKey="date" hide/>
        <YAxis hide domain={['auto','auto']}/>
        <Tooltip contentStyle={{background:'#1c2333',border:'1px solid #30363d',borderRadius:6,fontSize:11}} formatter={(v:any)=>[`${v}${unit}`,'']}/>
        <Line type="monotone" dataKey="value" stroke={color} dot={{r:2}} strokeWidth={2}/>
      </LineChart>
    </ResponsiveContainer>
  )
}
