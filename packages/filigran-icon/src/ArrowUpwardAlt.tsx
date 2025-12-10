import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgArrowUpwardAlt = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 12 13"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <mask
      id="arrow_upward_alt_svg__a"
      width={24}
      height={24}
      x={-6}
      y={-5}
      maskUnits="userSpaceOnUse"
      style={{
        maskType: "alpha",
      }}
    >
      <path fill="currentColor" d="M-6-5h24v24H-6z" />
    </mask>
    <g mask="url(#arrow_upward_alt_svg__a)">
      <path
        fill="currentColor"
        d="M5 13V3.8L1.4 7.4 0 6l6-6 6 6-1.4 1.4L7 3.8V13z"
      />
    </g>
  </svg>
);
export default SvgArrowUpwardAlt;
