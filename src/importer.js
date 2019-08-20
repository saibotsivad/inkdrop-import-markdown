import fs from 'fs'
import path from 'path'
import { remote } from 'electron'
import { models } from 'inkdrop'
import Cutter from 'utf8-binary-cutter'
const { dialog } = remote
const { Note } = models

const completedStatuses = [ 'Completed', 'Archived' ]
function parseDateString(date) {
  const d = new Date(date)
  return d.getTime()
}

export function openImportDialog() {
  return dialog.showOpenDialog({
    title: 'Open Markdown file',
    properties: [
      'openFile', 'multiSelections'
    ],
    filters: [
      { name: 'Markdown Files', extensions: [ 'md', 'txt' ] }
    ]
  })
}

export async function importMarkdownFromMultipleFiles (files, destBookId) {
  try {
    for (let i = 0; i < files.length; ++i) {
      await importMarkdownFromFile(files[i], destBookId)
    }
  } catch (e) {
    inkdrop.notifications.addError('Failed to import the Markdown file', { detail: e.stack, dismissable: true })
  }
}

function parseMarkdown(markdown) {
  const [ firstLine, metadataString, ...restLines ] = markdown.trim().split('\n\n')

  const metadata = metadataString
    .split('\n')
    .map(line => {
      const [ key, ...value ] = line.split(':')
      return {
        key: key.trim(),
        value: value.join(':').trim()
      }
    })
    .reduce((map, { key, value }) => {
      map[key] = value
      return map
    }, {})

  const tags = []
  Object
    .keys(metadata)
    .forEach(key => {
      if (key === 'Tags') {
        tags.push(...metadata[key].split(',').map(s => s.trim()))
      }
    })

  const status = completedStatuses.includes(metadata.Status)
    ? 'completed'
    : (
      metadata.Status === 'In Progress'
        ? 'active'
        : undefined
    )

  const createdAt = metadata['Created Date']
    ? parseDateString(metadata['Created Date'])
    : Date.now()

  const note = {
    title: firstLine.replace(/^# /, ''),
    body: restLines.join('\n\n'),
    tags,
    createdAt,
    updatedAt: Date.now()
  }

  if (status) {
    note.status = status
  }

  return note
}

export async function importMarkdownFromFile (fn, destBookId) {
  if (!destBookId) {
    throw new Error('Destination notebook ID is not specified.')
  }
  const markDown = fs.readFileSync(fn, 'utf-8')
  const note = new Note(parseMarkdown(markDown))
  note.bookId = destBookId
  await note.save()
}
