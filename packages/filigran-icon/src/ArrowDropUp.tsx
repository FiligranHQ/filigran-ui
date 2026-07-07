import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgArrowDropUp = ({
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
    <path
      fill="currentColor"
      d="M8.5 14.7q-.224 0-.363-.15A.5.5 0 0 1 8 14.2q0-.05.15-.35l3.625-3.625a.8.8 0 0 1 .25-.175.7.7 0 0 1 .275-.05q.15 0 .275.05a.8.8 0 0 1 .25.175l3.625 3.625a.47.47 0 0 1 .15.35q0 .2-.137.35a.47.47 0 0 1-.363.15z"
    />
  </svg>
);
export default SvgArrowDropUp;
