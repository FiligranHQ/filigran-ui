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
    value: 'preact',
    label: 'Preact',
  },
  {
    value: 'astro',
    label: 'Astro',
  },
  {
    value: 'vue.js',
    label: 'Vue.js',
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
    value: 'qwik',
    label: 'Qwik',
  },
  {
    value: 'remix',
    label: 'Remix',
  },
  {
    value: 'react',
    label: 'React',
  },
  {
    value: 'angular',
    label: 'Angular',
  },
  {
    value: 'solidjs',
    label: 'SolidJS',
  },
  {
    value: 'lit',
    label: 'Lit',
  },
  {
    value: 'marko',
    label: 'Marko',
  },
  {
    value: 'stimulus',
    label: 'Stimulus',
  },
  {
    value: 'alpinejs',
    label: 'Alpine.js',
  },
  {
    value: 'ember',
    label: 'Ember.js',
  },
  {
    value: 'backbone',
    label: 'Backbone.js',
  },
  {
    value: 'inferno',
    label: 'Inferno',
  },
  {
    value: 'riot',
    label: 'Riot.js',
  },
  {
    value: 'mithril',
    label: 'Mithril.js',
  },
  {
    value: 'dojo',
    label: 'Dojo',
  },
  {
    value: 'ractive',
    label: 'Ractive.js',
  },
  {
    value: 'vuepress',
    label: 'VuePress',
  },
  {
    value: 'eleventy',
    label: 'Eleventy (11ty)',
  },
  {
    value: 'blitz',
    label: 'Blitz.js',
  },
  {
    value: 'sapper',
    label: 'Sapper',
  },
  {
    value: 'hydrogen',
    label: 'Hydrogen',
  },
  {
    value: 'redwoodjs',
    label: 'RedwoodJS',
  },
]

const FormSchema = z.object({
  frameworks: z.array(z.string()).min(1),
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
  {
    id: 'ember',
    name: 'Ember.js',
  },
  {
    id: 'backbone',
    name: 'Backbone.js',
  },
  {
    id: 'inferno',
    name: 'Inferno',
  },
  {
    id: 'riot',
    name: 'Riot.js',
  },
  {
    id: 'mithril',
    name: 'Mithril.js',
  },
  {
    id: 'dojo',
    name: 'Dojo',
  },
  {
    id: 'ractive',
    name: 'Ractive.js',
  },
  {
    id: 'vuepress',
    name: 'VuePress',
  },
  {
    id: 'eleventy',
    name: 'Eleventy (11ty)',
  },
  {
    id: 'blitz',
    name: 'Blitz.js',
  },
  {
    id: 'sapper',
    name: 'Sapper',
  },
  {
    id: 'hydrogen',
    name: 'Hydrogen',
  },
  {
    id: 'redwoodjs',
    name: 'RedwoodJS',
  },
]

const FormSchemaCustomKeys = z.object({
  languages: z.array(z.string()).min(1),
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
        <form className="w-1/2 space-y-8">
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
                    onInputChange={(value) => console.log('input', value)}
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
      <div className="mt-10 w-1/2">
        <h3 className="mb-4 text-lg font-medium">
          Example with custom keyValue and keyLabel
        </h3>
        <Form {...formCustomKeys}>
          <form className="space-y-8">
            <FormField
              control={formCustomKeys.control}
              name="languages"
              render={({field}) => (
                <FormItem>
                  <FormLabel>Programming Languages</FormLabel>
                  <FormControl>
                    <MultiSelectFormField
                      options={languagesList}
                      defaultValue={field.value}
                      onValueChange={field.onChange}
                      onInputChange={(value) => console.log('input', value)}
                      placeholder="Select languages"
                      noResultString={'No results found'}
                      variant="inverted"
                      keyValue="id"
                      keyLabel="name"
                    />
                  </FormControl>
                  <FormDescription>
                    Choose the programming languages you are proficient in.
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
