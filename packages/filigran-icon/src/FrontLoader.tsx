import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgFrontLoader = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 23 16"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <mask
      id="front_loader_svg__a"
      width={24}
      height={25}
      x={-1}
      y={-4}
      maskUnits="userSpaceOnUse"
      style={{
        maskType: "alpha",
      }}
    >
      <path fill="currentColor" d="M-1-3.775h24v24H-1z" />
    </mask>
    <g mask="url(#front_loader_svg__a)">
      <path
        fill="currentColor"
        d="M2.975 16q-1.25 0-2.112-.875T0 13V7q0-.824.588-1.412A1.93 1.93 0 0 1 2 5h5V0h5q1.25 0 2.125.875T15 3v4h.975V5.825q0-.4.162-.775.164-.375.438-.65L18.5 2.5l4.475 8.5h-5q-.824 0-1.413-.588A1.93 1.93 0 0 1 15.976 9h-1v1.75q.5.424.763 1.012A3 3 0 0 1 16 13q0 1.25-.875 2.125A2.9 2.9 0 0 1 13 16a2.9 2.9 0 0 1-1.725-.55A3.13 3.13 0 0 1 10.15 14H5.825A3.13 3.13 0 0 1 4.7 15.45a2.9 2.9 0 0 1-1.725.55m0-2q.425 0 .725-.287.3-.288.3-.713a.97.97 0 0 0-.288-.713A.97.97 0 0 0 3 12a.97.97 0 0 0-.712.287A.97.97 0 0 0 2 13q0 .424.275.713a.93.93 0 0 0 .7.287M13 14q.424 0 .713-.287A.97.97 0 0 0 14 13a.97.97 0 0 0-.287-.713A.97.97 0 0 0 13 12a.97.97 0 0 0-.713.287A.97.97 0 0 0 12 13q0 .424.287.713.288.287.713.287m-6-2V7H2v3.175q.251-.1.487-.138A3 3 0 0 1 3 10q.95 0 1.725.55t1.1 1.45zm2 0h1.15q.326-.9 1.112-1.45A2.97 2.97 0 0 1 13 10V9H9zm10.675-3L18 5.825V9zM9 7h4V3a.97.97 0 0 0-.287-.712A.97.97 0 0 0 12 2H9zm-2 5v-2 .175V7z"
      />
    </g>
  </svg>
);
export default SvgFrontLoader;
