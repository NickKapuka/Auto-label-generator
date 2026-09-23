// builds the shared navbar for all pages
document.addEventListener('DOMContentLoaded', function () {
  const navbarPlaceholder = document.getElementById('navbar-placeholder')

  if (!navbarPlaceholder) {
    return
  }

  const root = navbarPlaceholder.dataset.root || ''

  // navbar renderer
  navbarPlaceholder.innerHTML = `
        <header class="site-header">
            <nav class="navbar">
                <a href="index.html" class="nav-brand">AUTO LABEL GENERATOR</a>
                <ul class="nav-links">
                    <li>
                        <a href="index.html">Home</a>
                    </li>
                    <li>
                        <a href="index.html#tools">Label Tools</a>
                    </li>
                    <li>
                        <a href="wire-labels.html">Wire Labels</a>
                    </li>
                    <li>
                        <a href="wire-cable-labels.html">Wire + Cable</a>
                    </li>
                    <li>
                        <a href="basic-device-labels.html">Basic Devices</a>
                    </li>
                    <li>
                        <a href="smart-device-labels.html">Smart Devices</a>
                    </li>
                </ul>
            </nav>
        </header>
    `

  highlightCurrentPage()
})

// highlights the current navbar link
function highlightCurrentPage () {
  const currentFile = window.location.pathname.split('/').pop()
  const navLinks = document.querySelectorAll('.nav-links a')

  navLinks.forEach(function (link) {
    const linkFile = link.getAttribute('href').split('/').pop()

    if (currentFile === linkFile) {
      link.classList.add('active')
    }
  })
}
