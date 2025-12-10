import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgCaseRft = ({
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
      d="M9.737 2h3.895c.516 0 1.011.21 1.377.586.365.375.57.884.57 1.414v2h3.895c.516 0 1.011.21 1.377.586.365.375.57.884.57 1.414v5.53a5.5 5.5 0 0 0-1.947-1.19V8H3.894v11h7.868c.117.72.36 1.39.701 2H3.895c-.517 0-1.012-.21-1.377-.586A2.03 2.03 0 0 1 1.948 19V8c0-.53.205-1.04.57-1.414C2.883 6.21 3.378 6 3.895 6h3.894V4c0-.53.206-1.04.57-1.414C8.726 2.21 9.22 2 9.738 2m3.895 4V4H9.737v2zm.447 9.88 1.383-1.42 2.064 2.13 2.064-2.13 1.383 1.42L18.9 18l2.074 2.12-1.383 1.42-2.064-2.13-2.064 2.13-1.383-1.42L16.154 18z"
    />
  </svg>
);
export default SvgCaseRft;
