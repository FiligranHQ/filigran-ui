import * as React from "react";
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
    viewBox="0 0 40 39"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <path
      fill="currentColor"
      d="M18.333 9.75h3.334v11.375h-3.334zM15 32.5c0 .431-.176.844-.488 1.149a1.7 1.7 0 0 1-1.179.476h-5c-.442 0-.866-.171-1.178-.476a1.6 1.6 0 0 1-.488-1.149v-8.125L10 9.75h6.667v11.375c0 .431-.176.844-.489 1.149A1.7 1.7 0 0 1 15 22.75zm1.667-24.375h-5v-3.25h5zM25 32.5v-9.75c-.442 0-.866-.171-1.178-.476a1.6 1.6 0 0 1-.489-1.149V9.75H30l3.333 14.625V32.5c0 .431-.175.844-.488 1.149a1.7 1.7 0 0 1-1.178.476h-5c-.442 0-.866-.171-1.179-.476A1.6 1.6 0 0 1 25 32.5M23.333 8.125v-3.25h5v3.25z"
    />
  </svg>
);
export default SvgBinoculars1;
