import { Suspense } from 'react'
import { AuthForm } from '@/components/auth/auth-form'

export const metadata = {
  title: 'Sign Up - ContractIQ',
  description: 'Create your ContractIQ account',
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AuthForm mode="signup" />
    </Suspense>
  )
}
