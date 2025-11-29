export function getPrettyDatetime(
  date?: Date,
  opts?: { includeTimeZone?: boolean; isShort?: boolean; timeZone?: string },
) {
  const { includeTimeZone = true, isShort = false, timeZone = "America/Los_Angeles" } = opts || {}
  
  const dateToFormat = date || new Date()
  
  // Determine if we're in DST for Pacific Time
  const isPDT = () => {
    const jan = new Date(dateToFormat.getFullYear(), 0, 1)
    const jul = new Date(dateToFormat.getFullYear(), 6, 1)
    const janOffset = jan.getTimezoneOffset()
    const julOffset = jul.getTimezoneOffset()
    const currentOffset = dateToFormat.getTimezoneOffset()
    const isDST = Math.max(janOffset, julOffset) !== currentOffset
    return timeZone === "America/Los_Angeles" && isDST
  }

  if (isShort) {
    const formatted = dateToFormat.toLocaleString("en-US", {
      timeZone,
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })

    if (!includeTimeZone) return formatted
    
    const tzAbbr = timeZone === "America/Los_Angeles" ? (isPDT() ? "PDT" : "PST") : "UTC"
    return formatted + " " + tzAbbr
  }

  const formatted = dateToFormat.toLocaleString("en-US", {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })

  if (!includeTimeZone) return formatted
  
  const tzName = timeZone === "America/Los_Angeles" ? "Pacific Time" : timeZone
  return formatted + " " + tzName
}
