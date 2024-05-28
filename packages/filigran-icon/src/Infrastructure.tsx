import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgInfrastructure = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <path
      fill="currentColor"
      d="M12.658 19h.974c.258 0 .505.105.688.293.183.187.285.442.285.707h6.816v2h-6.816c0 .265-.102.52-.285.707a.96.96 0 0 1-.688.293H9.737a.96.96 0 0 1-.689-.293A1.01 1.01 0 0 1 8.763 22H1.947v-2h6.816c0-.265.103-.52.285-.707A.96.96 0 0 1 9.737 19h.973v-2H3.895a.96.96 0 0 1-.689-.293A1.01 1.01 0 0 1 2.921 16v-4c0-.265.103-.52.285-.707A.96.96 0 0 1 3.895 11h15.579c.258 0 .506.105.688.293.183.187.285.442.285.707v4c0 .265-.102.52-.285.707a.96.96 0 0 1-.688.293h-6.816zM3.895 3h15.579c.258 0 .506.105.688.293.183.187.285.442.285.707v4c0 .265-.102.52-.285.707a.96.96 0 0 1-.688.293H3.894a.96.96 0 0 1-.688-.293A1.01 1.01 0 0 1 2.921 8V4c0-.265.103-.52.285-.707A.96.96 0 0 1 3.895 3m4.868 4h.974V5h-.974zm0 8h.974v-2h-.974zM4.868 5v2h1.948V5zm0 8v2h1.948v-2z"
    />
  </svg>
);
export default SvgInfrastructure;
