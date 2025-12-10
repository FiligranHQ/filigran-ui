import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgArrowLast = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 12 14"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <mask
      id="arrow_last_svg__a"
      width={24}
      height={25}
      x={-6}
      y={-5}
      maskUnits="userSpaceOnUse"
      style={{
        maskType: "alpha",
      }}
    >
      <path fill="currentColor" d="M-6-4.999h24v24H-6z" />
    </mask>
    <g fill="currentColor" mask="url(#arrow_last_svg__a)">
      <path d="M0 14V0l11 7z" />
      <path d="M11.5 14h-2V0h2z" />
    </g>
  </svg>
);
export default SvgArrowLast;
