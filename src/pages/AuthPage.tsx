import { useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { Mail, Lock, User, ArrowRight, CheckCircle } from 'lucide-react'
import Logo from '@/components/Logo'
import toast from 'react-hot-toast'

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [dataConsent, setDataConsent] = useState(false)
  const { signIn, signUp, loading } = useAuthStore()

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
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950">
      {/* Background gradient */}
      <div className="fixed inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(34,197,94,0.05),transparent_50%)]" />

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8 animate-fade-in flex flex-col items-center">
          <Logo size="lg" showText={true} />
          <p className="text-slate-500 text-sm mt-4">
            Track your productivity with actionable insights
          </p>
        </div>

        {/* Auth Card */}
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm animate-scale-in">
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold text-white">
              {isLogin ? 'Welcome back' : 'Create account'}
            </h2>
            <p className="text-sm mt-1 text-slate-400">
              {isLogin 
                ? 'Sign in to continue to your dashboard' 
                : 'Start tracking your productivity'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="animate-slide-down">
                <label className="block text-sm font-medium mb-1.5 text-slate-300">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm outline-none transition-all bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
                    placeholder="Dr. Jane Smith"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1.5 text-slate-300">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm outline-none transition-all bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
                  placeholder="you@hospital.org"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5 text-slate-300">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm outline-none transition-all bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
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
                      className={`w-4 h-4 rounded border-2 transition-all ${
                        dataConsent 
                          ? 'bg-emerald-500 border-emerald-500' 
                          : 'border-slate-600 bg-transparent'
                      }`}
                    />
                    {dataConsent && (
                      <CheckCircle className="absolute inset-0 w-4 h-4 text-white" />
                    )}
                  </div>
                  <span className="text-xs leading-relaxed text-slate-400">
                    I agree to share anonymized RVU data for research purposes.
                  </span>
                </label>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50 bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {isLogin ? 'Sign In' : 'Create Account'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-5 pt-5 border-t border-slate-800">
            <p className="text-center text-sm text-slate-500">
              {isLogin ? "Don't have an account?" : 'Already have an account?'}
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="ml-1 font-medium transition-colors text-emerald-400 hover:text-emerald-300"
              >
                {isLogin ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </div>
        </div>

      </div>
    </div>
  )
}
