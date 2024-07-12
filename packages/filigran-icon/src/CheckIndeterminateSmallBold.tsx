import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgCheckIndeterminateSmallBold = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 14 4"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <mask
      id="check_indeterminate_small_bold_svg__a"
      width={26}
      height={25}
      x={-6}
      y={-11}
      maskUnits="userSpaceOnUse"
      style={{
        maskType: "alpha",
      }}
    >
      <path fill="currentColor" d="M-5.263-10.653h24.526v24.526H-5.263z" />
    </mask>
    <g mask="url(#check_indeterminate_small_bold_svg__a)">
      <path fill="currentColor" d="M0 3.219V0h14v3.219z" />
    </g>
  </svg>
);
export default SvgCheckIndeterminateSmallBold;
