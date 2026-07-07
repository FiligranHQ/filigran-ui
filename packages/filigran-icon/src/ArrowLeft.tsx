import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgArrowLeft = ({
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
      d="m13.85 16.45-3.625-3.625a.8.8 0 0 1-.175-.25.7.7 0 0 1-.05-.275q0-.15.05-.275a.8.8 0 0 1 .175-.25L13.85 8.15A.47.47 0 0 1 14.2 8q.2 0 .35.137.15.138.15.363v7.6q0 .224-.15.362a.5.5 0 0 1-.35.138q-.05 0-.35-.15"
    />
  </svg>
);
export default SvgArrowLeft;
