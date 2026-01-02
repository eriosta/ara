import { useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { Activity, Mail, Lock, User, ArrowRight, AlertCircle, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
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
      const { error } = await signUp(email, password, fullName)
      if (error) {
        toast.error(error.message)
      } else {
        toast.success('Account created! Check your email to confirm.', {
          icon: <CheckCircle className="w-5 h-5 text-primary-400" />,
          duration: 6000,
        })
      }
    }
  }

  return (
    <div className="min-h-screen flex grid-pattern">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-600/20 via-dark-900 to-dark-950" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-primary-500/10 via-transparent to-transparent" />
        
        <div className="relative z-10 flex flex-col justify-center px-16 xl:px-24">
          <div className="mb-12 animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center mb-8 glow-green">
              <Activity className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-5xl xl:text-6xl font-display font-bold mb-6">
              <span className="gradient-text">RVU</span>
              <br />
              <span className="text-dark-100">Dashboard</span>
            </h1>
            <p className="text-xl text-dark-300 max-w-md leading-relaxed">
              Track your radiology productivity with actionable insights and beautiful analytics.
            </p>
          </div>

          <div className="space-y-6 animate-slide-up" style={{ animationDelay: '0.3s' }}>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-5 h-5 text-primary-400" />
              </div>
              <div>
                <h3 className="font-semibold text-dark-100 mb-1">Performance Analytics</h3>
                <p className="text-dark-400 text-sm">Daily RVUs, trends, and efficiency metrics</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-5 h-5 text-primary-400" />
              </div>
              <div>
                <h3 className="font-semibold text-dark-100 mb-1">Case Mix Insights</h3>
                <p className="text-dark-400 text-sm">Modality and body part breakdown</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-5 h-5 text-primary-400" />
              </div>
              <div>
                <h3 className="font-semibold text-dark-100 mb-1">PDF Reports</h3>
                <p className="text-dark-400 text-sm">Export professional insights reports</p>
              </div>
            </div>
          </div>
        </div>

        {/* Decorative Elements */}
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary-500/5 rounded-full blur-3xl" />
        <div className="absolute top-1/4 right-0 w-64 h-64 bg-accent-500/5 rounded-full blur-3xl" />
      </div>

      {/* Right Side - Auth Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-10 animate-fade-in">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center mx-auto mb-4 glow-green">
              <Activity className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-3xl font-display font-bold">
              <span className="gradient-text">RVU</span> Dashboard
            </h1>
          </div>

          <div className="glass-card p-8 animate-scale-in">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-display font-semibold text-dark-100 mb-2">
                {isLogin ? 'Welcome back' : 'Create account'}
              </h2>
              <p className="text-dark-400 text-sm">
                {isLogin 
                  ? 'Sign in to access your analytics dashboard' 
                  : 'Start tracking your RVU productivity today'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {!isLogin && (
                <div className="animate-slide-down">
                  <label className="block text-sm font-medium text-dark-300 mb-2">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="input-field pl-12"
                      placeholder="Dr. Jane Smith"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-field pl-12"
                    placeholder="you@hospital.org"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-field pl-12"
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    {isLogin ? 'Sign In' : 'Create Account'}
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-dark-700">
              <p className="text-center text-dark-400 text-sm">
                {isLogin ? "Don't have an account?" : 'Already have an account?'}
                <button
                  onClick={() => setIsLogin(!isLogin)}
                  className="ml-2 text-primary-400 hover:text-primary-300 font-medium transition-colors"
                >
                  {isLogin ? 'Sign up' : 'Sign in'}
                </button>
              </p>
            </div>
          </div>

          {/* Security Notice */}
          <div className="mt-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-amber-300 mb-1">Security Notice</h4>
                <p className="text-xs text-amber-300/70 leading-relaxed">
                  Do NOT include PHI or patient identifiers. Only upload: Date/Time, Exam Description, and RVU values.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

