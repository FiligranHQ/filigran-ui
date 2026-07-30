import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgWarning = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 16 16"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <path
      fill="currentColor"
      d="M.667 14 8 1.333 15.333 14zm2.3-1.333h10.066L8 4zm5.508-.859a.65.65 0 0 0 .192-.475.65.65 0 0 0-.192-.475.65.65 0 0 0-.475-.191.65.65 0 0 0-.475.191.65.65 0 0 0-.192.475q0 .285.192.475A.65.65 0 0 0 8 12a.65.65 0 0 0 .475-.192M7.333 10h1.334V6.667H7.333z"
    />
  </svg>
);
export default SvgWarning;
