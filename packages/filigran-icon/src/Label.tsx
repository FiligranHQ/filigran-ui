import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgLabel = ({
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
      d="M16 17H5V7h11l3.55 5m-1.92-6.16C17.27 5.33 16.67 5 16 5H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h11c.67 0 1.27-.34 1.63-.85L22 12z"
    />
  </svg>
);
export default SvgLabel;
