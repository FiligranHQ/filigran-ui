import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgUnfoldMore = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 9 18"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <mask
      id="unfold_more_svg__a"
      width={25}
      height={25}
      x={-8}
      y={-4}
      maskUnits="userSpaceOnUse"
      style={{
        maskType: "alpha",
      }}
    >
      <path fill="currentColor" d="M-7.5-3.1h24v24h-24z" />
    </mask>
    <g mask="url(#unfold_more_svg__a)">
      <path
        fill="currentColor"
        d="M4.5 17.9 0 13.4l1.45-1.45L4.5 15l3.05-3.05L9 13.4zM1.45 5.95 0 4.5 4.5 0 9 4.5 7.55 5.95 4.5 2.9z"
      />
    </g>
  </svg>
);
export default SvgUnfoldMore;
