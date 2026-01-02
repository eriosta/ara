import { useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useThemeStore } from '@/stores/themeStore'
import { Activity, Mail, Lock, User, ArrowRight, AlertCircle, CheckCircle, Sun, Moon } from 'lucide-react'
import toast from 'react-hot-toast'

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [dataConsent, setDataConsent] = useState(false)
  const { signIn, signUp, loading } = useAuthStore()
  const { theme, toggleTheme } = useThemeStore()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (isLogin) {
      const { error } = await signIn(email, password)
      if (error) {
        toast.error(error.message)
      } else {
        toast.success('Welcome back!')
      }
    } else {
      if (!fullName.trim()) {
        toast.error('Please enter your full name')
        return
      }
      if (!dataConsent) {
        toast.error('Please agree to the data sharing terms to continue')
        return
      }
      const { error } = await signUp(email, password, fullName, dataConsent)
      if (error) {
        toast.error(error.message)
      } else {
        toast.success('Account created! Check your email to confirm.', {
          duration: 6000,
        })
      }
    }
  }

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      {/* Theme Toggle */}
      <button
        onClick={toggleTheme}
        className="fixed top-4 right-4 p-2 rounded-lg transition-colors"
        style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
      >
        {theme === 'dark' ? (
          <Sun className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
        ) : (
          <Moon className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
        )}
      </button>

      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8 animate-fade-in">
          <div 
            className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: 'var(--accent-primary)' }}
          >
            <Activity className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            RVU Dashboard
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Radiology Productivity Analytics
          </p>
        </div>

        {/* Auth Card */}
        <div 
          className="p-6 rounded-xl animate-scale-in"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
        >
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              {isLogin ? 'Sign in' : 'Create account'}
            </h2>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              {isLogin 
                ? 'Enter your credentials to continue' 
                : 'Start tracking your productivity'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="animate-slide-down">
                <label 
                  className="block text-sm font-medium mb-1.5"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Full Name
                </label>
                <div className="relative">
                  <User 
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" 
                    style={{ color: 'var(--text-muted)' }}
                  />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm outline-none transition-colors"
                    style={{ 
                      backgroundColor: 'var(--bg-tertiary)', 
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)'
                    }}
                    placeholder="Dr. Jane Smith"
                  />
                </div>
              </div>
            )}

            <div>
              <label 
                className="block text-sm font-medium mb-1.5"
                style={{ color: 'var(--text-secondary)' }}
              >
                Email
              </label>
              <div className="relative">
                <Mail 
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" 
                  style={{ color: 'var(--text-muted)' }}
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm outline-none transition-colors"
                  style={{ 
                    backgroundColor: 'var(--bg-tertiary)', 
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)'
                  }}
                  placeholder="you@hospital.org"
                  required
                />
              </div>
            </div>

            <div>
              <label 
                className="block text-sm font-medium mb-1.5"
                style={{ color: 'var(--text-secondary)' }}
              >
                Password
              </label>
              <div className="relative">
                <Lock 
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" 
                  style={{ color: 'var(--text-muted)' }}
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm outline-none transition-colors"
                  style={{ 
                    backgroundColor: 'var(--bg-tertiary)', 
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)'
                  }}
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>
            </div>

            {!isLogin && (
              <div className="animate-slide-down">
                <label className="flex items-start gap-3 cursor-pointer">
                  <div className="relative flex-shrink-0 mt-0.5">
                    <input
                      type="checkbox"
                      checked={dataConsent}
                      onChange={(e) => setDataConsent(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div 
                      className="w-4 h-4 rounded border-2 transition-all peer-checked:border-transparent"
                      style={{ 
                        borderColor: 'var(--border-light)',
                        backgroundColor: dataConsent ? 'var(--accent-primary)' : 'transparent'
                      }}
                    />
                    {dataConsent && (
                      <CheckCircle className="absolute inset-0 w-4 h-4 text-white" />
                    )}
                  </div>
                  <span className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    I agree to share anonymized RVU data for research purposes.
                  </span>
                </label>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              style={{ 
                backgroundColor: 'var(--accent-primary)', 
                color: 'white' 
              }}
            >
              {loading ? (
                <div 
                  className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" 
                />
              ) : (
                <>
                  {isLogin ? 'Sign In' : 'Create Account'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-5 pt-5" style={{ borderTop: '1px solid var(--border-color)' }}>
            <p className="text-center text-sm" style={{ color: 'var(--text-muted)' }}>
              {isLogin ? "Don't have an account?" : 'Already have an account?'}
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="ml-1 font-medium transition-colors"
                style={{ color: 'var(--accent-primary)' }}
              >
                {isLogin ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </div>
        </div>

        {/* Security Notice */}
        <div 
          className="mt-4 p-3 rounded-lg flex items-start gap-2"
          style={{ 
            backgroundColor: 'rgba(245, 158, 11, 0.1)', 
            border: '1px solid rgba(245, 158, 11, 0.2)' 
          }}
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--warning)' }} />
          <p className="text-xs leading-relaxed" style={{ color: 'var(--warning)' }}>
            <strong>Security:</strong> Do not include PHI or patient identifiers.
          </p>
        </div>
      </div>
    </div>
  )
}
