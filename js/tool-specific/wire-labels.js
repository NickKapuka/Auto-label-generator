// read values from associated HTML file
const wireForm = document.getElementById("wireForm");
const wireCsv = document.getElementById("wireCsv");
const templateFile = document.getElementById("templateFile");
const processButton = document.getElementById("processLabels");


// enables the process button once both files have been uploaded
function updateProcessButon() {
    const uploadedCsv = wireCsv.files.length > 0;
    const uploadedTemplate = templateFile.files.length > 0;

    processButton.disabled = !uploadedCsv || !uploadedTemplate;
}

wireCsv.addEventListener("change", updateProcessButon);
templateFile.addEventListener("change", updateProcessButon);

// prevents an unfinished form from refreshing the page
wireForm.addEventListener("submit", function (event) {
    event.preventDefault();

    // once the form is submitted, handle the wire labels
});