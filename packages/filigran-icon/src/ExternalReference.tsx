import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgExternalReference = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 37 38"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <g fill="currentColor" clipPath="url(#external-reference_svg__a)">
      <path d="M33.007 18.335 19.132 4.085a3.02 3.02 0 0 0-2.174-.918H6.167c-1.696 0-3.084 1.425-3.084 3.166v11.084c0 .87.34 1.662.91 2.248l13.875 14.25c.555.57 1.326.918 2.174.918s1.618-.348 2.173-.934l10.792-11.083c.57-.57.91-1.362.91-2.233 0-.87-.355-1.678-.91-2.248M20.042 31.683 6.167 17.417V6.333h10.791v-.016l13.875 14.25z" />
      <path d="M10.02 12.667c1.278 0 2.313-1.064 2.313-2.375 0-1.312-1.035-2.375-2.312-2.375S7.708 8.98 7.708 10.292c0 1.311 1.036 2.375 2.313 2.375" />
    </g>
    <defs>
      <clipPath id="external-reference_svg__a">
        <path fill="#fff" d="M0 0h37v38H0z" />
      </clipPath>
    </defs>
  </svg>
);
export default SvgExternalReference;
