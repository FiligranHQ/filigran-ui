import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgArrowDropDown = ({
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
      d="M11.475 14.125 7.85 10.5a.47.47 0 0 1-.15-.35q0-.2.137-.35.138-.15.363-.15h7.6q.224 0 .363.15.137.15.137.35 0 .05-.15.35l-3.625 3.625a.8.8 0 0 1-.25.175.7.7 0 0 1-.275.05.7.7 0 0 1-.275-.05.8.8 0 0 1-.25-.175"
    />
  </svg>
);
export default SvgArrowDropDown;
