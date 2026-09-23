// CSV SUPPORT — CSV parsing and handling
function parseCsv (csvText) {
  // store every row from the csv
  const rows = []

  // build each row
  let currentRow = []

  // build one cell
  let currentCell = ''

  // inside quoted cells, commas and line breaks are text (helps handling)
  let insideQuotes = false

  // Excel adds invisible chars at the start of CSV files sometimes; remove it
  if (csvText.charCodeAt(0) == 0xfeff) {
    csvText = csvText.slice(1)
  }

  // read CSV one char at a time
  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i]
    const nextChar = csvText[i + 1]

    // back-to-back quotes inside a cell: keep one and skip the other
    if (char === '"' && insideQuotes && nextChar === '"') {
      // add a quote to the cell's text
      currentCell += '"'
      // advance
      i++

      // switch states - entering or leaving the quoted text
    } else if (char === '"') {
      insideQuotes = !insideQuotes

      // a comma outside quotes finishes that cell, move on.
    } else if (char === ',' && !insideQuotes) {
      // add it to the row as this cell is complete
      currentRow.push(currentCell)
      // reset the string when moving to the next cell
      currentCell = ''

      // a line-break outside quotes finishes the row
    } else if ((char === '\n' || char === '\r') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++
      }

      // save the final cell of this row then save the row
      currentRow.push(currentCell)
      rows.push(currentRow)

      // clean the variables up for the next processed row
      currentCell = ''
      currentRow = []

      // ordinary text processing
    } else {
      currentCell += char
    }
  }

  // if this flag still on outside of the loop, error out
  if (insideQuotes) {
    throw new Error('The CSV contains a cell with a missing closing quote.')
  }

  // if not empty, push
  if (currentCell !== '' || currentRow.length > 0) {
    currentRow.push(currentCell)
    rows.push(currentRow)
  }

  return rows
}
