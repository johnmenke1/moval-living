// Test what marked produces for typical user inputs
import { marked } from 'marked'

marked.setOptions({
  gfm: true,
  breaks: false,
  pedantic: false,
})

const samples = {
  'two paragraphs separated by blank line': `This is paragraph one.

This is paragraph two.`,

  'paragraphs with single newlines (no blank line)': `Line one of paragraph.
Line two of same paragraph.

Next paragraph.`,

  'rich paste (multiple paragraphs, no blank lines)': `The train pulls out of Oceanside just before 9 AM.

By the time we hit San Clemente, the marine layer has burned off and the coast is sharp against the sky.

We walk El Camino Real end to end, slowly.`,

  'user-typed with hard line breaks': `First thought here.
Second thought here.
Third thought here.

New paragraph.`,
}

for (const [label, input] of Object.entries(samples)) {
  console.log('\n=== ' + label + ' ===')
  console.log('INPUT:')
  console.log(JSON.stringify(input))
  console.log('OUTPUT:')
  console.log(marked.parse(input, { async: false }))
}