import * as React from "react";
import type { SVGProps } from "react";
interface SVGRProps {
  title?: string;
  titleId?: string;
}
const SvgWorkFull = ({
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
    <g clipPath="url(#work-full_svg__a)">
      <path
        fill="currentColor"
        d="M29.167 8.75h-5.834V5.833a2.907 2.907 0 0 0-2.916-2.916h-5.834a2.907 2.907 0 0 0-2.916 2.916V8.75H5.833a2.894 2.894 0 0 0-2.902 2.917l-.014 16.041a2.907 2.907 0 0 0 2.916 2.917h23.334a2.907 2.907 0 0 0 2.916-2.917V11.667a2.907 2.907 0 0 0-2.916-2.917m-8.75 0h-5.834V5.833h5.834z"
      />
    </g>
    <defs>
      <clipPath id="work-full_svg__a">
        <path fill="#fff" d="M0 0h35v35H0z" />
      </clipPath>
    </defs>
  </svg>
);
export default SvgWorkFull;
