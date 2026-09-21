import { useState } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Lock, Mail } from 'lucide-react'
import { auth } from '../../firebase'

function AdminLogin() {
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(event) {
    event.preventDefault()

    setLoading(true)
    setError('')

    try {
      await signInWithEmailAndPassword(auth, email, password)
      navigate('/admin')
    } catch (err) {
      console.error(err)

      if (
        err.code === 'auth/invalid-credential' ||
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/user-not-found'
      ) {
        setError('Invalid email or password.')
      } else {
        setError('Unable to sign in. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8F9FA] px-6">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0A2540] text-white">
            <BookOpen size={28} />
          </div>

          <h1 className="mt-5 text-2xl font-bold text-[#212529]">
            THIS Library
          </h1>

          <p className="mt-2 text-gray-500">
            Library Administration
          </p>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <h2 className="text-xl font-bold text-[#212529]">
            Admin Sign In
          </h2>

          <p className="mt-2 text-sm text-gray-500">
            Sign in to manage the library.
          </p>

          <form onSubmit={handleLogin} className="mt-6 space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Email
              </label>

              <div className="relative">
                <Mail
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="admin@example.com"
                  required
                  className="w-full rounded-lg border border-gray-200 py-3 pl-10 pr-4 outline-none focus:border-[#0A2540]"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Password
              </label>

              <div className="relative">
                <Lock
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  required
                  className="w-full rounded-lg border border-gray-200 py-3 pl-10 pr-4 outline-none focus:border-[#0A2540]"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-[#0A2540] px-4 py-3 font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        <button
          onClick={() => navigate('/')}
          className="mt-6 block w-full text-center text-sm text-gray-500 hover:text-[#0A2540]"
        >
          Back to Library Catalog
        </button>
      </div>
    </div>
  )
}

export default AdminLogin