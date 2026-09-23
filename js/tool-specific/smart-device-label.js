// read values from associated HTML file
const smartDeviceForm = document.getElementById('smartDeviceForm')
const componentCsv = document.getElementById('componentCsv')
const templateFile = document.getElementById('templateFile')
const processButton = document.getElementById('processLabels')

// enables the process button once both files have been uploaded
function updateProcessButton () {
  const uploadedComponents = componentCsv.files.length > 0
  const uploadedTemplate = templateFile.files.length > 0

  processButton.disabled = !uploadedComponents || !uploadedTemplate
}

componentCsv.addEventListener('change', updateProcessButton)
templateFile.addEventListener('change', updateProcessButton)

// prevents an unfinished form from refreshing the page
smartDeviceForm.addEventListener('submit', function (event) {
  event.preventDefault()

  // once the form is submitted, handle the cable and wire label processing
})
