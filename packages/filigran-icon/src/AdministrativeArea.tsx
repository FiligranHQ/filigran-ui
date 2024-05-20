import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgAdministrativeArea = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 37 38"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <path
      fill="currentColor"
      d="M23.588 33.25 13.45 29.569l-6.899 2.81q-.655.356-1.291-.04t-.636-1.187V9.065q0-.515.29-.91.288-.397.75-.595l7.786-2.81 10.136 3.642 6.86-2.81q.656-.318 1.292.059.636.376.636 1.167v22.365q0 .435-.29.752-.288.317-.712.475zm-1.31-2.969v-19.99L14.722 7.68v19.99zm2.312 0 5.473-1.86V8.154l-5.473 2.138zm-17.652-.475 5.472-2.137V7.679L6.938 9.54z"
    />
  </svg>
);
export default SvgAdministrativeArea;
