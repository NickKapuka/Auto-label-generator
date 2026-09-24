// builds the shared navbar for all pages
document.addEventListener('DOMContentLoaded', function () {
    // find the navbar placeholder in the current page
    const navbarPlaceholder = document.getElementById('navbar-placeholder');

    if (navbarPlaceholder) {
        // read the path from the current page back to the project folder
        const projectRoot = navbarPlaceholder.getAttribute('data-root');

        // render the navbar using paths relative to the project folder
        navbarPlaceholder.innerHTML = `
            <header class="site-header">
                <nav class="navbar">
                    <a href="${projectRoot}/index.html" class="nav-brand">AUTO LABEL GENERATOR</a>

                    <ul class="nav-links">
                        <li>
                            <a href="${projectRoot}/index.html">Home</a>
                        </li>

                        <li>
                            <a href="${projectRoot}/index.html#tools">Label Tools</a>
                        </li>

                        <li>
                            <a href="${projectRoot}/html/wire-labels.html">Wire Labels</a>
                        </li>

                        <li>
                            <a href="${projectRoot}/html/wire-cable-labels.html">Wire + Cable</a>
                        </li>

                        <li>
                            <a href="${projectRoot}/html/basic-device-labels.html">Basic Devices</a>
                        </li>

                        <li>
                            <a href="${projectRoot}/html/smart-device-labels.html">Smart Devices</a>
                        </li>
                    </ul>
                </nav>
            </header>
        `;
    }

  highlightCurrentPage();
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
