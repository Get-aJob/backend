function formatUptime(second) {
  const sec = Math.floor(second)
  const hours = Math.floor(sec / 3600)
  const minutes = Math.floor((sec % 3600) / 60)
  const remainSecond = sec % 60
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(hours)}:${pad(minutes)}:${pad(remainSecond)}`
}

module.exports = { formatUptime }