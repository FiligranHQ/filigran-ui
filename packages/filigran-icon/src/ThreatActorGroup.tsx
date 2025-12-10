import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgThreatActorGroup = ({
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
      d="M13.07 10.41a5 5 0 0 0 0-5.82A3.4 3.4 0 0 1 15 4a3.5 3.5 0 1 1 0 7 3.4 3.4 0 0 1-1.93-.59M5.5 7.5a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0m2 0a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0M16 17v2H2v-2s0-4 7-4 7 4 7 4m-2 0c-.14-.78-1.33-2-5-2s-4.93 1.31-5 2m11.95-4A5.32 5.32 0 0 1 18 17v2h4v-2s0-3.63-6.06-4z"
    />
  </svg>
);
export default SvgThreatActorGroup;
