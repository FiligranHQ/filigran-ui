'use client'
import React from 'react'
import {
  FileInput,
  FileInputDropZone,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from 'filigran-ui/clients'
import {z} from 'zod'
import {zodResolver} from '@hookform/resolvers/zod'
import {useForm} from 'react-hook-form'
import {Button} from 'filigran-ui'

export const newFileSchema = z.object({
  file: z.custom<FileList>(),
})

const ExampleFileInput = () => {
  const form = useForm<z.infer<typeof newFileSchema>>({
    resolver: zodResolver(newFileSchema),
    defaultValues: {
      file: undefined,
    },
  })

  const onSubmit = (values: z.infer<typeof newFileSchema>) => {
    console.log('Submitted values:', values)
  }

  return (
    <div className="space-y-2">
      <div>
        <h2>File input in a form without drop zone</h2>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-l">
            <FormField
              control={form.control}
              name="file"
              render={({field}) => {
                return (
                  <FormItem>
                    <FormLabel>File</FormLabel>
                    <FormControl>
                      <FileInput
                        {...field}
                        allowedTypes={'image/png, applicatiion/pdf'}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )
              }}
            />
            <Button type="submit">Submit</Button>
          </form>
        </Form>
      </div>
      <div>
        <h2>File input in a form with drop zone</h2>
        <FileInputDropZone>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-l">
              <FormField
                control={form.control}
                name="file"
                render={({field}) => {
                  return (
                    <FormItem>
                      <FormLabel>File</FormLabel>
                      <FormControl>
                        <FileInput
                          {...field}
                          allowedTypes={'image/png, applicatiion/pdf'}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )
                }}
              />
              <Button type="submit">Submit</Button>
            </form>
          </Form>
        </FileInputDropZone>
      </div>
      <div>
        <h2>Multiple file input</h2>
        <FileInputDropZone>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-l">
              <FormField
                control={form.control}
                name="file"
                render={({field}) => {
                  return (
                    <FormItem>
                      <FormLabel>File</FormLabel>
                      <FormControl>
                        <FileInput
                          allowedTypes={'image/png, applicatiion/pdf'}
                          multiple
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )
                }}
              />
              <Button type="submit">Submit</Button>
            </form>
          </Form>
        </FileInputDropZone>
      </div>
      <div>
        <h2>File input in sheet</h2>
        <Sheet>
          <SheetTrigger asChild>
            <Button>Upload in sheet</Button>
          </SheetTrigger>

          <SheetContent>
            <SheetHeader>
              <SheetTitle>Form upload file</SheetTitle>
              <SheetDescription>
                This is how you can upload in sheet
              </SheetDescription>
            </SheetHeader>
            <FileInputDropZone className="absolute inset-0 p-xl pt-[5rem]">
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-l">
                  <FormField
                    control={form.control}
                    name="file"
                    render={({field}) => {
                      return (
                        <FormItem>
                          <FormLabel>File</FormLabel>
                          <FormControl>
                            <FileInput
                              allowedTypes={'image/png, applicatiion/pdf'}
                              multiple
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )
                    }}
                  />
                  <SheetFooter>
                    <SheetClose asChild>
                      <Button variant={'outline'}>Cancel</Button>
                    </SheetClose>
                    <Button type="submit">Submit</Button>
                  </SheetFooter>
                </form>
              </Form>
            </FileInputDropZone>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  )
}

export default ExampleFileInput
