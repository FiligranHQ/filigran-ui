'use client'
import {z} from 'zod'
import {zodResolver} from '@hookform/resolvers/zod'
import {useForm} from 'react-hook-form'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from 'filigran-ui'
import {MultiSelectFormField} from 'filigran-ui/servers'

const frameworksList = [
  {
    value: 'next.js',
    label: 'Next.js',
  },
  {
    value: 'sveltekit',
    label: 'SvelteKit',
  },
  {
    value: 'nuxt.js',
    label: 'Nuxt.js',
  },
  {
    value: 'remix',
    label: 'Remix',
  },
]

const FormSchema = z.object({
  frameworks: z
    .array(z.string().min(1))
    .min(1)
    .nonempty('Please select at least one framework.'),
})

export function ExampleMultiSelect() {
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      frameworks: ['next.js', 'nuxt.js', 'remix'],
    },
  })
  return (
    <Form {...form}>
      <form className="space-y-8">
        <FormField
          control={form.control}
          name="frameworks"
          render={({field}) => (
            <FormItem>
              <FormLabel>Frameworks</FormLabel>
              <FormControl>
                <MultiSelectFormField
                  options={frameworksList}
                  defaultValue={field.value}
                  onValueChange={field.onChange}
                  placeholder="Select options"
                  noResultString={'You can change me!'}
                  variant="inverted"
                />
              </FormControl>
              <FormDescription>
                Choose the frameworks you are interested in.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  )
}
