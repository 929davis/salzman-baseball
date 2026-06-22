'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SignupPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSignup = async () => {
    if (!fullName.trim()) { setError('Please enter your full name'); return }
    if (!email.trim()) { setError('Please enter your email'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role: 'pitcher' },
        emailRedirectTo: `${window.location.origin}/auth/callback`
      }
    })
    if (error) { setError(error.message); setLoading(false); return }
    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <div style={{minHeight:'100vh',background:'#0d1117',display:'flex',alignItems:'center',justifyContent:'center',padding:'24px',fontFamily:'system-ui,-apple-system,sans-serif'}}>
        <div style={{width:'100%',maxWidth:'380px',textAlign:'center'}}>
          <div style={{fontSize:'48px',marginBottom:'16px'}}>✅</div>
          <h2 style={{color:'#ffffff',fontSize:'20px',fontWeight:'700',marginBottom:'8px'}}>Check your email</h2>
          <p style={{color:'#7d8590',fontSize:'14px',lineHeight:'1.6'}}>We sent a confirmation link to <strong style={{color:'#e8b84b'}}>{email}</strong>. Click it to activate your account.</p>
          <button onClick={()=>router.push('/auth/login')} style={{marginTop:'24px',background:'#e8b84b',color:'#0d1117',border:'none',borderRadius:'8px',padding:'12px 24px',fontSize:'14px',fontWeight:'700',cursor:'pointer'}}>Back to Login</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{minHeight:'100vh',background:'#0d1117',display:'flex',alignItems:'center',justifyContent:'center',padding:'24px',fontFamily:'system-ui,-apple-system,sans-serif'}}>
      <div style={{width:'100%',maxWidth:'380px'}}>
        <div style={{textAlign:'center',marginBottom:'32px'}}>
          <div style={{width:'52px',height:'52px',background:'linear-gradient(135deg,#e8b84b,#a07c28)',borderRadius:'12px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'28px',margin:'0 auto 16px'}}>⚾</div>
          <h1 style={{color:'#ffffff',fontSize:'22px',fontWeight:'700',margin:'0 0 4px',letterSpacing:'-0.5px'}}>Salzman Baseball</h1>
          <p style={{color:'#7d8590',fontSize:'13px',margin:0}}>Create your account</p>
        </div>
        <div style={{background:'#161b22',border:'1px solid #30363d',borderRadius:'12px',padding:'24px'}}>
          {error && <div style={{background:'rgba(248,81,73,0.1)',border:'1px solid rgba(248,81,73,0.3)',borderRadius:'8px',padding:'10px 14px',color:'#f85149',fontSize:'13px',marginBottom:'16px'}}>{error}</div>}
          <div style={{marginBottom:'16px'}}>
            <label style={{display:'block',fontSize:'11px',fontWeight:'600',color:'#7d8590',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'6px'}}>Full Name</label>
            <input type="text" value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="John Smith" style={{width:'100%',background:'#0d1117',border:'1px solid #30363d',borderRadius:'8px',padding:'10px 14px',fontSize:'14px',color:'#e6edf3',boxSizing:'border-box',outline:'none'}}/>
          </div>
          <div style={{marginBottom:'16px'}}>
            <label style={{display:'block',fontSize:'11px',fontWeight:'600',color:'#7d8590',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'6px'}}>Email</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" style={{width:'100%',background:'#0d1117',border:'1px solid #30363d',borderRadius:'8px',padding:'10px 14px',fontSize:'14px',color:'#e6edf3',boxSizing:'border-box',outline:'none'}}/>
          </div>
          <div style={{marginBottom:'20px'}}>
            <label style={{display:'block',fontSize:'11px',fontWeight:'600',color:'#7d8590',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'6px'}}>Password</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Min 6 characters" style={{width:'100%',background:'#0d1117',border:'1px solid #30363d',borderRadius:'8px',padding:'10px 14px',fontSize:'14px',color:'#e6edf3',boxSizing:'border-box',outline:'none'}}/>
          </div>
          <button onClick={handleSignup} disabled={loading} style={{width:'100%',background:'#e8b84b',color:'#0d1117',border:'none',borderRadius:'8px',padding:'12px',fontSize:'14px',fontWeight:'700',cursor:loading?'not-allowed':'pointer',opacity:loading?0.7:1}}>
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
          <p style={{textAlign:'center',marginTop:'16px',fontSize:'13px',color:'#7d8590'}}>
            Already have an account?{' '}
            <Link href="/auth/login" style={{color:'#e8b84b',textDecoration:'none',fontWeight:'600'}}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
