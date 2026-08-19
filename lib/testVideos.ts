import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

// Global (not per-pitcher) instructional video links, one per distinct test — mirrors the
// existing exercise_videos pattern (upsert keyed by a stable id) rather than per-athlete data.
export function useTestVideos(){
  const supabase = createClient()
  const [videos,setVideos] = useState<Record<string,string>>({})

  const refresh = useCallback(async()=>{
    const {data} = await supabase.from('test_videos').select('*')
    const map:Record<string,string> = {}
    ;(data||[]).forEach((r:any)=>{map[r.test_key]=r.video_url})
    setVideos(map)
  },[])

  useEffect(()=>{refresh()},[refresh])

  const saveVideo = useCallback(async(testKey:string,url:string)=>{
    if (!url.trim()) return
    await supabase.from('test_videos').upsert({test_key:testKey,video_url:url.trim()},{onConflict:'test_key'})
    setVideos(prev=>({...prev,[testKey]:url.trim()}))
  },[])

  return {videos, saveVideo}
}
