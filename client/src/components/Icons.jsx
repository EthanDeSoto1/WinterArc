function Icon({ children, className = 'size-6', strokeWidth = 1.75 }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export function TodayIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </Icon>
  )
}

export function CalendarIcon(props) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 10h17" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
    </Icon>
  )
}

export function FriendsIcon(props) {
  return (
    <Icon {...props}>
      <path d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20" />
      <circle cx="10" cy="8" r="3.5" />
      <path d="M20 20v-1.5a3.5 3.5 0 0 0-2.5-3.35" />
      <path d="M15.5 4.65a3.5 3.5 0 0 1 0 6.7" />
    </Icon>
  )
}

export function AddFriendIcon(props) {
  return (
    <Icon {...props}>
      <path d="M15 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 3 18.5V20" />
      <circle cx="9" cy="8" r="3.5" />
      <path d="M19 8v6" />
      <path d="M22 11h-6" />
    </Icon>
  )
}

export function BoardIcon(props) {
  return (
    <Icon {...props}>
      <path d="M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-6.5L8 20.5V17H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
      <path d="M7.5 8.5h9" />
      <path d="M7.5 12.5h5.5" />
    </Icon>
  )
}

export function SettingsIcon(props) {
  return (
    <Icon {...props}>
      <path d="M20 7h-9" />
      <path d="M14 17H5" />
      <circle cx="17" cy="17" r="3" />
      <circle cx="7" cy="7" r="3" />
    </Icon>
  )
}

export function MoonIcon(props) {
  return (
    <Icon {...props}>
      <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />
    </Icon>
  )
}

export function FlameIcon(props) {
  return (
    <Icon {...props}>
      <path d="M12 21c3.9 0 6.5-2.6 6.5-6.2 0-3.4-2.4-5.6-3.9-7.8-.4 1.8-1.4 3-2.6 3.6.3-2.9-.9-5.9-3.5-7.6.2 3-1.6 5-3.1 7.1A7 7 0 0 0 5.5 15c0 3.5 2.6 6 6.5 6Z" />
    </Icon>
  )
}

export function PencilIcon(props) {
  return (
    <Icon {...props}>
      <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" />
      <path d="m13.5 6.5 4 4" />
    </Icon>
  )
}

export function PlusIcon(props) {
  return (
    <Icon {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </Icon>
  )
}

export function ChevronLeftIcon(props) {
  return (
    <Icon {...props}>
      <path d="m15 18-6-6 6-6" />
    </Icon>
  )
}

export function ChevronDownIcon(props) {
  return (
    <Icon {...props}>
      <path d="m6 9 6 6 6-6" />
    </Icon>
  )
}

export function ArchiveIcon(props) {
  return (
    <Icon {...props}>
      <rect x="3" y="4" width="18" height="4.5" rx="1.2" />
      <path d="M5 8.5V18a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5" />
      <path d="M10 12.5h4" />
    </Icon>
  )
}

export function CheckIcon(props) {
  return (
    <Icon {...props}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </Icon>
  )
}

export function CrossIcon(props) {
  return (
    <Icon {...props}>
      <path d="M6.5 6.5l11 11" />
      <path d="M17.5 6.5l-11 11" />
    </Icon>
  )
}

export function ArrowUpIcon(props) {
  return (
    <Icon {...props}>
      <path d="M12 19V5" />
      <path d="m6 11 6-6 6 6" />
    </Icon>
  )
}

export function ArrowDownIcon(props) {
  return (
    <Icon {...props}>
      <path d="M12 5v14" />
      <path d="m6 13 6 6 6-6" />
    </Icon>
  )
}

export function ReorderIcon(props) {
  return (
    <Icon {...props}>
      <path d="M8 20V5" />
      <path d="m4 9 4-4 4 4" />
      <path d="M16 4v15" />
      <path d="m12 15 4 4 4-4" />
    </Icon>
  )
}
