import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgTool = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 25 24"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <path
      fill="currentColor"
      d="M19.514 4c1.14 0 2.054.9 2.054 2v12c0 .53-.217 1.04-.602 1.414a2.08 2.08 0 0 1-1.453.586H5.136c-1.14 0-2.054-.9-2.054-2V6c0-.53.216-1.04.602-1.414A2.08 2.08 0 0 1 5.135 4zm0 14V8H5.135v10z"
    />
  </svg>
);
export default SvgTool;
