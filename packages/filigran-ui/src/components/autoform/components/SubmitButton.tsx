import React from 'react'
import {Button} from '../../servers'

export const SubmitButton: React.FC<{children: React.ReactNode}> = ({
  children,
}) => <Button type="submit">{children}</Button>
