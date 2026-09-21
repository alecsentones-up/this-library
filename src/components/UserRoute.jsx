import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { Navigate } from 'react-router-dom'
import { auth } from '../firebase'

function UserRoute({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        setUser(currentUser)
        setLoading(false)
      }
    )

    return unsubscribe
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F9FA]">
        <div className="text-sm text-gray-500">
          Checking authentication...
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return children
}

export default UserRoute