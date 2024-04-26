import * as React from "react";
import type { SVGProps } from "react";
interface SVGRProps {
  title?: string;
  titleId?: string;
}
const SvgCourseOfAction = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 38 37"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <path
      fill="currentColor"
      d="M20.583 3.13v3.114c6.951.832 11.875 6.984 11.02 13.752-.728 5.611-5.256 10.067-11.02 10.73v3.083c8.709-.848 15.042-8.371 14.171-16.85-.712-7.324-6.681-13.105-14.17-13.83m-3.166.046c-3.088.293-6.033 1.45-8.44 3.392l2.265 2.281a12.83 12.83 0 0 1 6.175-2.59zM6.745 8.74c-1.995 2.344-3.182 5.196-3.5 8.217h3.167a12.2 12.2 0 0 1 2.597-6.012zm-3.483 11.3A15.26 15.26 0 0 0 6.76 28.26l2.248-2.205a12.17 12.17 0 0 1-2.58-6.012zm7.98 8.28-2.265 2.112a16.05 16.05 0 0 0 8.44 3.484v-3.084a12.85 12.85 0 0 1-6.175-2.512m15.39-4.903-6.508-6.336c.65-1.604.285-3.484-1.076-4.795-1.425-1.403-3.563-1.68-5.289-.91l3.072 2.991-2.138 2.097-3.15-3.006c-.855 1.68-.46 3.762.934 5.164a4.7 4.7 0 0 0 4.94 1.049l6.507 6.32a.676.676 0 0 0 .998 0l1.646-1.587c.349-.278.349-.771.064-.987"
    />
  </svg>
);
export default SvgCourseOfAction;
