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
import {MultiSelectFormField} from 'filigran-ui/clients'

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

// Exemple avec des clés personnalisées
const languagesList = [
  {
    id: 'js',
    name: 'JavaScript',
  },
  {
    id: 'ts',
    name: 'TypeScript',
  },
  {
    id: 'py',
    name: 'Python',
  },
  {
    id: 'rb',
    name: 'Ruby',
  },
]

const FormSchemaCustomKeys = z.object({
  languages: z
    .array(z.string().min(1))
    .min(1)
    .nonempty('Veuillez sélectionner au moins un langage.'),
})

export function ExampleMultiSelect() {
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      frameworks: ['next.js', 'nuxt.js', 'remix'],
    },
  })

  const formCustomKeys = useForm<z.infer<typeof FormSchemaCustomKeys>>({
    resolver: zodResolver(FormSchemaCustomKeys),
    defaultValues: {
      languages: ['js', 'ts'],
    },
  })

  return (
    <>
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

      <div className="mt-10">
        <h3 className="text-lg font-medium mb-4">Exemple avec keyValue et keyLabel personnalisés</h3>
        <Form {...formCustomKeys}>
          <form className="space-y-8">
            <FormField
              control={formCustomKeys.control}
              name="languages"
              render={({field}) => (
                <FormItem>
                  <FormLabel>Langages de programmation</FormLabel>
                  <FormControl>
                    <MultiSelectFormField
                      options={languagesList}
                      defaultValue={field.value}
                      onValueChange={field.onChange}
                      placeholder="Sélectionner des langages"
                      noResultString={'Aucun résultat trouvé'}
                      variant="inverted"
                      keyValue="id"
                      keyLabel="name"
                    />
                  </FormControl>
                  <FormDescription>
                    Choisissez les langages de programmation que vous maîtrisez.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
      </div>
    </>
  )
}
