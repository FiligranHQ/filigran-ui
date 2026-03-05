import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgOpenAevIcon = ({
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
    <mask
      id="openAEV_icon_svg__a"
      width={24}
      height={24}
      x={0}
      y={0}
      maskUnits="userSpaceOnUse"
      style={{
        maskType: "luminance",
      }}
    >
      <path fill="#fff" d="M24 0H0v23.745h24z" />
    </mask>
    <g
      fill="currentColor"
      fillRule="evenodd"
      clipRule="evenodd"
      mask="url(#openAEV_icon_svg__a)"
    >
      <path d="M11.225 23.745V0h1.549v23.745z" />
      <path d="M0 11.106h24v1.532H0z" />
      <path d="M7.397 11.87h1.548v3.024h3.097v1.532H7.397z" />
      <path d="M3.566 11.87h1.548v6.815h6.849v1.532H3.565zM11.949 3.595h8.397v8.346h-1.549V5.127H11.95z" />
      <path d="m11.89 7.405 4.645.002-.001 4.555h-1.548V8.937l-3.097-.001z" />
    </g>
  </svg>
);
export default SvgOpenAevIcon;
