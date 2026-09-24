// shared formatting and project-building functions for device labels
let singleLineFuse = true;
const DEVICE_DOCUMENT_INDEX = 1;

// remove child or connection suffixes from a device mark (.IN, .LOAD, etc.)
function normalizeDeviceMark (mark) {
    const suffixPosition = mark.indexOf('.');

    // keep only the text before the period (N70305.IN1 keeps N70305)
    if (suffixPosition >= 0) {
        return mark.slice(0, suffixPosition);
    }

    return mark;
}

// convert CSV rows into cleaned device record objects
function getDeviceRecords (rows) {
    // use the cleaned mark as the key to prevent duplicate labels
    const recordsByMark = new Map();

    // process every row from the parsed CSV
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];

        // read all three columns and use empty strings when cells are missing
        const markCell = row[0] || '';
        const descCell = row[1] || '';
        const pnCell = row[2] || '';

        // remove outside spaces and normalize text
        let mark = markCell.trim();
        mark = mark.toUpperCase();
        mark = normalizeDeviceMark(mark);

        let description = descCell.trim();
        description = description.toUpperCase();
        description = removeRepeatedText(description);

        let partNumber = pnCell.trim();
        partNumber = partNumber.toUpperCase();

        // skip the CSV heading row
        if (mark === 'MARK' && description === 'DESCRIPTION') {
            continue;
        }

        // if a device record is unusable without a mark
        if (mark === '') {
            continue;
        }

        // ignore devices that start with FU, PN, FC unless they have a description
        if(mark.startsWith('FU') || mark.startsWith('PN') || mark.startsWith ('FC') || mark.startsWith('EXH') || mark.startsWith('PI') || mark.startsWith('PL') && description === '') {
            continue;
        }

        // check if the mark already exists inside of the Map (has)
        // if not, store it (set)
        if (!recordsByMark.has(mark)) {
            const record = {
                mark: mark,
                description: description,
                partNumbers: [],
                sourceCount: 1,
                issues: []
            };

            addUniquePartNumber(record.partNumbers, partNumber);
            recordsByMark.set(mark, record);
            continue;
        }

        // merge child rows and duplicate rows into the existing record
        const existingRecord = recordsByMark.get(mark);

        existingRecord.sourceCount++;

        // preserve every unique part number associated with this mark
        addUniquePartNumber(existingRecord.partNumbers, partNumber);

        // keep a description when the existing record is blank
        if (existingRecord.description === '' && description !== '') {
            existingRecord.description = description;
            
        // report different descriptions instead of silently replacing one
        } else if (description !== '' && existingRecord.description !== description) {
            addIssueOnce(existingRecord, 'CONFLICTING DESCRIPTIONS');
        }

    }

    // convert the Map into an array
    const recordValues = recordsByMark.values();
    const records = Array.from(recordValues);

    return records;
}

