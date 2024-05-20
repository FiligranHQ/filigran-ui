import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgKillChainPhase = ({
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
      d="M22.167 4.625v3.083h5.684L12.287 22.863l2.232 2.174L30.083 9.882v5.535h3.167V4.625m-3.167 24.667H7.917V7.708H19V4.625H7.917c-1.758 0-3.167 1.372-3.167 3.083v21.584c0 .817.334 1.602.928 2.18a3.2 3.2 0 0 0 2.239.903h22.166a3.2 3.2 0 0 0 2.24-.903 3.04 3.04 0 0 0 .927-2.18V18.5h-3.167z"
    />
  </svg>
);
export default SvgKillChainPhase;
