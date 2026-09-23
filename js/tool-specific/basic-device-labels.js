// read values from associated HTML file
const basicDeviceForm = document.getElementById("basicDeviceForm");
const componentCsv = document.getElementById("componentCsv");
const templateFile = document.getElementById("templateFile");
const processButton = document.getElementById("processLabels");

// enables the process button once both files have been uploaded
function updateProcessButton() {
    const hasComponentCsv = componentCsv.files.length > 0;
    const hasTemplate = templateFile.files.length > 0;

    processButton.disabled = !hasComponentCsv || !hasTemplate;
}

componentCsv.addEventListener("change", updateProcessButton);
templateFile.addEventListener("change", updateProcessButton);

// prevents an unfinished form from refreshing the page
basicDeviceForm.addEventListener("submit", function (event) {
    event.preventDefault();

    // once the form is submitted, handle the device label processing
});