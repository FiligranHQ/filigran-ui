import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgWorkEmpty = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 35 35"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <g clipPath="url(#work-empty_svg__a)">
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M20.417 8.75V5.833h-5.834V8.75zM5.833 11.667v16.041h23.334V11.667zM29.167 8.75a2.907 2.907 0 0 1 2.916 2.917v16.041a2.907 2.907 0 0 1-2.916 2.917H5.833a2.907 2.907 0 0 1-2.916-2.917l.014-16.041A2.894 2.894 0 0 1 5.833 8.75h5.834V5.833a2.907 2.907 0 0 1 2.916-2.916h5.834a2.907 2.907 0 0 1 2.916 2.916V8.75z"
        clipRule="evenodd"
      />
    </g>
    <defs>
      <clipPath id="work-empty_svg__a">
        <path fill="#fff" d="M0 0h35v35H0z" />
      </clipPath>
    </defs>
  </svg>
);
export default SvgWorkEmpty;
