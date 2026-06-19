import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgArrowRight = ({
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
      d="M10.5 16.6a.5.5 0 0 1-.35-.138.47.47 0 0 1-.15-.362V8.5q0-.224.15-.363A.5.5 0 0 1 10.5 8q.05 0 .35.15l3.625 3.625a.8.8 0 0 1 .175.25q.05.125.05.275t-.05.275a.8.8 0 0 1-.175.25L10.85 16.45a.47.47 0 0 1-.35.15"
    />
  </svg>
);
export default SvgArrowRight;
