import Icon from './Icon'

// Hand-drawn icon set - plain inline SVG on a 24x24 grid, no icon package behind it.
//
// Usage matches the shape the app already passes around, so an icon can go straight into the
// `icon` prop of Field, Section or a table cell:
//
//   import { IconFlag } from '../icons'
//   <Field label="Priority" icon={IconFlag} ... />
//   <IconFlag size={18} title="Priority" />
//
// Adding one: export a component that renders <Icon> with its geometry. Do not set size,
// stroke or colour on the shape - Icon owns those.
export { default as Icon } from './Icon'

export const IconFlag = props => (
  <Icon {...props}>
    <path d="M5 21V4" />
    <path d="M5 4h11l-2.2 3.6L16 11.4H5" />
  </Icon>
)

export const IconUser = props => (
  <Icon {...props}>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" />
  </Icon>
)

export const IconUsers = props => (
  <Icon {...props}>
    <circle cx="9.5" cy="8.5" r="3.2" />
    <path d="M3.5 20a6 6 0 0 1 12 0" />
    <path d="M16.5 5.6a3 3 0 0 1 0 5.8" />
    <path d="M17.6 14.2A5.6 5.6 0 0 1 21 19.4" />
  </Icon>
)

export const IconDocument = props => (
  <Icon {...props}>
    <path d="M13.5 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7.5z" />
    <path d="M13.5 3v4.5H18" />
    <path d="M9 13h6" />
    <path d="M9 16.5h4.5" />
  </Icon>
)

export const IconBuilding = props => (
  <Icon {...props}>
    <path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16" />
    <path d="M15 10h4a1 1 0 0 1 1 1v10" />
    <path d="M2.5 21h19" />
    <path d="M7.5 8h4" />
    <path d="M7.5 12h4" />
    <path d="M7.5 16h4" />
  </Icon>
)

export const IconPin = props => (
  <Icon {...props}>
    <path d="M12 21.5c4.2-4.4 6.5-7.9 6.5-10.8A6.5 6.5 0 0 0 5.5 10.7c0 2.9 2.3 6.4 6.5 10.8z" />
    <circle cx="12" cy="10.5" r="2.4" />
  </Icon>
)

export const IconBox = props => (
  <Icon {...props}>
    <path d="M12 2.8 20 7v10l-8 4.2L4 17V7z" />
    <path d="M4 7l8 4.2L20 7" />
    <path d="M12 11.2v10" />
  </Icon>
)

export const IconWrench = props => (
  <Icon {...props}>
    <path d="M15.5 3.2a5.5 5.5 0 0 0-6.1 8.4L3.6 17.4a2 2 0 0 0 2.8 2.8l5.8-5.8a5.5 5.5 0 0 0 8.4-6.1l-3.1 3.1-3.1-.8-.8-3.1z" />
  </Icon>
)

export const IconClipboard = props => (
  <Icon {...props}>
    <path d="M9 4.5H7a1 1 0 0 0-1 1V20a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V5.5a1 1 0 0 0-1-1h-2" />
    <rect x="9" y="2.6" width="6" height="3.8" rx="1" />
    <path d="M9 12h6" />
    <path d="M9 15.5h4" />
  </Icon>
)

export const IconCalendar = props => (
  <Icon {...props}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="1.5" />
    <path d="M3.5 9.5h17" />
    <path d="M8 3v4" />
    <path d="M16 3v4" />
  </Icon>
)

export const IconClock = props => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.2V12l3.2 2" />
  </Icon>
)

export const IconPaperclip = props => (
  <Icon {...props}>
    <path d="M19 11.5 12 18.5a4.5 4.5 0 0 1-6.4-6.4l7.6-7.6a3 3 0 0 1 4.3 4.3l-7.6 7.6a1.5 1.5 0 0 1-2.2-2.1l6.9-6.9" />
  </Icon>
)

export const IconUpload = props => (
  <Icon {...props}>
    <path d="M12 15.5V3.5" />
    <path d="M7.5 8 12 3.5 16.5 8" />
    <path d="M4 15.5v3.5a1.5 1.5 0 0 0 1.5 1.5h13a1.5 1.5 0 0 0 1.5-1.5v-3.5" />
  </Icon>
)

export const IconSearch = props => (
  <Icon {...props}>
    <circle cx="10.8" cy="10.8" r="6.3" />
    <path d="M15.4 15.4 20.5 20.5" />
  </Icon>
)

export const IconBell = props => (
  <Icon {...props}>
    <path d="M18 16.5V10a6 6 0 0 0-12 0v6.5L4.5 19h15z" />
    <path d="M10 19a2 2 0 0 0 4 0" />
  </Icon>
)

export const IconActivity = props => (
  <Icon {...props}>
    <path d="M3 12.5h4l2.5-6.5 4 13 2.5-6.5h5" />
  </Icon>
)

export const IconWarning = props => (
  <Icon {...props}>
    <path d="M12 3.8 21 19.5H3z" />
    <path d="M12 9.5v4.5" />
    <path d="M12 17.2h.01" />
  </Icon>
)

export const IconInfo = props => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11.2v5" />
    <path d="M12 7.8h.01" />
  </Icon>
)

export const IconCheck = props => (
  <Icon {...props}>
    <path d="M4.5 12.5 9.5 17.5 19.5 6.5" />
  </Icon>
)

export const IconClose = props => (
  <Icon {...props}>
    <path d="M6 6l12 12" />
    <path d="M18 6 6 18" />
  </Icon>
)

export const IconChevronRight = props => (
  <Icon {...props}>
    <path d="M9.5 5.5 16 12l-6.5 6.5" />
  </Icon>
)

export const IconChevronDown = props => (
  <Icon {...props}>
    <path d="M5.5 9.5 12 16l6.5-6.5" />
  </Icon>
)
