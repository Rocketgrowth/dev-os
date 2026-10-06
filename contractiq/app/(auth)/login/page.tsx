import { Suspense } from 'react'
import { AuthForm } from '@/components/auth/auth-form'

export const metadata = {
  title: 'Sign In - ContractIQ',
  description: 'Sign in to your ContractIQ account',
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AuthForm mode="login" />
    </Suspense>
  )
}
