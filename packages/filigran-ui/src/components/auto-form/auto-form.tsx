'use client'
import {
  type DefaultValues,
  type FormState,
  useForm,
  type UseFormReturn,
} from 'react-hook-form'
import {z} from 'zod'

import {zodResolver} from '@hookform/resolvers/zod'

import {type FunctionComponent, useEffect} from 'react'
import {cn} from '../../lib/utils'
import {Form} from '../clients'
import {Button} from '../servers'
import AutoFormObject from './fields/object'
import type {Dependency, FieldConfig} from './types'
import {
  getDefaultValues,
  getObjectFormSchema,
  type ZodObjectOrWrapped,
} from './utils'

const AutoFormSubmit = ({
  children,
  className,
  disabled,
}: {
  children?: React.ReactNode
  className?: string
  disabled?: boolean
}) => {
  return (
    <Button
      type="submit"
      disabled={disabled}
      className={className}>
      {children ?? 'Submit'}
    </Button>
  )
}

export interface AutoFormProps<T extends ZodObjectOrWrapped> {
  formSchema: T
  values?: Partial<z.infer<T>>
  onValuesChange?: (
    values: Partial<z.infer<T>>,
    form: UseFormReturn<z.infer<T>>
  ) => void
  onParsedValuesChange?: (
    values: Partial<z.infer<T>>,
    form: UseFormReturn<z.infer<T>>
  ) => void
  onSubmit?: (
    values: z.infer<T>,
    form: UseFormReturn<z.infer<T>>
  ) => void
  fieldConfig?: FieldConfig<z.infer<T>>
  children?:
    | React.ReactNode
    | ((formState: FormState<z.infer<T>>) => React.ReactNode)
  className?: string
  dependencies?: Dependency<z.infer<T>>[]
}

const AutoForm = <SchemaType extends ZodObjectOrWrapped>({
  formSchema,
  values: valuesProp,
  onValuesChange: onValuesChangeProp,
  onParsedValuesChange,
  onSubmit: onSubmitProp,
  fieldConfig,
  children,
  className,
  dependencies,
}: AutoFormProps<SchemaType> ) => {

  const objectFormSchema = getObjectFormSchema(formSchema)
  const defaultValues: DefaultValues<z.infer<typeof objectFormSchema>> | null =
    getDefaultValues(objectFormSchema, fieldConfig)

  const form = useForm<z.infer<typeof objectFormSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: defaultValues ?? undefined,
    values: valuesProp,
  })

  function onSubmit(values: z.infer<typeof formSchema>) {
    const parsedValues = formSchema.safeParse(values)
    if (parsedValues.success) {
      onSubmitProp?.(parsedValues.data, form)
    }
  }

  useEffect(() => {
    const subscription = form.watch((values) => {
      onValuesChangeProp?.(values, form)
      const parsedValues = formSchema.safeParse(values)
      if (parsedValues.success) {
        onParsedValuesChange?.(parsedValues.data, form)
      }
    })

    return () => subscription.unsubscribe()
  }, [form, formSchema, onValuesChangeProp, onParsedValuesChange])

  const renderChildren =
    typeof children === 'function'
      ? children(form.formState as FormState<z.infer<SchemaType>>)
      : children

  return (
    <div className="w-full">
      <Form {...form}>
        <form
          onSubmit={(e) => {
            form.handleSubmit(onSubmit)(e)
          }}
          className={cn('space-y-5', className)}>
          <AutoFormObject
            schema={objectFormSchema}
            form={form}
            dependencies={dependencies}
            fieldConfig={fieldConfig}
          />

          {renderChildren}
        </form>
      </Form>
    </div>
  )
}

export {AutoForm, AutoFormSubmit}