// split descriptions into lines using character limits and handling
function wrapText (text, maxChars) {
  // separate the text into individual words
  const words = text.split(' ');

  // store the completed lines and build one at a time
  const lines = [];
  let currentLine = '';

  // add words until the next words exceeeds the defined limited
  for (let i = 0; i < words.length; i++) {
    const word = words[i];

    // ignore empty ones
    if (word === '') {
      continue;
    }

    // start an empty line with the current word
    if (currentLine === '') {
      currentLine = word;
      continue;
    }

    // try adding a word with a space before it
    const potentialLine = currentLine + ' ' + word;

    // keep the word if it fits on that line
    if (potentialLine.length <= maxChars) {
      // overwrite
      currentLine = potentialLine;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }

  // save the last line left over after the loop is done
  if (currentLine !== '') {
    lines.push(currentLine);
  }

  return lines;
}

// choose description lines and font size for one device at a time
function formatDescription (description) {
  // remove spaces surrounding the complete description
  const fullDesc = description.trim();

  // read the fuse type before the first comma
  const fuseParts = fullDesc.split(',');
  const getFuseType = fuseParts[0].trim().toUpperCase();

  // check whether this fuse type uses the smaller single-line format
  const correctFuse = getFuseType === 'MDL' || getFuseType === 'ABC';

  // place supported fuse descriptions on one compact line
    if (singleLineFuse && correctFuse) {
        let compactFuseDescription = '';

        // rebuild the comma-separated description without unnecessary spaces
        for (let i = 0; i < fuseParts.length; i++) {
            if (i > 0) {
                compactFuseDescription += ',';
            }

            compactFuseDescription += fuseParts[i].trim();
        }

        return {
            lines: [compactFuseDescription],
            fontSize: 7
        };
    }

  // start with the normal desc size and char limit
  let fontSize = 9;
  let maxChars = 12;

  // automatically divie the description into printable lines
  let lines = wrapText(fullDesc, maxChars);

  // if there are more than two lines, use the smaller font
  let needsSmallerFont = lines.length > 2;

  // also use the smaller font if an individual word is too long
  for (let i = 0; i < lines.length; i++) {
    if(lines[i].length > maxChars) {
        needsSmallerFont = true;
    }
  }

  // wrap the description using the smaller font's wider character limit
  // small font handling
  if (needsSmallerFont) {
    fontSize = 7;
    maxChars = 16;
    lines = wrapText(fullDesc, maxChars);
  }

  // return the text layout and selected font size
  return {
    lines: lines,
    fontSize: fontSize
  };

}


// prepare device records for insert into the PEMX project
function prepareLabels (records) {
    const preparedLabels = [];

    // format every device record
    for (let i = 0; i < records.length; i++) {
        const record = records[i];

        // choose the description lines and font size
        const formatted = formatDescription(record.description);

        // store only the information that will be printed
        const preparedLabel = {
            mark: record.mark,
            lines: formatted.lines,
            fontSize: formatted.fontSize
        };

        preparedLabels.push(preparedLabel);
    }

    return preparedLabels;
}


// format the label into the PEMX format
// preparedLabel is the local one in this file
// templateLabel is the one from the PEMX template you upload
function makeLabel (templateLabel, preparedLabel) {
    // confirm the template is valid - check for mark and description paragraphs
    if(!templateLabel.inlineContent || templateLabel.inlineContent.length < 2) {
        throw new Error('The PEMX template must contain a mark and description paragraph. Please check the template uploaded.');
    }

    // copy the PEMX template's complex structure
    const createdLabel = copyObject(templateLabel);

    // use the first two template paragraphs as formatting samples
    // these exist inside the template
    const markTemplate = templateLabel.inlineContent[0];
    const descTemplate = templateLabel.inlineContent[1];

    // array to collect the newly formattd paragraphs/content
    const paragraphs = [];

    // create the device mark with 10 pt bold font
    const markParagraph = makeParagraph(markTemplate, preparedLabel.mark, 10, 'bold');
    paragraphs.push(markParagraph);

    // create one paragraph for each prepared description line
    for (let i = 0; i < preparedLabel.lines.length; i++) {
        const descText = preparedLabel.lines[i];
        const descParagraph = makeParagraph(descTemplate, descText, preparedLabel.fontSize, 'normal');
        
        paragraphs.push(descParagraph);
    }

    // replace the template's text with these new formatted paragraphs
    createdLabel.inlineContent = paragraphs;

    // give the copied label fresh IDs
    refreshRuntimeIDs(createdLabel);

    return createdLabel;
}   


// build a complete Easy-Mark project from the prepared labels
function buildProject (templateProject, formattedLabels) {
    // copy the entire project
    const project = copyObject(templateProject);

    // confirm the project contains a label file
    if (!project.documents || project.documents.length <= DEVICE_DOCUMENT_INDEX) {
        throw new Error('The PEMX template is missing the device label document');
    }

    // work with the SECOND document in the project (first is WIRES)
    const deviceLabelDoc = project.documents[DEVICE_DOCUMENT_INDEX];

    // confirm the document contains sample labels
    if(!deviceLabelDoc.labels || deviceLabelDoc.labels.length === 0) {
        throw new Error('The PEMX template is missing sample device labels');
    }

    // use its fir label as the sample for all further labels
    const templateSingleLabel = deviceLabelDoc.labels[0];

    // collect the formatted labels into an array
    const newLabels = [];

    // build one label per prepared record
    for (let i = 0; i < formattedLabels.length; i++) {
        const formattedLabel = formattedLabels[i];
        const newLabel = makeLabel(templateSingleLabel, formattedLabel);

        newLabels.push(newLabel);
    }

    // replace the sample labels with the generated labels
    deviceLabelDoc.labels = newLabels;

    return project;
}

// remove descriptions that SWE exported multiple times in the same cell
function removeRepeatedText (text) {
    const cleanedText = text.trim();

    // try every possible repeated section length
    for (let sectionLength = 1; sectionLength <= cleanedText.length / 2; sectionLength++) {
        
        // repeated sections must divide evenly into the complete string
        if (cleanedText.length % sectionLength !== 0) {
            continue;
        }

        const section = cleanedText.slice(0, sectionLength);
        let rebuiltText = '';
        
        // rebuild the full description using the possible repeated section
        while (rebuiltText.length < cleanedText.length) {
            rebuiltText += section;
        }

        // return one copy when the rebuilt text matches the original
        if (rebuiltText === cleanedText) {
            return section.trim();
        }
    }

    return cleanedText;
}

// add a part number unless the record already contains it
function addUniquePartNumber (partNumbers, newPartNumber) {
    if (newPartNumber === '') {
        return;
    }

    // search the existing part numbers
    for (let i = 0; i < partNumbers.length; i++) {
        if (partNumbers[i] === newPartNumber) {
            return;
        }
    }

    partNumbers.push(newPartNumber);
}

// add an issue unless the record already contains it
function addIssueOnce (record, newIssue) {

    for (let i = 0; i < record.issues.length; i++) {
        if (record.issues[i] === newIssue) {
            return;
        }
    }
    record.issues.push(newIssue);
}

// remove a specific issue from a device record
function removeIssue (record, issueToRemove) {
    const remainingIssues = [];

    for (let i = 0; i < record.issues.length; i++) {
        if (record.issues[i] !== issueToRemove) {
            remainingIssues.push(record.issues[i]);
        }
    }

    record.issues = remainingIssues;
}