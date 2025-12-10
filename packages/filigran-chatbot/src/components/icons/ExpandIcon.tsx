const defaultButtonColor = '#3B81F6';
export const ExpandIcon = (props: { color?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    class="icon icon-tabler icon-tabler-refresh"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    stroke-width="2"
    stroke={props.color ?? defaultButtonColor}
    fill="none"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <g id="Complete">
      <g id="expand">
        <g>
          <polyline
            data-name="Right"
            fill="none"
            id="Right-2"
            points="3 17.3 3 21 6.7 21"
            stroke={props.color ?? defaultButtonColor}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
          />
          <line
            fill="none"
            stroke={props.color ?? defaultButtonColor}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            x1="10"
            x2="3.8"
            y1="14"
            y2="20.2"
          />
          <line
            fill="none"
            stroke={props.color ?? defaultButtonColor}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            x1="14"
            x2="20.2"
            y1="10"
            y2="3.8"
          />
          <polyline
            data-name="Right"
            fill="none"
            id="Right-3"
            points="21 6.7 21 3 17.3 3"
            stroke={props.color ?? defaultButtonColor}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
          />
        </g>
      </g>
    </g>
  </svg>
);
