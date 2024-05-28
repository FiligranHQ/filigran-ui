import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgRelationship = ({
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
      d="M2 4h2V2h6v2a10 10 0 0 1 10 10h2v6h-2v2h-2v-2h-2v-6h2a8 8 0 0 0-8-8v2H4V6H2zm16 12v2h2v-2zM6 4v2h2V4z"
    />
  </svg>
);
export default SvgRelationship;
