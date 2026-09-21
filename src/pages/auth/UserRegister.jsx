import { useState } from 'react'
import {
  createUserWithEmailAndPassword
} from 'firebase/auth'
import {
  doc,
  serverTimestamp,
  setDoc
} from 'firebase/firestore'
import { useNavigate } from 'react-router-dom'
import {
  BookOpen,
  Lock,
  Mail,
  User
} from 'lucide-react'
import { auth, db } from '../../firebase'

function UserRegister() {
  const navigate = useNavigate()

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'student'
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function handleChange(event) {
    const { name, value } = event.target

    setForm((current) => ({
      ...current,
      [name]: value
    }))
  }

  async function handleRegister(event) {
    event.preventDefault()

    setLoading(true)
    setError('')

    try {
      const credential =
        await createUserWithEmailAndPassword(
          auth,
          form.email.trim(),
          form.password
        )

      await setDoc(doc(db, 'users', credential.user.uid), {
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
        createdAt: serverTimestamp()
      })

      navigate('/account')
    } catch (error) {
      console.error(error)

      if (error.code === 'auth/email-already-in-use') {
        setError('An account with this email already exists.')
      } else if (error.code === 'auth/weak-password') {
        setError('Password must be at least 6 characters.')
      } else if (error.code === 'auth/invalid-email') {
        setError('Please enter a valid email address.')
      } else {
        setError('Unable to create account. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8F9FA] px-6 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0A2540] text-white">
            <BookOpen size={28} />
          </div>

          <h1 className="mt-5 text-2xl font-bold text-[#212529]">
            THIS Library
          </h1>

          <p className="mt-2 text-gray-500">
            Create your library account
          </p>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <h2 className="text-xl font-bold text-[#212529]">
            Create Account
          </h2>

          <form
            onSubmit={handleRegister}
            className="mt-6 space-y-5"
          >
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Full Name
              </label>

              <div className="relative">
                <User
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  required
                  placeholder="Full name"
                  className="w-full rounded-lg border border-gray-200 py-3 pl-10 pr-4 outline-none focus:border-[#0A2540]"
                />
              </div>
            </div>

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
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                  placeholder="you@example.com"
                  className="w-full rounded-lg border border-gray-200 py-3 pl-10 pr-4 outline-none focus:border-[#0A2540]"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Account Type
              </label>

              <select
                name="role"
                value={form.role}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-200 px-4 py-3 outline-none focus:border-[#0A2540]"
              >
                <option value="student">Student</option>
                <option value="teacher">Teacher</option>
              </select>
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
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  required
                  minLength={6}
                  placeholder="At least 6 characters"
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
              className="w-full rounded-lg bg-[#0A2540] px-4 py-3 font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <button
            onClick={() => navigate('/login')}
            className="mt-5 w-full text-center text-sm font-medium text-[#0A2540] hover:underline"
          >
            Already have an account? Sign in
          </button>
        </div>
      </div>
    </div>
  )
}

export default UserRegister