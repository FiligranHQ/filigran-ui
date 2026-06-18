import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgPapermap = ({
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
      d="m15 21-6-2.1-4.65 1.8a.9.9 0 0 1-.925-.113A.99.99 0 0 1 3 19.75v-14q0-.325.188-.575A1.13 1.13 0 0 1 3.7 4.8L9 3l6 2.1 4.65-1.8a.9.9 0 0 1 .925.113.99.99 0 0 1 .425.837v14a.93.93 0 0 1-.187.575 1.13 1.13 0 0 1-.513.375zm-1-2.45V6.85l-4-1.4v11.7zm2 0 3-1V5.7l-3 1.15zM5 18.3l3-1.15V5.45l-3 1z"
    />
  </svg>
);
export default SvgPapermap;
