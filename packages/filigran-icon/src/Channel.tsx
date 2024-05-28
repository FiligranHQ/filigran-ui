import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgChannel = ({
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
      d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2M7.76 16.24l-1.41 1.41A7.9 7.9 0 0 1 4 12c0-2.05.78-4.1 2.34-5.66l1.41 1.41A6.05 6.05 0 0 0 6 12c0 1.54.59 3.07 1.76 4.24M12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8m5.66 1.66-1.41-1.41A6.05 6.05 0 0 0 18 12c0-1.54-.59-3.07-1.76-4.24l1.41-1.41A7.9 7.9 0 0 1 20 12c0 2.05-.78 4.1-2.34 5.66M12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4"
    />
  </svg>
);
export default SvgChannel;
