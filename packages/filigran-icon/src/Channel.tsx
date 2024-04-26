import * as React from "react";
import type { SVGProps } from "react";
interface SVGRProps {
  title?: string;
  titleId?: string;
}
const SvgChannel = ({
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
      d="M30.833 6.167H6.167A3.083 3.083 0 0 0 3.083 9.25v18.5a3.083 3.083 0 0 0 3.084 3.083h24.666a3.084 3.084 0 0 0 3.084-3.083V9.25a3.084 3.084 0 0 0-3.084-3.083m-18.87 18.87L9.79 27.21c-2.42-2.39-3.623-5.55-3.623-8.71s1.202-6.32 3.607-8.726l2.174 2.174A9.32 9.32 0 0 0 9.25 18.5a9.2 9.2 0 0 0 2.713 6.537m6.537-.37a6.167 6.167 0 1 1 0-12.334 6.167 6.167 0 0 1 0 12.334m8.726 2.559-2.174-2.174A9.32 9.32 0 0 0 27.75 18.5a9.2 9.2 0 0 0-2.713-6.537L27.21 9.79c2.42 2.39 3.623 5.55 3.623 8.71s-1.202 6.32-3.607 8.726M18.5 15.416a3.083 3.083 0 1 0 0 6.167 3.083 3.083 0 0 0 0-6.166"
    />
  </svg>
);
export default SvgChannel;
