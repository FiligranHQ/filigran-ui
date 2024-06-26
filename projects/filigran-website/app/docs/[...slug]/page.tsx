import {notFound} from 'next/navigation'
import {getAllContents} from '@/utils/mdx.util'
import {CustomMDX} from '@/components/mdx-component'

export async function generateStaticParams() {
  const allContents = await getAllContents()
  return allContents.map(({slug}) => ({
    slug: slug.split('/'),
  }))
}
export default async function Blog({params}: {params: {slug: string[]}}) {
  const slug = params.slug.join('/')
  const allContents = await getAllContents()
  const content = allContents.find((post) => post.slug === slug)
  if (!content) {
    notFound()
  }
  return (
    <section>
      <article>
        <CustomMDX source={content.content} />
      </article>
    </section>
  )
}
