import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgSettings = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 35 35"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <g clipPath="url(#settings_svg__a)">
      <path
        fill="currentColor"
        d="M27.913 18.87c.058-.437.087-.889.087-1.37 0-.467-.03-.933-.102-1.37l2.96-2.305a.715.715 0 0 0 .175-.89l-2.8-4.841c-.175-.321-.54-.423-.86-.321l-3.486 1.4a10.3 10.3 0 0 0-2.362-1.37L21 4.097a.705.705 0 0 0-.7-.598h-5.6a.69.69 0 0 0-.685.598l-.525 3.704c-.86.35-1.648.831-2.363 1.37l-3.485-1.4a.696.696 0 0 0-.86.322l-2.786 4.841c-.175.307-.117.686.175.89l2.96 2.304A8.6 8.6 0 0 0 7 17.5c0 .452.03.933.102 1.37l-2.96 2.305a.715.715 0 0 0-.175.89l2.8 4.841c.175.321.54.423.86.321l3.486-1.4c.729.554 1.502 1.02 2.362 1.37L14 30.903c.073.35.35.598.7.598h5.6a.68.68 0 0 0 .685-.598l.525-3.704c.86-.35 1.648-.817 2.363-1.37l3.485 1.4c.321.116.686 0 .86-.322l2.8-4.841c.176-.321.103-.686-.174-.89zM17.5 22.75c-2.887 0-5.25-2.363-5.25-5.25s2.363-5.25 5.25-5.25 5.25 2.363 5.25 5.25-2.363 5.25-5.25 5.25"
      />
    </g>
    <defs>
      <clipPath id="settings_svg__a">
        <path fill="#fff" d="M0 0h35v35H0z" />
      </clipPath>
    </defs>
  </svg>
);
export default SvgSettings;
