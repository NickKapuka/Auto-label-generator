// shared functions for reading and modifying PEMX projects

// separate encoders so this file doesn't require zip.js variables
const pemxEncoder = new TextEncoder();
const pemxDecoder = new TextDecoder('utf-8');

// helper function for formatting
// pemx files have project.json inside them
function copyObject (original) {
    // convert the object and its contents into JSON text
    const jsonText = JSON.stringify(original);

    // convert that text back into a new object
    const copiedObject = JSON.parse(jsonText);

    return copiedObject;
}

// helper function to format data into the format PEMX's JSON expects/accepts
function makeParagraph (templateParagraph, text, fontSize, fontWeight) {
    // copy the paragraph so the template itself doesn't change
    const paragraph = copyObject(templateParagraph);

    // use the first text from the copied paragraph
    const textPart = paragraph.content[0];

    // replace its text and apply fonts
    textPart.text = text;
    textPart.style.fontFamily = 'Arial';
    textPart.style.fontSize = fontSize;
    textPart.style.fontWeight = fontWeight;

    // replace any old text pieces with this update pieces
    paragraph.content = [textPart];

    // keep the paragraph default normal, bolding is set on textPart
    paragraph.style.fontWeight = 'normal';

    return paragraph;
}

// helper function for PEMX formatting once again
// provides copied PEMX elements fresh internal IDs to avoid the mess of duplicate IDs
// like copying a database record but giving the copy a new primary key - kinda?
function refreshRuntimeIDs (item) {
  // check for null
  if (item === null || typeof item !== 'object') {
    return;
  }

    // get the property names belonging to this object
  const keys = Object.keys(item);

  // check each property for an ID or nested content
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];

    // replace the copied ID with a new one
    if (key === '@runtime-id') {
      // browser function that regens ID
      item[key] = crypto.randomUUID();

    // search inside the property's values for more IDs
    } else {
      // recursive - please do not edit around here
      refreshRuntimeIDs(item[key]);
    }
  }
}


// helper function to read the uploaded template
async function readTemplate (file) {
  // extract the files within the PEMX using the ZIP handlers in zip.js
  const files = await readZip(file);

  // stop the function if the archive doesn't contain project data
  if (!files.has('project.json')) {
    throw new Error('The selected PEMX is missing project.json');
  }

  // retrieve the raw bytes belonging to project.json
  const projectBytes = files.get('project.json');

  // convert the project's bytes into readable JSON
  const projectText = pemxDecoder.decode(projectBytes);

  // convert JSON text iinto the objects the functions here work with
  const project = JSON.parse(projectText);

  // keep the other archive files so they can be included when saving
  return {
    project: project,
    files: files
  };
}

// PEMX packer function
function createPEMX (project, templateFiles) {
  // convert the completed project into JSON text then bytes
  const projectText = JSON.stringify(project);
  const projectBytes = pemxEncoder.encode(projectText);

  // copy the file list so the original template entries remain unchanged
  const outputFiles = new Map(templateFiles);

  // replace the old project.json with the newly generated version
  outputFiles.set('project.json', projectBytes);

  // convert the Map into the array expected by createZip()
  const entries = Array.from(outputFiles.entries());

  // package the files into a ZIP ready for downloading as a PEMX
  const pemxFile = createZip(entries);

  return pemxFile;
}

// download a generated file through the browser
function downloadFile (file, filename) {
  // create a temporary browser URL pointing to the generated file
  const fileURL = URL.createObjectURL(file);

  // create a download link with the request filename
  const link = document.createElement('a');
  link.href = fileURL;
  link.download = filename;

  // add the link to the page so the browser can activate it
  document.body.appendChild(link);

  // activate the hidden link to begin the download
  link.click();

  // remove the temporary HTML element
  link.remove();

  // release the temp URL after the download has started
  setTimeout(function () {
    URL.revokeObjectURL(fileURL);
  }, 5000);
}