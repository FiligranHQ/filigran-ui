import * as React from "react";
import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgBooksMoviesAndMusic = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 19 21"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <mask
      id="books_movies_and_music_svg__a"
      width={24}
      height={25}
      x={-3}
      y={-2}
      maskUnits="userSpaceOnUse"
      style={{
        maskType: "alpha",
      }}
    >
      <path fill="currentColor" d="M-3-1.926h24v24H-3z" />
    </mask>
    <g mask="url(#books_movies_and_music_svg__a)">
      <path
        fill="currentColor"
        d="M1 20.074a.97.97 0 0 1-.712-.287.97.97 0 0 1-.288-.713V5.124q0-.375.15-.637.15-.263.5-.413l10-4a.87.87 0 0 1 .925.138q.425.337.425.862v3h1q.424 0 .713.288.287.289.287.712v3h-2v-2H2v12h5.175l2 2zm5-16h4v-1.55zm8 16q-2.075 0-3.537-1.462Q9 17.15 9 15.074 9 13 10.463 11.537T14 10.074q2.075 0 3.538 1.463T19 15.074t-1.462 3.538Q16.074 20.074 14 20.074m-1.25-2.5 4-2.5-4-2.5z"
      />
    </g>
  </svg>
);
export default SvgBooksMoviesAndMusic;
