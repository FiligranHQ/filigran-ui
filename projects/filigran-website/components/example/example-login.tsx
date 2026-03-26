'use client'

import {useState} from 'react'
import {
  LoginPage,
  LoginLayout,
  LoginForm,
  LoginAlert,
  LoginConsent,
  LoginSSOButton,
  LoginSSOGroup,
  type SSOProvider,
} from '@filigran/ui/clients'
import {Button} from '@filigran/ui'

const ssoProviders: SSOProvider[] = [
  {
    name: 'Google',
    provider: 'google',
    href: '#',
    buttonLabel: 'Sign in with Google',
  },
  {
    name: 'GitHub',
    provider: 'github',
    href: '#',
    buttonLabel: 'Sign in with GitHub',
  },
  {
    name: 'SAML',
    provider: 'saml',
    href: '#',
  },
]

export const ExampleLoginPage = () => {
  const [error, setError] = useState<string | undefined>()

  const handleSubmit = async (values: {email: string; password: string}) => {
    setError(undefined)
    await new Promise((resolve) => setTimeout(resolve, 1000))
    if (values.password !== 'password') {
      setError('Invalid credentials. Try password: "password"')
    } else {
      setError(undefined)
      alert(`Login successful! Email: ${values.email}`)
    }
  }

  return (
    <div className="not-prose h-[500px] overflow-hidden rounded-lg border">
      <LoginPage
        onSubmit={handleSubmit}
        providers={ssoProviders}
        error={error}
        logo={
          <span className="text-xl font-semibold">My App</span>
        }
        onForgotPassword={() => alert('Forgot password clicked')}
        onSSOClick={(provider) =>
          alert(`SSO clicked: ${provider.name}`)
        }
      />
    </div>
  )
}

export const ExampleLoginPageWithConsent = () => {
  return (
    <div className="not-prose h-[500px] overflow-hidden rounded-lg border">
      <LoginPage
        onSubmit={(values) => alert(JSON.stringify(values))}
        providers={ssoProviders}
        consentMessage="By logging in, you agree to our Terms of Service and Privacy Policy. Your data will be processed in accordance with our data processing agreement."
        logo={
          <span className="text-xl font-semibold">My App</span>
        }
      />
    </div>
  )
}

export const ExampleLoginAlert = () => {
  return (
    <div className="not-prose space-y-2">
      <LoginAlert variant="error">
        Invalid credentials. Please try again.
      </LoginAlert>
      <LoginAlert variant="warning">
        Your session has expired. Please log in again.
      </LoginAlert>
      <LoginAlert variant="info">
        A new version is available. Please refresh.
      </LoginAlert>
      <LoginAlert variant="success">
        Your password has been updated successfully.
      </LoginAlert>
    </div>
  )
}

export const ExampleLoginForm = () => {
  const [error, setError] = useState<string | undefined>()

  return (
    <div className="not-prose mx-auto max-w-md rounded-lg border bg-card p-6">
      <LoginForm
        onSubmit={(values) => {
          setError(undefined)
          if (values.password !== 'password') {
            setError('Invalid credentials')
          } else {
            alert(`Success! ${values.email}`)
          }
        }}
        onForgotPassword={() => alert('Forgot password')}
        error={error}
      />
    </div>
  )
}

export const ExampleLoginConsent = () => {
  const [checked, setChecked] = useState(false)

  return (
    <div className="not-prose mx-auto max-w-md">
      <LoginConsent
        message="By logging in, you agree to our Terms of Service and Privacy Policy."
        checked={checked}
        onCheckedChange={setChecked}
      />
      <p className="mt-2 text-sm text-muted-foreground">
        Consent accepted: {checked ? 'Yes' : 'No'}
      </p>
    </div>
  )
}

export const ExampleLoginSSOGroup = () => {
  return (
    <div className="not-prose mx-auto max-w-md">
      <LoginSSOGroup
        providers={ssoProviders}
        onProviderClick={(provider) =>
          alert(`Clicked: ${provider.name}`)
        }
      />
    </div>
  )
}

export const ExampleLoginLayout = () => {
  return (
    <div className="not-prose h-[500px] overflow-hidden rounded-lg border">
      <LoginLayout
        logo={
          <span className="text-xl font-semibold">My App</span>
        }>
        <div className="rounded-lg border bg-card p-6 text-center text-card-foreground">
          <p>Your login content goes here</p>
        </div>
      </LoginLayout>
    </div>
  )
}
