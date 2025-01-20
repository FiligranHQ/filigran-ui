import type {FunctionComponent} from 'react'

export const ErrorMessage: FunctionComponent<{error: string}> = ({error}) => (
  <Alert variant="destructive">
    <AlertTitle>{error}</AlertTitle>
  </Alert>
)
