import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgKillChainPhase = ({
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
      d="M14.378 3v2h3.687L7.97 14.83l1.448 1.41 10.096-9.83V10h2.054V3m-2.055 16H5.136V5h7.19V3h-7.19c-1.14 0-2.054.89-2.054 2v14c0 .53.216 1.04.602 1.414.385.375.907.586 1.452.586h14.379c.544 0 1.067-.21 1.452-.586.385-.375.602-.884.602-1.414v-7h-2.055z"
    />
  </svg>
);
export default SvgKillChainPhase;
