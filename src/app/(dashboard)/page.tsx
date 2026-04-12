import { redirect } from 'next/navigation'

export default function DeprecatedHome() {
  redirect('/dashboard')
}
