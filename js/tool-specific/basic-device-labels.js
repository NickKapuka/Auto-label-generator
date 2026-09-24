// read values from associated HTML file
const basicDeviceForm = document.getElementById("basicDeviceForm");
const componentCsv = document.getElementById("componentCsv");
const templateFileInput = document.getElementById("templateFile");
const processButton = document.getElementById("processLabels");
const processingStatus = document.getElementById("processingStatus");
const reviewSection = document.getElementById("reviewSection");
const reviewTableBody = document.getElementById("deviceReviewBody");
const recordCount = document.getElementById("recordCount");
const missingCount = document.getElementById("missingCount");
const issueCount = document.getElementById("issueCount");
const reviewStatus = document.getElementById("reviewStatus");
const finalButton = document.getElementById("generateFinalPemx");
const projectNumberInput = document.getElementById('projectNumber');

// store the currently reviewed records and loaded template
let reviewedRecords = [];
let templateData = null;


// enable manual review when all required inputs are present
function updateProcessButton () {
    const uploadedCsv = componentCsv.files.length > 0;
    const uploadedTemplate = templateFileInput.files.length > 0;
    const enteredProjectNumber = projectNumberInput.value.trim() !== '';

    processButton.disabled = !uploadedCsv || !uploadedTemplate || !enteredProjectNumber;
}

// create a normal table cell and add it to the row
function createTableCell (row) {
    const cell = document.createElement("td");
    row.appendChild(cell);

    return cell;
}

// create an text input that you can write into
function createTextInput (value) {
    const input = document.createElement("input");
    input.type = 'text';
    input.value = value;

    return input;
}

// update the visual label preview for one record
function updateLabelPreview (record, previewContainer) {
    // remove the previous contents
    previewContainer.textContent = '';

    // create the bold device mark
    const markLine = document.createElement("span");

    markLine.className = 'preview-mark';
    markLine.textContent = record.mark;

    previewContainer.appendChild(markLine);

    // show a placeholder when no description exists
    if (record.description === '') {
        const missingLine = document.createElement('span');

        missingLine.className = 'preview-description';
        missingLine.textContent = 'NO DESCRIPTION';

        previewContainer.appendChild(missingLine);
        return;
    }

    // use the actual device formatting logic to preview the label
    const formatted = formatDescription(record.description);

    // create one preview line per formatted line
    for (let i = 0; i < formatted.lines.length; i++) {
        const descLine = document.createElement('span');

        descLine.className = 'preview-description';
        descLine.textContent = formatted.lines[i];
        descLine.style.fontSize = formatted.fontSize + 'pt';

        previewContainer.appendChild(descLine);
    }
}

// update the status message for one table row
function updateRecordStatus (record, row, previewContainer, statusElement) {
    updateLabelPreview(record, previewContainer);

    // fade records that won't be included by changing opacity
    if (!record.include) {
        row.style.opacity = '0.5';
        statusElement.className = 'record-status';
        statusElement.textContent = 'EXCLUDED';
        return;
    }

    // set opacity to default
    row.style.opacity = '1';

    // error/warning array
    const errors = [];

    // check the fields required for a printable label
    if (record.mark === '') {
        errors.push('MISSING MARK');
    }

    if (record.description === '') {
        errors.push('MISSING DESCRIPTION');
    }
    
    // include issues found while combining source records
    for (let i = 0; i < record.issues.length; i++) {
        errors.push(record.issues[i]);
    }

    // show ready status when no problems found
    if (errors.length === 0) {
        statusElement.className = 'record-status';
        statusElement.textContent = 'READY';
    
    } else {   
        // print the error array
        statusElement.className = 'record-status issue';
        statusElement.textContent = errors.join(', ');
    }
}

