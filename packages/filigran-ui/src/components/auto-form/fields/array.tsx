import {AddIcon, CloseIcon} from 'filigran-icon'
import {useFieldArray, useForm} from 'react-hook-form'
import * as z from 'zod'
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Separator,
} from '../../clients'
import {Button} from '../../servers'
import {beautifyObjectName} from '../utils'
import AutoFormObject from './object'

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
    <AccordionItem
      value={name}
      className="border-none">
      <AccordionTrigger>{title}</AccordionTrigger>
      <AccordionContent>
        {fields.map((_field, index) => {
          const key = _field.id
          return (
            <div
              className="mt-4 flex flex-col"
              key={`${key}`}>
              <AutoFormObject
                schema={itemDefType as z.ZodObject<any, any>}
                form={form}
                fieldConfig={fieldConfig}
                path={[...path, index.toString()]}
              />
              <div className="my-4 flex justify-end">
                <Button
                  variant="secondary"
                  size="icon"
                  type="button"
                  className="hover:bg-zinc-300 hover:text-black focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 dark:bg-white dark:text-black dark:hover:bg-zinc-300 dark:hover:text-black dark:hover:ring-0 dark:hover:ring-offset-0 dark:focus-visible:ring-0 dark:focus-visible:ring-offset-0"
                  onClick={() => remove(index)}>
                  <CloseIcon className="h-3 w-3 " />
                </Button>
              </div>

              <Separator />
            </div>
          )
        })}
        <Button
          type="button"
          variant="secondary"
          onClick={() => append({})}
          className="mt-4 flex items-center">
          <AddIcon className="mr-2 h-3 w-3" />
          Add
        </Button>
      </AccordionContent>
    </AccordionItem>
  )
}
