// read values from associated HTML file
const wireCableForm = document.getElementById('wireCableForm')
const wireCsv = document.getElementById('wireCsv')
const cableCsv = document.getElementById('cableCsv')
const templateFile = document.getElementById('templateFile')
const processButton = document.getElementById('processLabels')

// enables the process button once both files have been uploaded
function updateProcessButton () {
  const uploadedWireCsv = wireCsv.files.length > 0
  const uploadedCableCsv = cableCsv.files.length > 0
  const uploadedTemplate = templateFile.files.length > 0

  processButton.disabled =
    !uploadedWireCsv || !uploadedCableCsv || !uploadedTemplate
}

wireCsv.addEventListener('change', updateProcessButton)
cableCsv.addEventListener('change', updateProcessButton)
templateFile.addEventListener('change', updateProcessButton)

// prevents an unfinished form from refreshing the page
wireCableForm.addEventListener('submit', function (event) {
  event.preventDefault()

  // once the form is submitted, handle the cable and wire label processing
})
