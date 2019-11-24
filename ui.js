

let mode = 'pattern-edit'

let patterns = []

let sequence

let tempo = 120

let editPatternIdx = 0, patternStep = 0, songStep = 0

let song = new Array(32).fill().map(() => ([]))

const selectedPianoKeys = new Array(25).fill(false)
let pianoKeysOffset = 12 * 3
let copiedStep = 0
let copiedPattern = 0

const measPerf = name => {
    if (name) {
        console.log(name + ' - diff: ', performance.now() - p0)
    }
    p0 = performance.now()
}

const getBytes = (value, sz, bytesParam) => {
    const bytes = bytesParam ? bytesParam : []
    for (let i = 0; i < sz; i++) {
        bytes[i] = 0xFF & (value >> (8 * i))
    }
    return bytes
}

function renderDownload() {
    renderDownloadButton.style.display = 'none'
    currentTime = 0
    const renderProcessor = new SimpleSynth()
    renderProcessor.handlePortEvent({ type: 'update-sequence', sequence })
    Object.keys(instruments).forEach(key => renderProcessor.handlePortEvent({ type: 'preset', presetId: key, presetData: instruments[key] }))

    const delayMs = Number(document.querySelector('#delay-time').value) / tempo * 15 * 1000
    const feedback = Number(document.querySelector('#delay-feedback').value)
    renderProcessor.handlePortEvent({
        type: 'delay-parameters',
        delayMs, feedback
    })
    renderProcessor.handlePortEvent({ type: 'start-sequence', sequence, offset: 0 })
    let sampleBuf = []
    //let max = -Infinity, min = Infinity

    measPerf()

    while (currentTime < (sequence[sequence.length - 1].position + 1000) / 1000) {
        const buf = new Array(128).fill(0)
        renderProcessor.process(undefined, [[buf]])
        /*min = Math.min(...buf, min)
        max = Math.max(...buf, max)*/
        sampleBuf.push(...buf)
    }

    measPerf('process audio')

    //const peakMax = Math.max(Math.abs(min), Math.abs(max))

    const header = [
        ...'RIFF'.split('').map(x => x.charCodeAt(0)),
        ...getBytes(sampleBuf.length * 2 + 36, 4),
        ...'WAVE'.split('').map(x => x.charCodeAt(0)),
        ...'fmt '.split('').map(x => x.charCodeAt(0)),
        ...getBytes(16, 4),
        ...getBytes(1, 2),
        ...getBytes(1, 2),
        ...getBytes(44100, 4),
        ...getBytes(44100 * 2, 4),
        ...getBytes(2, 2),
        ...getBytes(16, 2),
        ...'data'.split('').map(x => x.charCodeAt(0)),
        ...getBytes(sampleBuf.length * 2, 4),
    ]

    let resultArray = header

    const twoByteBuf = [0, 0]
    for (let i = 0; i < sampleBuf.length; i++) {
        let val = Math.min(Math.max(sampleBuf[i], -1), 1);
        /*if (peakMax > 1) {
            val /= peakMax
        }*/
        val *= 32767
        val = Math.floor(val)
        getBytes(val, 2, twoByteBuf)
        resultArray.push(twoByteBuf[0])
        resultArray.push(twoByteBuf[1])
    }
    sampleBuf = undefined

    measPerf('post process buffer')

    const byteArray = new Uint8Array(resultArray)
    resultArray = undefined

    function download(filename, data) {
        var element = document.createElement('a');
        element.setAttribute('download', filename);

        element.style.display = 'none';
        document.body.appendChild(element);
        const objUrl = URL.createObjectURL(new Blob([data], { type: "application/octet-stream" }))
        element.href = objUrl

        measPerf('create dl link')

        setTimeout(function () { URL.revokeObjectURL(objUrl) }, 4E4) // 40s
        setTimeout(function () { element.click(); document.body.removeChild(element); }, 0)


    }
    download('song.wav', byteArray)
    renderDownloadButton.style.display = 'inline-block'
}

let linkExpirationTimeout = undefined