// count included records and determine whether the final generation is allowed
function updateReviewSummary () {
    let includedRecords = 0;
    let missingRecords = 0;
    let issueRecords = 0;

    // loop through the records
    for (let i = 0; i < reviewedRecords.length; i++) {
        const record = reviewedRecords[i];

        // ignore records excluded by the user
        if (!record.include) {
            continue;
        }

        // update searched records
        includedRecords++;

        // marks and descriptions are both required for the final generation
        if (record.mark === '' || record.description === '') {
            missingRecords++;
        }
        // log issue count
        if (record.issues.length > 0) { 
            issueRecords++;
        }
    }

    // update HTML elements with these calculated values
    recordCount.textContent = includedRecords;
    missingCount.textContent = missingRecords;
    issueCount.textContent = issueRecords;

    // final generation requires at least one complete included record
    finalButton.disabled = includedRecords === 0 || missingRecords > 0;

    if (includedRecords === 0) {
        reviewStatus.textContent = "Select at least one record for the final PEMX";
    } else if (missingRecords > 0) {
        reviewStatus.textContent = "Fill the missing fields or exclude those records before generating the final PEMX";
    } else if (issueRecords > 0) {
        reviewStatus.textContent = "All required fields are complete. Review the remaining conflicts before generating the final PEMX";
    } else {
        reviewStatus.textContent = "All records are healthy and ready to generate final PEMX";
    }
}

// create one editable row for a device record
function createReviewRow (record) {
    const row = document.createElement('tr');

    // new records are included by default
    record.include = true;

    // create the include checkbox
    const includeCell = createTableCell(row);
    const includeInput = document.createElement("input");

    includeInput.type = 'checkbox';
    includeInput.checked = true;

    includeCell.className = 'include-column';
    includeCell.appendChild(includeInput);

    // create the editable mark field
    const markCell = createTableCell(row);
    const markInput = createTextInput(record.mark);
    markCell.appendChild(markInput);

    // create the editable description field
    const descCell = createTableCell(row);
    const descInput = createTextInput(record.description);
    descCell.appendChild(descInput);

    // create the editable part nubmber field?
    const pnCell = createTableCell(row);
    const pnInput = createTextInput(record.partNumber);
    pnCell.appendChild(pnInput);

    // create the label preview
    const previewCell = createTableCell(row);
    const previewContainer = document.createElement("div");

    previewContainer.className = 'label-preview';
    previewCell.appendChild(previewContainer);

    // create the record status
    const statusCell = createTableCell(row);
    const statusElement = document.createElement("span");
    statusElement.className = 'record-status';
    statusCell.appendChild(statusElement);

    // include or exclude the record
    includeInput.addEventListener("change", function () {
        record.include = includeInput.checked;

        // update the table once changed
        updateRecordStatus(record, row, previewContainer, statusElement);
        updateReviewSummary();
    });

    // update the table field when it is edited
    // update the mark when the user edits it
    markInput.addEventListener("input", function () {
        // normalize text
        let updatedMark = markInput.value.trim();
        updatedMark = updatedMark.toUpperCase();
        updatedMark = normalizeDeviceMark(updatedMark);

        record.mark = updatedMark;

        updateRecordStatus(record, row, previewContainer, statusElement);
        updateReviewSummary();

    });

    // update and reformat the description while the user types
    descInput.addEventListener("input", function () {
        let updatedDesc = descInput.value.trim();

        updatedDesc = updatedDesc.toUpperCase();
        record.description  = updatedDesc;

        updateRecordStatus(record, row, previewContainer, statusElement);
        updateReviewSummary();
    });

    // preserve an edited part number for later smart processing
    pnInput.addEventListener('input', function () {
        let updatedPartNumber = pnInput.value.trim();

        updatedPartNumber = updatedPartNumber.toUpperCase();
        record.partNumber = updatedPartNumber;
    });

    // render the initial preview and status
    updateRecordStatus(record, row, previewContainer, statusElement);

    return row;
}

// popualte the review table using the cleaned device records
function renderReviewTable () {
    // remove rows from any previous processing
    reviewTableBody.textContent = '';

    // create one table row for every cleaned record
    for (let i = 0; i < reviewedRecords.length; i++) {
        const record = reviewedRecords[i];
        const row = createReviewRow(record);

        reviewTableBody.appendChild(row);
    }

    updateReviewSummary();

    // dispaly the completed review table
    reviewSection.hidden = false;
}

