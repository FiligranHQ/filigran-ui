import {AddIcon, CloseIcon, DeleteIcon} from 'filigran-icon'
import {useFieldArray, useForm} from 'react-hook-form'
import * as z from 'zod'
import {
  Label,
} from '../../clients'
import {Button} from '../../servers'
import {beautifyObjectName} from '../utils'
import AutoFormObject from './object'
import {cn} from '../../../lib/utils'

function isZodArray(
  item: z.ZodArray<any> | z.ZodDefault<any>
): item is z.ZodArray<any> {
  return item._def.typeName === "ZodArray"
}

function isZodDefault(
  item: z.ZodArray<any> | z.ZodDefault<any>
): item is z.ZodDefault<any> {
  return item._def?.typeName === "ZodDefault";
}

export default function AutoFormArray({
  name,
  item,
  form,
  path = [],
  fieldConfig,
}: {
  name: string
  item: z.ZodArray<any> | z.ZodDefault<any>
  form: ReturnType<typeof useForm>
  path?: string[]
  fieldConfig?: any
}) {
  const {fields, append, remove} = useFieldArray({
    control: form.control,
    name,
  })
  const title = item._def.description ?? beautifyObjectName(name)

  const itemDefType = isZodArray(item)
    ? item._def.type
    : isZodDefault(item)
      ? item._def.innerType._def.type
      : null

  return (
    <div>
      <div className="flex gap-s items-center">
        <Label>{title}</Label><Button
        type="button"
        size="icon"
        variant="ghost"
        onClick={() => append({})}
        className="text-secondary">
        <AddIcon className="h-3 w-3" />
      </Button>
      </div>
      <div
        className={cn(
        '!mt-m px-l py-m space-y-s',
        fields.length > 0 && 'border border-primary rounded'
      )}>
        {fields.map((_field, index) => {
          const key = _field.id
          return (
            <div className="mt-s flex gap-s" key={key}>
              <AutoFormObject
                schema={itemDefType as z.ZodObject<any, any>}
                form={form}
                fieldConfig={fieldConfig}
                path={[...path, index.toString()]}
              />
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  onClick={() => remove(index)}>
                  <DeleteIcon className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
