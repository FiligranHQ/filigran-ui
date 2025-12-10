import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgCaseIncident = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <path
      fill="currentColor"
      d="M16.553 18c.584 0 .973.4.973 1s-.39 1-.973 1c-.585 0-.974-.4-.974-1s.39-1 .974-1m0-3c-2.63 0-4.966 1.7-5.843 4 .877 2.3 3.214 4 5.843 4s4.965-1.7 5.842-4c-.877-2.3-3.213-4-5.842-4m0 6.5c-1.364 0-2.435-1.1-2.435-2.5s1.072-2.5 2.435-2.5 2.434 1.1 2.434 2.5-1.071 2.5-2.434 2.5M8.86 19.7l-.293-.7H3.895V8h15.579v5.6c.681.3 1.363.6 1.947 1.1V8a2 2 0 0 0-.584-1.4c-.39-.4-.78-.6-1.363-.6h-3.895V4c0-.6-.195-1-.584-1.4-.39-.4-.78-.6-1.363-.6H9.737c-.584 0-.974.2-1.363.6-.39.4-.585.8-.585 1.4v2H3.895c-.584 0-.974.2-1.363.6A2 2 0 0 0 1.947 8v11a2 2 0 0 0 .585 1.4c.39.4.779.6 1.363.6h5.647c-.292-.4-.487-.8-.681-1.3M9.737 4h3.895v2H9.737z"
    />
  </svg>
);
export default SvgCaseIncident;
