import Link from 'next/link'
import {getAllContents} from '@/utils/mdx.util'

export default async function BlogPage() {
  let allContents = await getAllContents('learning')
  return (
    <section className="mx-auto max-w-4xl">
      <h1 className="mb-8 text-2xl font-medium tracking-tighter"></h1>
      {allContents.map((content) => (
        <Link
          key={content.slug}
          className="mb-4 flex flex-col space-y-1"
          href={`/learning/${content.slug}`}>
          {content.slug}
        </Link>
      ))}
    </section>
  )
}
