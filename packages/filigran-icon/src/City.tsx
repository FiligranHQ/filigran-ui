import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgCity = ({
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
      d="M23.75 35.458h-3.167v-3.083h3.167zm6.333-3.083h-3.166v3.083h3.166zm-6.333-6.167h-3.167v3.084h3.167zm-12.667 6.167H7.917v3.083h3.166zm0-6.167H7.917v3.084h3.166zm19 0h-3.166v3.084h3.166zm-6.333-6.166h-3.167v3.083h3.167zm6.333 0h-3.166v3.083h3.166zm3.167-6.167c.84 0 1.645.325 2.24.903.593.578.927 1.362.927 2.18v18.5H33.25v-18.5H17.417v18.5H14.25V23.125h-9.5v12.333H1.583V23.125c0-.818.334-1.602.928-2.18a3.2 3.2 0 0 1 2.239-.903h9.5v-3.084c0-.817.334-1.602.928-2.18a3.2 3.2 0 0 1 2.239-.903v-3.083c0-.818.333-1.602.927-2.18a3.2 3.2 0 0 1 2.24-.904h3.166V1.542h3.167v6.166h3.166c.84 0 1.646.325 2.24.903.593.579.927 1.363.927 2.18zm-3.167 0v-3.083h-9.5v3.083z"
    />
  </svg>
);
export default SvgCity;