function getLink() {
    if (linkExpirationTimeout !== undefined) {
        clearTimeout(linkExpirationTimeout)
    }
    const a = document.querySelector('#share-link')
    a.innerText = 'Share this link!'
    a.href = location.origin + location.pathname + '?' + btoa(getProjectJsonString())
    linkExpirationTimeout = setTimeout(() => {
        a.innerText = ''
        a.href = '#'
    }, 30000)
}

function changeOctave(amount) {
    pianoKeysOffset += 12 * amount
    if (pianoKeysOffset < 0) pianoKeysOffset = 0
    else if (pianoKeysOffset > 108) pianoKeysOffset = 108
    document.querySelector('#keyboard-octave').innerText = pianoKeysOffset / 12 - 3
    const realAmount = pianoKeysOffset - patterns[editPatternIdx].pianoKeysOffset
    patterns[editPatternIdx].pianoKeysOffset = pianoKeysOffset
    patterns[editPatternIdx].notes = patterns[editPatternIdx].notes.map(notes => notes.map(noteNum => noteNum + realAmount))
    renderPatternGrid()
    sequence = getPatternSequence(editPatternIdx)
    processor.port.postMessage({ type: 'update-sequence', sequence })
}

function instrumentChanged() {
    const selectedInstrument = document.querySelector('#instrument-select').value
    patterns[editPatternIdx].instrument = selectedInstrument

    instrumentParametersToUi()

    sequence = getPatternSequence(editPatternIdx)
    processor.port.postMessage({ type: 'update-sequence', sequence })
    processor.port.postMessage({ type: 'preset', presetId: selectedInstrument, presetData: instruments[selectedInstrument] })
}

function tempoChanged() {
    const num = document.querySelector('#tempo-input').value
    if (num <= 0 || num > 999) return;
    tempo = num
    document.querySelector('#tempo-display').innerText = tempo
    sendDelayParamsChanged()
    if (mode === 'pattern-edit') {
        sequence = getPatternSequence(editPatternIdx)
    } else if (mode === 'song-edit') {
        getSequenceFromSong()
    }
    processor.port.postMessage({ type: 'update-sequence', sequence })
}

function delaySendAmountChanged(amount) {
    patterns[editPatternIdx].delaySend = amount
    sequence = getPatternSequence(editPatternIdx)
    processor.port.postMessage({ type: 'update-sequence', sequence })
}

