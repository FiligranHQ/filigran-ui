import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgAdministrativeArea = ({
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
      d="m14.897 21-6.402-2.325-4.357 1.775a.76.76 0 0 1-.815-.025q-.402-.25-.402-.75V5.725a.95.95 0 0 1 .183-.575q.182-.25.474-.375L8.495 3l6.402 2.3 4.333-1.775a.82.82 0 0 1 .816.038q.402.237.401.737v14.125a.68.68 0 0 1-.182.475 1.14 1.14 0 0 1-.45.3zm-.827-1.875V6.5L9.299 4.85v12.625zm1.46 0 3.457-1.175V5.15L15.53 6.5zm-11.148-.3 3.456-1.35V4.85L4.382 6.025z"
    />
  </svg>
);
export default SvgAdministrativeArea;
