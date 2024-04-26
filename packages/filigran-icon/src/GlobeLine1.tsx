import * as React from "react";
import type { SVGProps } from "react";
interface SVGRProps {
  title?: string;
  titleId?: string;
}
const SvgGlobeLine1 = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 44 44"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <path
      fill="currentColor"
      d="M23.833 38.5H33v3.667H11V38.5h9.167v-1.925A18.34 18.34 0 0 1 6.079 27.43l3.185-1.818A14.667 14.667 0 1 0 29.278 5.597l1.82-3.184a18.33 18.33 0 0 1 9.235 15.92c0 9.506-7.234 17.324-16.5 18.242zM22 31.167a12.832 12.832 0 0 1-4.911-24.69A12.833 12.833 0 1 1 22 31.167m0-3.667a9.167 9.167 0 1 0 0-18.333A9.167 9.167 0 0 0 22 27.5"
    />
  </svg>
);
export default SvgGlobeLine1;
