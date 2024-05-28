import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgNarrative = ({
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
      d="M19.474 2H3.894c-.516 0-1.011.21-1.376.586-.365.375-.57.884-.57 1.414v18l3.894-4h13.632c.516 0 1.011-.21 1.377-.586.365-.375.57-.884.57-1.414V4c0-.53-.205-1.04-.57-1.414A1.92 1.92 0 0 0 19.474 2M7.789 14H5.842v-2H7.79zm0-3H5.842V9H7.79zm0-3H5.842V6H7.79zm6.816 6H9.737v-2h4.868zm2.921-3h-7.79V9h7.79zm0-3h-7.79V6h7.79z"
    />
  </svg>
);
export default SvgNarrative;
