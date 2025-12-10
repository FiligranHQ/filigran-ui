import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgBinoculars1 = ({
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
      d="M11.282 6h2.051v7h-2.05zM9.231 20c0 .265-.108.52-.3.707a1.04 1.04 0 0 1-.726.293H5.128a1.04 1.04 0 0 1-.725-.293.99.99 0 0 1-.3-.707v-5l2.05-9h4.103v7c0 .265-.108.52-.3.707a1.04 1.04 0 0 1-.725.293zm1.025-15H7.18V3h3.077zm5.129 15v-6a1.04 1.04 0 0 1-.726-.293.99.99 0 0 1-.3-.707V6h4.103l2.05 9v5c0 .265-.107.52-.3.707a1.04 1.04 0 0 1-.725.293H16.41a1.04 1.04 0 0 1-.725-.293.99.99 0 0 1-.3-.707M14.359 5V3h3.077v2z"
    />
  </svg>
);
export default SvgBinoculars1;