function htmlEscape(str) {
    return str.replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function ensurePatternExists(idx) {
    if (!patterns[idx]) {
        patterns[idx] = {
            notes: new Array(32).fill().map(() => ([])),
            instrument: document.querySelector('#instrument-select').value,
            name: `Pattern ${idx + 1}`,
            pianoKeysOffset: pianoKeysOffset,
            delaySend: 0
        }
    }
}

function switchMode(newMode) {
    mode = newMode
    if (mode === 'pattern-edit') {
        document.querySelector('#pattern-controls').style.display = 'block'
        document.querySelector('#song-controls').style.display = 'none'
        document.querySelector('#piano-keys').style.display = 'block'
        changePattern(0)
    } else if (mode === 'song-edit') {
        document.querySelector('#song-controls').style.display = 'block'
        document.querySelector('#pattern-controls').style.display = 'none'
        document.querySelector('#piano-keys').style.display = 'none'
        document.querySelector('#pattern-select').innerHTML = patterns.map((p, i) => `<option value="${i}">${htmlEscape(p.name)}` + '</option>').join('')
        renderSongGrid()
        getSequenceFromSong()
    }
}

function getSequenceFromSong() {
    sequence = []

    song.forEach((songPatterns, idx) => {
        const positionOffset = idx * 32 / tempo * 15 * 1000;
        const songStepNotes = {}

        songPatterns.forEach(p => getPatternSequence(p, positionOffset).forEach(noteData => {
            if (!songStepNotes[noteData.position]) {
                songStepNotes[noteData.position] = []
            }
            songStepNotes[noteData.position].push(...noteData.notes)
        }))

        Object.keys(songStepNotes).map(Number).sort((a, b) => a - b).forEach(position => {
            sequence.push({
                position,
                notes: songStepNotes[position]
            })
        })
    })
}

function changePatternFromUi(amount) {
    if (editPatternIdx + amount < patterns.length) {
        changePattern(amount)
    }
}

function createPattern() {
    editPatternIdx = patterns.length - 1
    changePattern(1)
}

function changePattern(amount, updateSequence = true) {
    editPatternIdx += amount
    if (editPatternIdx < 0) editPatternIdx = 0
    if (editPatternIdx > 99) editPatternIdx = 99
    ensurePatternExists(editPatternIdx)

    pianoKeysOffset = patterns[editPatternIdx].pianoKeysOffset
    document.querySelector('#keyboard-octave').innerText = pianoKeysOffset / 12 - 3

    document.querySelector('#pattern-number').innerText = editPatternIdx + 1
    document.querySelector('#pattern-name').value = patterns[editPatternIdx].name
    document.querySelector('#instrument-select').value = patterns[editPatternIdx].instrument
    document.querySelector('#delay-amount-select').value = patterns[editPatternIdx].delaySend

    instrumentParametersToUi()

    patternStep = 0
    getSelectedPianoKeysFromGridCell()
    renderPianoKeys(false)
    renderPatternGrid()
    sequence = getPatternSequence(editPatternIdx)
    processor.port.postMessage({ type: 'update-sequence', sequence })
}

function instrumentParametersToUi() {
    const params = ["attack", "decay", "sustain", "release", "cutoff", "resonance", "adsrToFilter", "distortion", "volume"]
    params.forEach(p => document.querySelector(`#instr-edit-${p}`).value = instruments[patterns[editPatternIdx].instrument][p])
}

function changePatternName() {
    patterns[editPatternIdx].name = document.querySelector('#pattern-name').value
}

function getSelectedPianoKeysFromGridCell() {
    for (let i = 0; i < selectedPianoKeys.length; i++) selectedPianoKeys[i] = false
    patterns[editPatternIdx].notes[patternStep].forEach(note => selectedPianoKeys[note - pianoKeysOffset] = true)
}

function gridCellClick(row, cell) {
    if (mode === 'pattern-edit') {
        patternStep = row * 8 + cell
        getSelectedPianoKeysFromGridCell()
        renderPianoKeys()
        renderPatternGrid()
    } else if (mode === 'song-edit') {
        songStep = row * 8 + cell
        renderSongGrid()
    }
}

function pianoKeyClick(idx) {
    if (selectedPianoKeys[idx]) {
        selectedPianoKeys[idx] = false
    } else {
        selectedPianoKeys[idx] = true
    }
    renderPianoKeys()
    setPianoKeyNotesToSequence()
    renderPatternGrid()
    sequence = getPatternSequence(editPatternIdx)
    processor.port.postMessage({ type: 'update-sequence', sequence })
}

function copyPattern() {
    copiedPattern = JSON.stringify(patterns[editPatternIdx])
}

function pastePattern() {
    if (!copiedPattern) return
    patterns[editPatternIdx] = JSON.parse(copiedPattern)
    changePattern(0)
}

function clearPattern() {
    patterns[editPatternIdx] = undefined
    changePattern(0)
    /*ensurePatternExists(editPatternIdx)
    renderPianoKeys(false)
    renderPatternGrid()
    sequence = getPatternSequence(editPatternIdx)
    processor.port.postMessage({ type: 'update-sequence', sequence })*/
}

function copyStep() {
    copiedStep = JSON.stringify(patterns[editPatternIdx].notes[patternStep])
}

function pasteStep() {
    if (!copiedStep) return
    patterns[editPatternIdx].notes[patternStep] = JSON.parse(copiedStep)
    updateStep()
}

function clearStep() {
    patterns[editPatternIdx].notes[patternStep] = []
    updateStep()
}

function updateStep() {
    getSelectedPianoKeysFromGridCell()
    renderPianoKeys(false)
    renderPatternGrid()
    sequence = getPatternSequence(editPatternIdx)
    processor.port.postMessage({ type: 'update-sequence', sequence })
}

function getPatternSequence(patternIdx, offset = 0) {
    const seq = []
    patterns[patternIdx].notes.forEach((notes, idx) => {
        if (notes.length !== 0) {
            const pos = idx * (1 / tempo * 15 * 1000) + offset
            seq.push({
                position: pos,
                notes: notes.map(n => ({
                    note: n,
                    preset: patterns[patternIdx].instrument,
                    delaySend: patterns[patternIdx].delaySend,
                }))
            })
            if (seq.length !== 1) {
                seq[seq.length - 2].notes = seq[seq.length - 2].notes.map(n => ({ ...n, lengthMs: pos - seq[seq.length - 2].position }))
            }
        }
    })
    if (seq.length !== 0) {
        seq[seq.length - 1].notes = seq[seq.length - 1].notes.map(n => ({ ...n, lengthMs: patterns[patternIdx].notes.length / tempo * 15 * 1000 - (seq[seq.length - 1].position - offset) }))
    }
    return seq
}

function setPianoKeyNotesToSequence() {
    const notes = []
    selectedPianoKeys.forEach((state, i) => {
        const element = document.querySelector(`[data-piano-key-idx="${i}"]`)
        if (state) {
            notes.push(pianoKeysOffset + i)
        }
    })
    patterns[editPatternIdx].notes[patternStep] = notes
}

function renderPianoKeys(playKeys = true) {
    selectedPianoKeys.forEach((state, i) => {
        const element = document.querySelector(`[data-piano-key-idx="${i}"]`)
        if (state) {
            element.classList.add('piano-key-selected')
            playKeys && processor.port.postMessage({
                type: 'note-on',
                note: pianoKeysOffset + i,
                voiceInit: { presetId: document.querySelector('#instrument-select').value, delaySend: patterns[editPatternIdx].delaySend },
                lengthMs: 500
            })
        } else {
            element.classList.remove('piano-key-selected')
        }
    })
}

const animalIcons = '🐵 🐶 🐺 🐱 🦁 🐯 🦒 🦊 🦝 🐮 🐷 🐗 🐭 🐹 🐰 🐻 🐨 🐼 🐸 🦓 🐴 🦄 🐔 🐲 🐽 🐾 🐒 🦍 🦧 🦮 🐕 🦴‍ 🦺 🐩 🐕 🐈 🐅 🐆 🐎 🦌 🦏 🦛 🐂 🐃 🐄 🐖 🐏 🐑 🐐 🐪 🐫 🦙 🦘 🦥 🦨 🦡 🐘 🐁 🐀 🦔 🐇 🐿 🦎 🐊 🐢 🐍 🐉 🦕 🦖 🦦 🦈 🐬 🐳 🐋 🐟 🐠 🐡 🦐 🦑 🐙 🦞 🦀 🐚 🦆 🐓 🦃 🦅 🕊 🦢 🦜 🦩 🦚 🦉 🐦 🐧 🐥 🐤 🐣 🦇 🦋'.split(' ')

function renderPatternGrid() {
    const firstPrimes = [97, 89, 83, 79, 73, 71, 67, 61, 59, 53, 47, 43, 41, 37, 31, 29, 23, 19, 17, 13, 11, 7, 5, 3, 2]
    const calcNoteHash = notes => {
        let hash = 0
        notes.forEach((n, i) => hash = hash * (i < firstPrimes.length ? firstPrimes[i] : 1) + n)
        return hash
    }
    document.querySelectorAll('.grid-cell').forEach(x => {
        x.classList.remove('selected')
        x.classList.remove('song')
    })
    {
        const row = Math.floor(patternStep / 8)
        const cell = patternStep % 8
        document.querySelector(`[data-grid-cell="${row},${cell}"]`).classList.add('selected')
    }
    patterns[editPatternIdx].notes.forEach((notes, idx) => {
        const row = Math.floor(idx / 8)
        const cell = idx % 8
        const element = document.querySelector(`[data-grid-cell="${row},${cell}"]`)
        if (notes.length === 0) {
            element.innerText = ''
        } else {
            //element.innerText = animalIcons[notes.reduce((a,b) => a+b) % animalIcons.length]
            element.innerText = animalIcons[calcNoteHash(notes) % animalIcons.length]
        }
    })
}

function renderSongGrid() {
    document.querySelectorAll('.grid-cell').forEach(x => {
        x.classList.remove('selected')
        x.classList.add('song')
    })
    {
        const row = Math.floor(songStep / 8)
        const cell = songStep % 8
        document.querySelector(`[data-grid-cell="${row},${cell}"]`).classList.add('selected')
    }
    song.forEach((songPatterns, idx) => {
        const row = Math.floor(idx / 8)
        const cell = idx % 8
        const element = document.querySelector(`[data-grid-cell="${row},${cell}"]`)
        if (songPatterns.length === 0) {
            element.innerText = ''
        } else {
            const patternsInCell = patterns.filter((_, i) => songPatterns.includes(i)).map(p => htmlEscape(p.name))
            if (patternsInCell.length > 6) {
                patternsInCell.splice(5)
                patternsInCell.push('...')
            }
            element.innerHTML = patternsInCell.join('<br/>')
        }
    })
}

function addPattern() {
    const pattern = Number(document.querySelector('#pattern-select').value)
    if (!song[songStep].includes(pattern)) {
        song[songStep].push(pattern)
        song[songStep].sort()
        renderSongGrid()
        getSequenceFromSong()
    }
}

function removePattern() {
    const pattern = Number(document.querySelector('#pattern-select').value)
    song[songStep] = song[songStep].filter(pn => pn !== pattern)
    renderSongGrid()
    getSequenceFromSong()
}

let copiedPatternGroup

function copyPatternGroup() {
    copiedPatternGroup = JSON.stringify(song[songStep])
}

function pastePatternGroup() {
    if (!copiedPatternGroup) return
    song[songStep] = JSON.parse(copiedPatternGroup)
    renderSongGrid()
    getSequenceFromSong()
}

function clearSongStep() {
    song[songStep] = []
    renderSongGrid()
    getSequenceFromSong()
}

function sendDelayParamsChanged() {
    const delayMs = Number(document.querySelector('#delay-time').value) / tempo * 15 * 1000
    const feedback = Number(document.querySelector('#delay-feedback').value)
    processor.port.postMessage({
        type: 'delay-parameters',
        delayMs, feedback
    })
}

let projectName = '', projectId = crypto.getRandomValues(new Uint8Array(16)).join('')

function saveProject() {
    projectName = prompt('Project name?', projectName)
    if (!projectName) {
        alert('Saving aborted')
        return;
    }
    let projects = localStorage.getItem('simple-synth-projects')
    if (!projects) projects = []
    else projects = JSON.parse(projects)
    let currentProject = projects.find(p => p.id === projectId)
    if (!currentProject) {
        currentProject = { id: projectId }
        projects.push(currentProject)
    }
    currentProject.name = projectName
    currentProject.date = new Date().toLocaleString()

    localStorage.setItem('simple-synth-projects', JSON.stringify(projects))


    localStorage.setItem('simple-synth-project:' + projectId, getProjectJsonString())
}

function getProjectJsonString() {
    const delaySettings = {
        delaySelection: document.querySelector('#delay-time').value,
        feedbackSelection: document.querySelector('#delay-feedback').value,
    }

    const editedInstruments = getListOfEditedInstruments().map(name => {
        const obj = {name, data: instruments[name]}
        delete obj.data.oscShape
        return obj;
    })
    return JSON.stringify({ song, patterns, delaySettings, tempo, editedInstruments });
}

function onDocumentLoad() {

    document.querySelector('#div-grid').innerHTML = (
        new Array(4).fill().map((_, rowIdx) => `
            <div class="grid-row">
            ${ new Array(8).fill().map((_, cellIdx) => (
            `<div class="grid-cell${cellIdx % 4 === 0 ? ' first-in-bar' : ''}" data-grid-cell="${rowIdx},${cellIdx}" onclick="gridCellClick(${rowIdx},${cellIdx})"></div>`
        )).join('')}
            </div>
        `).join('')
    )

    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    const keys = [...noteNames, ...noteNames, ...noteNames]
    keys.splice(25)

    document.querySelector('#piano-keys-content').innerHTML = (
        keys.map((noteName, i) => (
            `<div class="piano-key piano-key-${noteName.length > 1 ? 'black' : 'white'}" data-piano-key-idx="${i}" onclick="pianoKeyClick(${i})">${noteName}</div>`
        )).join('')
    )

    if (location.search) {
        document.querySelector('#startup-controls-dynamic').innerHTML = `<div class="select-song-button" onclick="start('from-link')">Project from link</div>`
    } else if (localStorage.getItem('simple-synth-projects')) {
        const projects = JSON.parse(localStorage.getItem('simple-synth-projects'))
        document.querySelector('#startup-controls-dynamic').innerHTML = projects
            .map(p => `<div class="select-song-button" onclick="start('${p.id}')">${htmlEscape(p.name)}<br/><span class="date-string">${p.date}</span></div>`)
            .join('')
    }

    const b64ToNum = base64_string => {
        const ints = Int8Array.from(atob(base64_string), c => c.charCodeAt(0))
        const arr = []
        for (let i = 0; i < ints.length; i++) {
            arr.push(ints[i] / 128)
        }
        return arr
    }


    Object.keys(instruments).forEach(key => instruments[key].oscShape = b64ToNum(instruments[key].oscShape))

    Object.keys(instruments).forEach(key => {
        document.querySelector('#instrument-select').innerHTML += `<option value=${key}>${key}</option>`
    })

    // For development purposes
    document.body.innerHTML += '<div style="display:none">' + Object.keys(instruments.basic).map(key => key !== 'oscShape' ? key + '<input onchange="instruments.basic.' + key + '=Number(this.value),processor.port.postMessage({type: `preset`, presetId: `basic`, presetData: instruments.basic})" value="' + instruments.basic[key] + '">' : '').join('<br>') + 'oscShape (b64) <textarea onchange="instruments.basic.b64Os=this.value,instruments.basic.oscShape=b64ToNum(this.value),processor.port.postMessage({type: `preset`, presetId: `basic`, presetData: instruments.basic})"></textarea>' + '<button onclick="newPresetToJson()">Get JSON</button></div>'
    newPresetToJson = () => { const i = { ...instruments.basic }; i.oscShape = i.b64Os; delete i.b64Os; prompt("json", JSON.stringify({ "name here": i })) }
}


let processor

const start = async (givenProjectId) => {

    if (!processor) {
        const audioCtx = new AudioContext({
            latencyHint: 'playback'
        })
        await audioCtx.audioWorklet.addModule('simple-synth.js')
        processor = new AudioWorkletNode(audioCtx, 'simple-synth-processor')
        await processor.connect(audioCtx.destination)
    }
    processor.port.postMessage({ type: 'preset', presetId: 'basic', presetData: instruments.basic })

    if (givenProjectId !== undefined) {
        let project
        if (givenProjectId === 'from-link') {
            project = JSON.parse(atob(location.search.substr(1)))
        } else {
            projectId = givenProjectId
            project = JSON.parse(localStorage.getItem('simple-synth-project:' + projectId))
        }
        song = project.song
        patterns = project.patterns
        
        if (project.editedInstruments) {
            project.editedInstruments.forEach(i => {
                instruments[i.name] = {...instruments[i.name], ...i.data}
            })
        }

        patterns.forEach(p => processor.port.postMessage({ type: 'preset', presetId: p.instrument, presetData: instruments[p.instrument] }))

        document.querySelector('#delay-time').value = project.delaySettings.delaySelection
        document.querySelector('#delay-feedback').value = project.delaySettings.feedbackSelection

        tempo = project.tempo
        document.querySelector('#tempo-input').value = tempo

        if (givenProjectId !== 'from-link') {
            projectName = JSON.parse(localStorage.getItem('simple-synth-projects')).find(p => p.id === projectId).name
        } else {
            projectName = 'shared project'
        }


        sendDelayParamsChanged()
    }
    document.querySelector('#tempo-display').innerText = tempo

    switchMode('song-edit')
    document.querySelector('#div-grid').style.display = 'block'
    document.querySelector('#global-controls').style.display = 'block'
    document.querySelector('#startup-controls').style.display = 'none'
}

function playSequence() {
    let offset = undefined
    if (mode === 'song-edit') {
        offset = songStep * 32 / tempo * 15 * 1000
    }
    processor.port.postMessage({
        type: 'start-sequence',
        sequence,
        offset
    })
}

function stopSequence() {
    processor.port.postMessage({
        type: 'stop-sequence',
        sequence
    })
}

