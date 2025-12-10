import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgCheckBold = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 18 14"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <mask
      id="check_bold_svg__a"
      width={26}
      height={25}
      x={-4}
      y={-6}
      maskUnits="userSpaceOnUse"
      style={{
        maskType: "alpha",
      }}
    >
      <path fill="currentColor" d="M-3.067-5.179h24.134v24.134H-3.067z" />
    </mask>
    <g mask="url(#check_bold_svg__a)">
      <path
        fill="currentColor"
        d="M6.536 13.726 0 7.19l2.263-2.263 4.273 4.274L15.737 0 18 2.263z"
      />
    </g>
  </svg>
);
export default SvgCheckBold;
