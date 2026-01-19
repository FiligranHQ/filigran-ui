import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgArrowShapeUpStack = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 16 17"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <mask
      id="arrow_shape_up_stack_svg__a"
      width={24}
      height={24}
      x={-4}
      y={-3}
      maskUnits="userSpaceOnUse"
      style={{
        maskType: "alpha",
      }}
    >
      <path fill="currentColor" d="M-4-3h24v24H-4z" />
    </mask>
    <g mask="url(#arrow_shape_up_stack_svg__a)">
      <path
        fill="currentColor"
        d="M5 17v-3H0l8-9 8 9h-5v3zm2-2h2v-3h2.55L8 8l-3.55 4H7zM0 9l8-9 8 9h-2.675L8 3 2.675 9z"
      />
    </g>
  </svg>
);
export default SvgArrowShapeUpStack;
