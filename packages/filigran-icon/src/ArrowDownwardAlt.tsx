import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgArrowDownwardAlt = ({
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
      id="arrow_downward_alt_svg__a"
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
    <g mask="url(#arrow_downward_alt_svg__a)">
      <path
        fill="currentColor"
        d="M6 13 0 7l1.4-1.4L5 9.2V0h2v9.2l3.6-3.6L12 7z"
      />
    </g>
  </svg>
);
export default SvgArrowDownwardAlt;
