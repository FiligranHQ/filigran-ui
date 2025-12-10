import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgKeyboardArrowUp = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 12 8"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <mask
      id="keyboard_arrow_up_svg__a"
      width={24}
      height={24}
      x={-6}
      y={-8}
      maskUnits="userSpaceOnUse"
      style={{
        maskType: "alpha",
      }}
    >
      <path fill="currentColor" d="M-6-8h24v24H-6z" />
    </mask>
    <g mask="url(#keyboard_arrow_up_svg__a)">
      <path fill="currentColor" d="M6 2.8 1.4 7.4 0 6l6-6 6 6-1.4 1.4z" />
    </g>
  </svg>
);
export default SvgKeyboardArrowUp;
