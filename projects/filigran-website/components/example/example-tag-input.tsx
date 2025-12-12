'use client'
import {z} from 'zod'
import {useForm} from 'react-hook-form'
import {zodResolver} from '@hookform/resolvers/zod'
import React, {useState} from 'react'
import {Button} from '@filigran/ui/servers'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Tag,
  TagInput,
  toast,
} from '@filigran/ui/clients'

const FormSchema = z.object({
  topics: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
    })
  ),
})

export const ExampleTagInput = () => {
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
  })

  const autoCompleteTags = [
    {
      id: '1307721023',
      text: 'Sports',
    },
    {
      id: '3498601201',
      text: 'Programming',
    },
    {
      id: '455992240',
      text: 'Travel',
    },
  ]

  const [tags, setTags] = useState<Tag[]>([])
  const [activeTagIndex, setActiveTagIndex] = useState<number | null>(null)
  const {setValue} = form

  const [exampleTags, setExampleTags] = useState<Tag[]>([])
  const [activeExampleTagIndex, setExampleActiveTagIndex] = useState<
    number | null
  >(null)
  const {setValue: setExampleValue} = form

  function onSubmit(data: z.infer<typeof FormSchema>) {
    toast({
      title: 'You submitted the following values:',
      description: (
        <pre className="mt-2 w-[340px] rounded-md bg-slate-950 p-4">
          <code className="text-white">{JSON.stringify(data, null, 2)}</code>
        </pre>
      ),
    })
  }

  return (
    <>
      <h2 className={'txt-title'}> Basic use</h2>
      <section className="z-10 flex w-full max-w-5xl flex-col items-center gap-5 text-center">
        <div
          id="try"
          className="w-full py-8">
          <div className="relative my-4 flex w-full flex-col space-y-s">
            <div className="preview relative mt-2 flex min-h-[350px] w-full items-center justify-center rounded-md border p-10 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="flex flex-col items-start space-y-8">
                  <FormField
                    control={form.control}
                    name="topics"
                    render={({field}) => (
                      <FormItem className="flex flex-col items-start">
                        <FormLabel className="text-left">Topics</FormLabel>
                        <FormControl>
                          <TagInput
                            {...field}
                            placeholder="Enter a topic"
                            tags={tags}
                            className="sm:min-w-[450px]"
                            activeTagIndex={activeTagIndex}
                            setActiveTagIndex={setActiveTagIndex}
                            setTags={(newTags) => {
                              setTags(newTags)
                              setValue('topics', newTags as [Tag, ...Tag[]])
                            }}
                          />
                        </FormControl>
                        <FormDescription>
                          These are the topics that you&apos;re interested in.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit">Submit</Button>
                </form>
              </Form>
            </div>
          </div>
        </div>
      </section>
      <h2 className={'txt-title'}> With autocomplete</h2>
      <section className="z-10 flex w-full max-w-5xl flex-col items-center gap-5 text-center">
        <div
          id="try"
          className="w-full py-8">
          <div className="relative my-4 flex w-full flex-col space-y-s">
            <div className="preview relative mt-2 flex min-h-[350px] w-full items-center justify-center rounded-md border p-10 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="flex flex-col items-start space-y-8">
                  <FormField
                    control={form.control}
                    name="topics"
                    render={({field}) => (
                      <FormItem className="flex flex-col items-start">
                        <FormLabel className="text-left">Topics</FormLabel>
                        <FormControl>
                          <TagInput
                            {...field}
                            placeholder="Enter a topic"
                            tags={exampleTags}
                            className="sm:min-w-[450px]"
                            activeTagIndex={activeExampleTagIndex}
                            setActiveTagIndex={setExampleActiveTagIndex}
                            enableAutocomplete={true}
                            autocompleteOptions={autoCompleteTags}
                            setTags={(newTags) => {
                              setExampleTags(newTags)
                              setExampleValue(
                                'topics',
                                newTags as [Tag, ...Tag[]]
                              )
                            }}
                          />
                        </FormControl>
                        <FormDescription>
                          These are the topics that you&apos;re interested in.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit">Submit</Button>
                </form>
              </Form>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
