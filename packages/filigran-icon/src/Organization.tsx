import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgOrganization = ({
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
    <g clipPath="url(#organization_svg__a)">
      <path
        fill="currentColor"
        d="M6.329 10H4.382v7h1.947zm5.842 0h-1.947v7h1.947zm8.276 9h-18.5v2h18.5zm-2.434-9h-1.947v7h1.947zm-6.816-6.74L16.27 6H6.124zm0-2.26-9.25 5v2h18.5V6z"
      />
    </g>
    <defs>
      <clipPath id="organization_svg__a">
        <path fill="#fff" d="M0 0h23.368v24H0z" />
      </clipPath>
    </defs>
  </svg>
);
export default SvgOrganization;
