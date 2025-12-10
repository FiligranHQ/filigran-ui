import type { SVGProps } from "react";
import type {SVGRProps} from '../model/svgr'
const SvgFiligranLoader = ({
  title,
  titleId,
  ...props
}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    id="filigran-loader_svg__Loader"
    viewBox="0 0 150 150"
    role="img"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <defs>
      <style>
        {
          "@keyframes expandCircle{0%,to{r:0}20%,83%{r:75}}@keyframes grow{0%,to{stroke-width:9.2;r:0}20%,35%,45%,83%{stroke-width:9.2;r:70}28%{stroke-width:9.2;r:58}40%{stroke-width:9.2;r:65}}@keyframes ellipse-animation-right{0%,11.25%{r:0;transform:translateY(25px)}18%{transform:translateY(-15px)}22.5%{transform:translateY(10px)}27%{transform:translateY(-5px)}31.5%{transform:translateY(-2px)}36%{transform:translateY(2px)}40.5%{transform:translateY(-4px)}44.9%{r:4.6px;transform:translateY(0)}45%{r:4px;transform:translateY(0)}}@keyframes ellipse-animation-center{0%,8%{r:0;transform:translateY(25px)}15%{transform:translateY(-15px)}18%{transform:translateY(10px)}25%{transform:translateY(-5px)}28%{transform:translateY(-2px)}33%{transform:translateY(2px)}38%{transform:translateY(-4px)}44.9%{r:4.6px;transform:translateY(0)}45%{r:4px;transform:translateY(0)}}@keyframes ellipse-animation-left{0%,13%{r:0;transform:translateY(25px)}20%{transform:translateY(-15px)}25%{transform:translateY(10px)}30%{transform:translateY(-5px)}33%{transform:translateY(-2px)}39%{transform:translateY(2px)}42%{transform:translateY(-4px)}44.9%{r:4.6px;transform:translateY(0)}45%{r:4px;transform:translateY(0)}}@keyframes rectangle-right-low{0%{height:0}50%{rx:3;height:0}69%{rx:3}70%{rx:0;height:46.51px}}@keyframes rectangle-center{0%{height:0}45%{transform:translateY(70px);height:0}70%{transform:translateY(0);height:139.33px}}@keyframes rectangle-middle-left{0%{height:0}51%{transform:translateY(66px);height:0}70%{transform:translateY(0);height:131.7px}}@keyframes rectangle-left{0%{height:0}58%{transform:translateY(50px);height:0}70%{transform:translateY(0);height:105.19px}}@keyframes rectangle-low{0%{height:0}65%{rx:3;height:0}69%{rx:3}70%{rx:0;height:13.8px}}@keyframes rectangle-middle-low{0%{height:0}45%{rx:3;height:0}69%{rx:3}70%{rx:0;height:45.64px}}@keyframes rectangle-center-2{0%{height:0}48%{transform:translate(54.43px,184.7px) rotate(-90deg);height:0}70%{transform:translate(34.43px,184.7px) rotate(-90deg);height:69.44px}}@keyframes rectangle-middle-hight{0%,57%{height:0}70%{height:65.72px}}@keyframes rectangle-hight{0%,63%{height:0}70%{height:52.39px}}*{--animation-logo:2.5s linear infinite}.filigran-loader_svg__cls-2{fill:currentColor;stroke-width:0}"
        }
      </style>
    </defs>
    <clipPath id="filigran-loader_svg__clipCircle">
      <circle
        cx={75}
        cy={75}
        r={75}
        style={{
          animation: "expandCircle var(--animation-logo)",
        }}
      />
    </clipPath>
    <g clipPath="url(#filigran-loader_svg__clipCircle)">
      <circle
        cx={75}
        cy={75}
        r={75}
        fill="none"
        stroke="currentColor"
        strokeWidth={6}
        style={{
          fillRule: "evenodd",
          animation: "grow var(--animation-logo)",
        }}
      />
      <circle
        cx={98.38}
        cy={75.14}
        r={4.6}
        className="filigran-loader_svg__cls-2"
        style={{
          animation: "ellipse-animation-right var(--animation-logo)",
        }}
      />
      <circle
        cx={75}
        cy={75.14}
        r={4.6}
        className="filigran-loader_svg__cls-2"
        style={{
          animation: "ellipse-animation-center var(--animation-logo)",
        }}
      />
      <circle
        cx={51.62}
        cy={75.14}
        r={4.6}
        className="filigran-loader_svg__cls-2"
        style={{
          animation: "ellipse-animation-left var(--animation-logo)",
        }}
      />
      <rect
        width={9.19}
        height={46.51}
        x={-103.6}
        y={-140.98}
        className="filigran-loader_svg__cls-2"
        rx={3}
        style={{
          animation: "rectangle-right-low var(--animation-logo)",
        }}
        transform="rotate(180)"
      />
      <rect
        width={9.19}
        height={139.33}
        x={70.4}
        y={5.21}
        className="filigran-loader_svg__cls-2"
        rx={3}
        style={{
          animation: "rectangle-center var(--animation-logo)",
        }}
      />
      <rect
        width={9.19}
        height={131.7}
        x={47.02}
        y={9.28}
        className="filigran-loader_svg__cls-2"
        rx={3}
        style={{
          animation: "rectangle-middle-left var(--animation-logo)",
        }}
      />
      <rect
        width={9.19}
        height={105.19}
        x={23.64}
        y={22.54}
        className="filigran-loader_svg__cls-2"
        rx={3}
        style={{
          animation: "rectangle-left var(--animation-logo)",
        }}
      />
      <rect
        x={-121.35}
        y={99.27}
        width={9.19}
        height={13.8}
        className="filigran-loader_svg__cls-2"
        style={{
          animation: "rectangle-low var(--animation-logo)",
        }}
        transform="rotate(-90)"
      />
      <rect
        width={9.19}
        height={45.64}
        x={112.67}
        y={76.26}
        className="filigran-loader_svg__cls-2"
        rx={3}
        style={{
          animation: "rectangle-middle-low var(--animation-logo)",
        }}
        transform="rotate(90 117.265 99.075)"
      />
      <rect
        width={9.19}
        height={69.44}
        x={104.96}
        y={40.41}
        className="filigran-loader_svg__cls-2"
        rx={3}
        style={{
          animation: "rectangle-center-2 var(--animation-logo)",
        }}
        transform="rotate(-90 109.565 75.135)"
      />
      <rect
        width={9.19}
        height={65.72}
        x={103.26}
        y={18.89}
        className="filigran-loader_svg__cls-2"
        rx={3}
        style={{
          animation: "rectangle-middle-hight var(--animation-logo)",
        }}
        transform="rotate(-90 107.855 51.745)"
      />
      <rect
        width={9.19}
        height={52.39}
        x={96.6}
        y={2.16}
        className="filigran-loader_svg__cls-2"
        rx={3}
        style={{
          animation: "rectangle-hight var(--animation-logo)",
        }}
        transform="rotate(-90 101.195 28.355)"
      />
    </g>
  </svg>
);
export default SvgFiligranLoader;
