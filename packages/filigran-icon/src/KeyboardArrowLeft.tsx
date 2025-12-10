import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgKeyboardArrowLeft = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 8 12"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <mask
      id="keyboard_arrow_left_svg__a"
      width={24}
      height={24}
      x={-8}
      y={-6}
      maskUnits="userSpaceOnUse"
      style={{
        maskType: "alpha",
      }}
    >
      <path fill="currentColor" d="M-8-6h24v24H-8z" />
    </mask>
    <g mask="url(#keyboard_arrow_left_svg__a)">
      <path fill="currentColor" d="M6 12 0 6l6-6 1.4 1.4L2.8 6l4.6 4.6z" />
    </g>
  </svg>
);
export default SvgKeyboardArrowLeft;
