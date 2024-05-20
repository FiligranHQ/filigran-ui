import * as React from "react";
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
    viewBox="0 0 37 38"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <g clipPath="url(#organization_svg__a)">
      <path
        fill="currentColor"
        d="M10.02 15.833H6.939v11.084h3.083zm9.25 0h-3.082v11.084h3.083zm13.105 14.25H3.083v3.167h29.292zm-3.854-14.25h-3.084v11.084h3.084zM17.729 5.162 25.761 9.5H9.697zm0-3.579L3.083 9.5v3.167h29.292V9.5z"
      />
    </g>
    <defs>
      <clipPath id="organization_svg__a">
        <path fill="#fff" d="M0 0h37v38H0z" />
      </clipPath>
    </defs>
  </svg>
);
export default SvgOrganization;
