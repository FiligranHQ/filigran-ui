import * as React from "react";
import type { SVGProps } from "react";
interface SVGRProps {
  title?: string;
  titleId?: string;
}
const SvgIntrusionSet = ({
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
    <path
      fill="currentColor"
      d="M27.75 3.083H9.25l-6.167 9.25L18.5 33.917l15.417-21.584zm-20.92 9.25 4.07-6.166h15.2l4.07 6.166-11.67 16.28z"
    />
  </svg>
);
export default SvgIntrusionSet;
