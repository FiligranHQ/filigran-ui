import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgLogoGit1 = ({
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
    <g clipPath="url(#LogoGit_1_svg__a)">
      <mask
        id="LogoGit_1_svg__b"
        width={24}
        height={24}
        x={0}
        y={0}
        maskUnits="userSpaceOnUse"
        style={{
          maskType: "luminance",
        }}
      >
        <path fill="#fff" d="M0 .03h23.97V24H0z" />
      </mask>
      <g mask="url(#LogoGit_1_svg__b)">
        <path
          fill="currentColor"
          d="M23.519 10.947 13.053.482a1.543 1.543 0 0 0-2.183 0L8.696 2.656l2.757 2.756a1.834 1.834 0 0 1 2.322 2.338l2.656 2.656a1.833 1.833 0 0 1 2.437 1.735 1.836 1.836 0 1 1-3.536-.7l-2.478-2.477v6.521a1.837 1.837 0 1 1-1.51-.054v-6.58a1.83 1.83 0 0 1-1.106-1.345 1.84 1.84 0 0 1 .108-1.065L7.628 3.723.452 10.898a1.544 1.544 0 0 0 0 2.184L10.92 23.55a1.544 1.544 0 0 0 2.182 0L23.52 13.13a1.545 1.545 0 0 0 0-2.184"
        />
      </g>
    </g>
    <defs>
      <clipPath id="LogoGit_1_svg__a">
        <path fill="#fff" d="M0 0h24v24H0z" />
      </clipPath>
    </defs>
  </svg>
);
export default SvgLogoGit1;
