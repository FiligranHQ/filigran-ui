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
    viewBox="0 0 12 2"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <mask
      id="check_indeterminate_small_bold_svg__a"
      width={24}
      height={24}
      x={-6}
      y={-11}
      maskUnits="userSpaceOnUse"
      style={{
        maskType: "alpha",
      }}
    >
      <path fill="currentColor" d="M-6-11h24v24H-6z" />
    </mask>
    <g mask="url(#check_indeterminate_small_bold_svg__a)">
      <path fill="currentColor" d="M0 2V0h12v2z" />
    </g>
  </svg>
);
export default SvgCheckIndeterminateSmallBold;
