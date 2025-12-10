import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgArrowRightAlt = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 16 12"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <mask
      id="arrow_right_alt_svg__a"
      width={24}
      height={24}
      x={-4}
      y={-6}
      maskUnits="userSpaceOnUse"
      style={{
        maskType: "alpha",
      }}
    >
      <path fill="currentColor" d="M-4-6h24v24H-4z" />
    </mask>
    <g mask="url(#arrow_right_alt_svg__a)">
      <path
        fill="currentColor"
        d="m10 12-1.4-1.45L12.15 7H0V5h12.15L8.6 1.45 10 0l6 6z"
      />
    </g>
  </svg>
);
export default SvgArrowRightAlt;
