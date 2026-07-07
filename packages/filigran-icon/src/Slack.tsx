import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgSlack = ({
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
      d="M6.216 14.643a2.1 2.1 0 1 1-4.2 0 2.1 2.1 0 0 1 2.1-2.102h2.1zm1.05 0a2.1 2.1 0 1 1 4.201 0v5.255a2.1 2.1 0 1 1-4.2 0zM9.367 6.204a2.1 2.1 0 0 1-2.1-2.102 2.1 2.1 0 1 1 4.2 0v2.102zm0 1.067a2.1 2.1 0 0 1 2.1 2.102 2.1 2.1 0 0 1-2.1 2.102H4.1A2.1 2.1 0 0 1 2 9.373 2.1 2.1 0 0 1 4.1 7.27zM17.784 9.373a2.1 2.1 0 1 1 4.2 0 2.1 2.1 0 0 1-2.1 2.102h-2.1zm-1.05 0a2.1 2.1 0 1 1-4.201 0V4.102a2.1 2.1 0 1 1 4.2 0zM14.633 17.796a2.1 2.1 0 0 1 2.1 2.102 2.1 2.1 0 1 1-4.2 0v-2.102zm0-1.05a2.1 2.1 0 0 1-2.1-2.103 2.1 2.1 0 0 1 2.1-2.102H19.9c1.161 0 2.1.94 2.1 2.102a2.1 2.1 0 0 1-2.1 2.102z"
    />
  </svg>
);
export default SvgSlack;
