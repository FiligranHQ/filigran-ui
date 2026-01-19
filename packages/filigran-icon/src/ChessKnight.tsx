import type { SVGProps } from "react";
import type { SVGRProps } from "../model/svgr";
const SvgChessKnight = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 16 20"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <mask
      id="chess_knight_svg__a"
      width={25}
      height={24}
      x={-4}
      y={-2}
      maskUnits="userSpaceOnUse"
      style={{
        maskType: "alpha",
      }}
    >
      <path fill="currentColor" d="M-3.419-2h24v24h-24z" />
    </mask>
    <g mask="url(#chess_knight_svg__a)">
      <path
        fill="currentColor"
        d="M1.581 20v-4q0-.575.3-1.037.3-.463.8-.738l4.9-2.475V10l-3.475 1.725q-.3.15-.625.225-.324.075-.65.075a2.86 2.86 0 0 1-1.462-.4 2.7 2.7 0 0 1-1.063-1.15 2.7 2.7 0 0 1-.3-1.437q.05-.764.475-1.413L3.581 3l-2-3h6q3.325 0 5.663 2.325T15.58 8v12zm2-2h10V8q0-2.5-1.75-4.25T7.581 2h-2.25l.65 1-3.825 5.75a.87.87 0 0 0-.137.412q-.014.213.087.413.125.274.338.363.212.087.412.087.075 0 .375-.075l6.35-3.2V13l-6 3z"
      />
    </g>
  </svg>
);
export default SvgChessKnight;
