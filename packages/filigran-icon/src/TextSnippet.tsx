import * as React from "react";
import type { SVGProps } from "react";
interface SVGRProps {
  title?: string;
  titleId?: string;
}
const SvgTextSnippet = ({
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
    <g clipPath="url(#text-snippet_svg__a)">
      <path
        fill="currentColor"
        d="M29.765 12.265 22.72 5.22a2.91 2.91 0 0 0-2.056-.846H7.292a2.925 2.925 0 0 0-2.917 2.917v20.416a2.925 2.925 0 0 0 2.917 2.917h20.416a2.925 2.925 0 0 0 2.917-2.917V14.335c0-.773-.306-1.516-.86-2.07m-19.557-2.057h10.209v2.917H10.208zm14.584 14.584H10.208v-2.917h14.584zm0-5.834H10.208v-2.916h14.584z"
      />
    </g>
    <defs>
      <clipPath id="text-snippet_svg__a">
        <path fill="#fff" d="M0 0h35v35H0z" />
      </clipPath>
    </defs>
  </svg>
);
export default SvgTextSnippet;
