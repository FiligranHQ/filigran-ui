import Link from 'next/link'
import {getAllContents} from '@/utils/mdx.util'
import {Card, Badge} from 'filigran-ui/servers'

export default async function ComponentsPage() {
  let allContents = await getAllContents()

  // Group components by category
  const categories = {
    'Core': ['button', 'badge', 'card', 'callout'],
    'Forms': ['input', 'checkbox', 'select', 'radio', 'textarea', 'switch'],
    'Navigation': ['link', 'breadcrumb', 'pagination', 'tabs'],
    'Feedback': ['alert', 'progress', 'toast', 'spinner'],
    'Layout': ['container', 'grid', 'box', 'divider'],
    'Data Display': ['table', 'list', 'tooltip', 'avatar']
  };

  // Function to determine component category
  const getComponentCategory = (slug: string): string => {
    for (const [category, components] of Object.entries(categories)) {
      if (components.some(comp => slug.includes(comp))) {
        return category;
      }
    }
    return 'Other';
  };

  // Group contents by category
  const contentsByCategory: Record<string, Array<typeof allContents[number] & { description?: string }>> = {};
  allContents.forEach(content => {
    const category: string = getComponentCategory(content.slug);
    if (!contentsByCategory[category]) {
      contentsByCategory[category] = [];
    }
    contentsByCategory[category].push(content);
  });


  return (
    <div className="container mx-auto max-w-6xl py-12">
      <div className="mb-12 text-center">
        <h1 className="mb-4 text-4xl font-bold tracking-tight">Component Library</h1>
        <p className="mx-auto max-w-3xl text-lg text-muted-foreground">
          Explore our comprehensive collection of UI components designed for building
          modern and accessible user interfaces.
        </p>
      </div>

      {Object.entries(contentsByCategory).map(([category, contents]) => (
        <div key={category} className="mb-12">
          <div className="mb-6 flex items-center">
            <h2 className="txt-title font-semibold">{category}</h2>
            <Badge variant="outline" className="ml-3">
              {contents.length} {contents.length === 1 ? 'component' : 'components'}
            </Badge>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {contents.map((content) => (
              <Link
                key={content.slug}
                href={`/docs/${content.slug}`}
                className="block transition-all hover:scale-[1.01]">
                <Card className="h-full overflow-hidden p-6 hover:border-primary/50">
                  <div className="flex flex-col justify-between space-y-4">
                    <div>
                      <h3 className="mb-2 text-xl font-medium capitalize">
                        {content.slug.split('/').pop()?.replace(/-/g, ' ') || content.slug}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {(content as any).description || `Documentation and examples for the ${content.slug.split('/').pop()?.replace(/-/g, ' ') || content.slug} component.`}
                      </p>
                    </div>
                    <div className="flex items-center text-sm text-primary">
                      View documentation
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="ml-1 h-4 w-4">
                        <path d="M5 12h14"></path>
                        <path d="m12 5 7 7-7 7"></path>
                      </svg>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      ))}

      {allContents.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <h3 className="mb-2 text-xl font-medium">No components found</h3>
          <p className="text-muted-foreground">
            It looks like there are no component documentations available yet.
          </p>
        </div>
      )}
    </div>
  )
}
