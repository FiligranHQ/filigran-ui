import * as React from "react";
import type { SVGProps } from "react";
interface SVGRProps {
  title?: string;
  titleId?: string;
}
const SvgScience = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 35 35"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <g clipPath="url(#science_svg__a)">
      <path
        fill="currentColor"
        d="m28.875 26.833-8.458-11.272V9.479l1.968-2.464a.726.726 0 0 0-.568-1.182h-8.634c-.612 0-.948.7-.568 1.182l1.968 2.464v6.082L6.125 26.833c-.715.963-.03 2.334 1.167 2.334h20.416c1.196 0 1.882-1.371 1.167-2.334"
      />
    </g>
    <defs>
      <clipPath id="science_svg__a">
        <path fill="#fff" d="M0 0h35v35H0z" />
      </clipPath>
    </defs>
  </svg>
);
export default SvgScience;