// process the CSV and tie it all together without generating a PEMX
async function processInputFiles (event) {
    event.preventDefault();

    const csvFile = componentCsv.files[0];
    const selectedTemplateFile  = templateFileInput.files[0];

    if (!csvFile || !selectedTemplateFile) {
        processingStatus.textContent = "Select a component CSV and the provided PEMX template";
        return;
    }

    processButton.disabled = true;
    processButton.textContent = "Processing...";
    processingStatus.textContent = "Reading and cleaning the selected files...";
    reviewSection.hidden = true;

    try {
        // read and parse the component CSV
        const csvText = await csvFile.text();
        const rows = parseCsv(csvText);

        // clean suffixes, remove filtered records, and combine duplicates
        reviewedRecords = getDeviceRecords(rows);

        if (reviewedRecords.length === 0) {
            throw new Error("The CSV does not contain any usable device records.");
        }

        // read and validate the template without generating a new PEMX yet
        templateData = await readTemplate(selectedTemplateFile);

        if (!templateData.project.documents || templateData.project.documents.length <= DEVICE_DOCUMENT_INDEX) {
            throw new Error("The PEMX template is missing the device label document.");
        }

        renderReviewTable();

        processingStatus.textContent = "Processing Complete. Review the table below.";
    } catch (error) {
        console.error(error);

        // clean up variables
        processingStatus.textContent = error.message;
        reviewedRecords = [];
        templateData = null;
    }

    processButton.textContent = 'Process and Review Labels';
    updateProcessButton();
}

// collect all the reviewed records and generate the final PEMX
function generateFinalPemx() {
    if (!templateData) {
        reviewStatus.textContent = "Process the input files before generating the PEMX";
        return;
    }

    const projectNumber = projectNumberInput.value.trim();

    if (projectNumber === '') {
        reviewStatus.textContent = 'Enter a project number before generating the PEMX';
        return;
    }

    finalButton.disabled = true;
    finalButton.textContent = "Generating...";
    reviewStatus.textContent = "Generating the final PEMX file...";

    try {
        const finalRecords = [];

        // collect only the records selected by the user
        for (let i = 0; i < reviewedRecords.length; i++) {
            const reviewedRecord = reviewedRecords[i];

            if (!reviewedRecord.include) {
                continue;
            }

            // copy only the final v alues required by the formatting tool
            // perform final cleanup on each property of the Object
            const finalRecord = {
                mark: reviewedRecord.mark.trim().toUpperCase(),
                description: reviewedRecord.description.trim().toUpperCase(),
                partNumber: reviewedRecord.partNumber.trim().toUpperCase()
            };

            if (finalRecord.mark === '' || finalRecord.description === '') {
                throw new Error("Every included record requires a mark and description. Please add them.");
            }

            finalRecords.push(finalRecord);
        }

        if (finalRecords.length === 0) {
            throw new Error("No records are selected for the final generation.");
        }

        // apply wrapping and font-size rules
        const preparedLabels = prepareLabels(finalRecords);

        // replace the device document labels inside a copied template (to not overwrite the original)
        const completedProject = buildProject(templateData.project, preparedLabels);
        

        // package the completed project and preserved template files
        const pemxFile = createPEMX(completedProject, templateData.files);

        // start the final browser download
        const outputFileName = projectNumber + ' - Device Labels.pemx';
        downloadFile(pemxFile, outputFileName);

        reviewStatus.textContent = "The final PEMX was generated successfully, check your files.";
    } catch (error) {
        console.error(error);

        reviewStatus.textContent = error.message;
    }

    const generationMessage = reviewStatus.textContent;
    finalButton.textContent = "Generate final PEMX";
    updateReviewSummary();

    reviewStatus.textContent = generationMessage;

}  

// watch the two required file inputs
componentCsv.addEventListener("change", updateProcessButton);
templateFileInput.addEventListener("change", updateProcessButton);

// watch for the entered project number
projectNumberInput.addEventListener('input', updateProcessButton);

// process the CSV and show the review table
basicDeviceForm.addEventListener("submit", processInputFiles);

// generate the PEMX only after review
finalButton.addEventListener("click", generateFinalPemx);

// set the correct initial button state
updateProcessButton();