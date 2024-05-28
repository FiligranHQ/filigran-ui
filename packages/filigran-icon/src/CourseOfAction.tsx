import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgCourseOfAction = ({
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
      d="M13.351 2.03v2.02c4.509.54 7.703 4.53 7.149 8.92-.473 3.64-3.41 6.53-7.149 6.96v2C19 21.38 23.108 16.5 22.543 11c-.462-4.75-4.334-8.5-9.192-8.97m-2.054.03c-2.002.19-3.913.94-5.474 2.2l1.469 1.48a8.3 8.3 0 0 1 4.005-1.68zM4.375 5.67A9.75 9.75 0 0 0 2.105 11H4.16c.196-1.42.77-2.77 1.685-3.9zM2.115 13a9.9 9.9 0 0 0 2.27 5.33l1.459-1.43A7.9 7.9 0 0 1 4.17 13zm5.177 5.37-1.469 1.37A10.4 10.4 0 0 0 11.297 22v-2a8.34 8.34 0 0 1-4.005-1.63m9.983-3.18-4.221-4.11c.42-1.04.184-2.26-.699-3.11-.924-.91-2.31-1.09-3.43-.59l1.992 1.94-1.386 1.36-2.044-1.95c-.555 1.09-.298 2.44.606 3.35a3.05 3.05 0 0 0 3.204.68l4.221 4.1c.185.19.462.19.647 0l1.069-1.03c.225-.18.225-.5.04-.64"
    />
  </svg>
);
export default SvgCourseOfAction;
