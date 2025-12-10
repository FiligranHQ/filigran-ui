import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgOpinion = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <g clipPath="url(#opinion_svg__a)">
      <path
        fill="currentColor"
        d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2m0 14H5.17l-.59.59-.58.58V4h16zm-9-4h2v2h-2zm0-6h2v4h-2z"
      />
    </g>
    <defs>
      <clipPath id="opinion_svg__a">
        <path fill="#fff" d="M0 0h24v24H0z" />
      </clipPath>
    </defs>
  </svg>
);
export default SvgOpinion;
