export const printWithoutBrowserTitle = (delay = 60) => {
  const previousTitle = document.title
  const restoreTitle = () => {
    document.title = previousTitle
    window.removeEventListener('afterprint', restoreTitle)
  }

  document.title = ' '
  window.addEventListener('afterprint', restoreTitle)
  setTimeout(() => {
    window.print()
    setTimeout(restoreTitle, 500)
  }, delay)
}
