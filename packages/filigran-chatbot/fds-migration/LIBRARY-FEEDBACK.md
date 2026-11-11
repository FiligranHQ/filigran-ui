# Design-system library feedback (@filigran/chatbot)

Gaps met while moving the chat panel onto `@filigran/design-system` 1.5.0
(filigran-ui#521, chatbot 3.23.0, UX round 1 B4 and B6). Each entry names the
DS component, what the panel needs that it cannot do today, the local
stand-in kept in the package, and the change that would let the stand-in go.
Every stand-in is a documented exemption of the audit table of filigran-ui#521.

## 1. `Combobox`: a header trigger and footer actions (agent switcher)

- **Where:** `src/components/ChatHeader.tsx`, `data-ds-exempt="agent-switcher-combobox-trigger"`
  and `"agent-listbox-option"`.
- **Need:** the agent switcher opens from the panel title itself (agent icon,
  agent name as the header title, chevron), not from a text field; its list
  shows each agent's avatar and badge, and ends with footer actions
  ("Open agent page", the history actions) that are not options.
- **What `Combobox` 1.5.0 does:** the trigger is the input field (typing in
  the field filters a grouped list); no slot for a custom trigger, for a
  leading avatar per option, or for non-option footer actions.
- **Stand-in:** a raw trigger button plus a `role="combobox"` search field and
  a `role="listbox"` list in the DS `Dropdown` look (tokens, elevation
  shadow, DS `Button` for the footer actions).
- **Ask:** a `Combobox` `trigger` slot (render prop or `asChild`), an option
  `leading` slot, and a `footer` slot outside the listbox.

## 2. `Tooltip` and menus: a portal container

- **Where:** `src/components/Tooltip.tsx` and `src/components/Dropdown.tsx`.
- **Need:** the panel renders inside host apps (OpenCTI, OpenAEV, XTM One)
  whose fixed bars sit above `document.body` children; the panel's theme
  variables are declared on its root (`.filigran-chatbot`), not on the host
  document.
- **What 1.5.0 does:** `Tooltip` (and the Radix menus under it) portal to
  `document.body`: outside the panel's stacking context, where a host bar hides
  the bubble, and outside the root that declares the theme, so the bubble loses
  the panel's tokens.
- **Stand-in:** `Tooltip.tsx` (the `chat-tooltip` utility reading the DS
  tooltip tokens first) and `Dropdown.tsx` (portals into `findChatbotRoot`).
  The stylesheet test "every overlay the panel portals is mounted inside the
  panel root" holds both.
- **Ask:** a `container` prop (or a `PortalContainerProvider`) on `Tooltip`,
  `Menu`, `Popover` and `Combobox`, passed to the Radix portal.
