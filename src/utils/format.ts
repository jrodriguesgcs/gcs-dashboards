export const maskEmail = (email?: string|null) => {
  if (!email) return ''
  const [user, domain] = email.split('@')
  if (!domain) return email
  const first = user.slice(0,1)
  return `${first}***@${domain}`
}
