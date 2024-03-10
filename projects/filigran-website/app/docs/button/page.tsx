'use client'
import ReactLiveDisplay from '@/components/react-live/ReactLiveDisplay'
import {Button} from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export default function Page() {
  const scope = {Button}
  const codeExemple = `
          <div className={tw(\`flex gap-2\`)}>
            <Button> Primary/Default </Button>
            <Button variant="secondary"> Secondary </Button>
            <Button variant="destructive"> Destructive </Button>
            <Button variant="outline"> Outline </Button>
            <Button variant="ghost"> Ghost </Button>
            <Button variant="link"> Link </Button>
          </div>`
  return (
    <section className="prose mx-auto max-w-4xl flex-1 py-4 dark:prose-invert">
      <h1>Button</h1>
      <p>Displays a button or a component that looks like a button.</p>
      <strong>Variant attribute</strong>: This attribute defines the visual
      style of the button. Here are the different variants and their
      characteristics:
      <ul>
        <li>
          Primary/Default: This is often the most prominent and visually
          distinct button, typically used for the main action the user should
          take.
        </li>
        <li>
          variant=&quot;secondary&quot;: This button has a less prominent visual
          style compared to the primary button, often used for secondary actions
          or alternative options.
        </li>
        <li>
          variant=&quot;destructive&quot;: This button usually has a red color
          and conveys a destructive action, like deleting or canceling
          something. Use it with caution to avoid accidental actions.
        </li>
        <li>
          variant=&quot;outline&quot;: This button has a border around the text
          instead of a filled background, providing a lighter and less visually
          dominant element.
        </li>
        <li>
          variant=&quot;ghost&quot;: This button has minimal styling, often with
          only text and a subtle hover effect, making it appear transparent on
          the page.
        </li>
        <li>
          variant=&quot;link&quot;: This button resembles a text link, typically
          underlined and changing color on hover. It's suitable for actions that
          navigate to another page or trigger an external link.
        </li>
      </ul>
      <h2>Props</h2>
      <Table>
        <TableCaption>Component props.</TableCaption>
        <TableHeader className="font-bold">
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Default</TableHead>
            <TableHead>Description</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Variant</TableCell>
            <TableCell>Secondary, Destructive, Outline, Ghost, Link</TableCell>
            <TableCell>Primary</TableCell>
            <TableCell>
              This attribute defines the visual style of the button. Here are
              the different variants and their characteristics
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
      <h2>Playground</h2>
      <ReactLiveDisplay
        scope={scope}
        codeExample={codeExemple}
      />
    </section>
  )
}
