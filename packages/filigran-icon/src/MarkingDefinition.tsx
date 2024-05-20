import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgMarkingDefinition = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 37 37"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <g clipPath="url(#marking-definition_svg__a)">
      <path
        fill="currentColor"
        d="M26.208 18.5a7.71 7.71 0 0 0-7.708-7.708 7.71 7.71 0 0 0-7.708 7.708 7.71 7.71 0 0 0 7.708 7.708 7.71 7.71 0 0 0 7.708-7.708M18.5 23.125a4.64 4.64 0 0 1-4.625-4.625 4.64 4.64 0 0 1 4.625-4.625 4.64 4.64 0 0 1 4.625 4.625 4.64 4.64 0 0 1-4.625 4.625m-10.792 0H4.625v6.167a3.09 3.09 0 0 0 3.083 3.083h6.167v-3.083H7.708zm0-15.417h6.167V4.625H7.708a3.09 3.09 0 0 0-3.083 3.083v6.167h3.083zm21.584-3.083h-6.167v3.083h6.167v6.167h3.083V7.708a3.09 3.09 0 0 0-3.083-3.083m0 24.667h-6.167v3.083h6.167a3.09 3.09 0 0 0 3.083-3.083v-6.167h-3.083z"
      />
    </g>
    <defs>
      <clipPath id="marking-definition_svg__a">
        <path fill="#fff" d="M0 0h37v37H0z" />
      </clipPath>
    </defs>
  </svg>
);
export default SvgMarkingDefinition;
