function urlformat() {
    const version = '0'

    const instrumentMapping = [
        ['basic', 'a'],
        ['pluck', 'b'],
        ['soft-bass', 'c'],
        ['bass', 'd'],
        ['piano', 'e'],
        ['guitar', 'f'],
        ['soft-synth', 'g'],
        ['mellow-strings', 'h'],
        ['reso-stab', 'i'],
        ['gnarly', 'j'],
        ['synth-pluck', 'k'],
        ['industrialism', 'l'],
        ['totally-alien', 'm'],
        ['hihat', 'n'],
        ['hihat2', 'o'],
        ['kick', 'p'],
        ['kick2', 'q'],
        ['snare', 'r'],
        ['clap', 's'],
        ['crash', 't'],
        ['voc-pad', 'u'],
    ]

    function encodeArray(array) {
        return array.map(x => x.toString(36)).join(',') + '.'
    }

    function decodeArray(substring) {
        const idx = substring.indexOf('.')
        let array
        if (idx !== -1)
            array = substring.slice(0, idx).split(',').filter(x => x !== '').map(x => parseInt(x, 36))
        return [array, substring.slice(idx + 1)]
    }
    
    function encodeBlock(data, encoder, endChar) {
        return data.map(encoder).join('') + endChar
    }

    function decodeBlock(substring, decoder, endChar) {
        let block = []
        while (substring[0] && substring[0] !== endChar) {
            const [data, newSubstring] = decoder(substring)
            substring = newSubstring
            if (data !== undefined) {
                block.push(data)
            }
        }
        return [block, substring.slice(1)]
    }

    function decodeArrayOfArrays(substring) {
        return decodeBlock(substring, decodeArray, 'X')
    }

    function encodeArrayOfArrays(song) {
        return encodeBlock(song, encodeArray, 'X')
    }

    function encodePattern(pattern) {
        console.log(pattern)

        const delaySendInt = Math.floor(127 * pattern.delaySend)
        const pianoKeyOffsetAndDelaySend = (pattern.pianoKeysOffset << 7) + delaySendInt
        const name = pattern.name.toLowerCase().replace(/ /g, '_').replace(/[^a-z0-9_]/g, '')

        return encodeArrayOfArrays(pattern.notes) +
            instrumentMapping.find(x => x[0] === pattern.instrument)[1] +
            pianoKeyOffsetAndDelaySend.toString(36) + 'X' + name + 'X'
    }

    function decodePattern(substring) {
        const [notes, newSubstring] = decodeArrayOfArrays(substring)
        substring = newSubstring
        const instrument = instrumentMapping.find(x => x[1] === substring[0])[0]
        substring = substring.slice(1)
        let idx = substring.indexOf('X')
        const pianoKeyOffsetAndDelaySend = parseInt(substring.slice(0, idx), 36)
        const pianoKeysOffset = pianoKeyOffsetAndDelaySend >> 7
        const delaySend = (pianoKeyOffsetAndDelaySend & 127) / 127
        substring = substring.slice(idx + 1)
        idx = substring.indexOf('X')
        const name = substring.slice(0, idx).replace(/_/g, ' ')
        substring = substring.slice(idx + 1)
        return [{ notes, instrument, pianoKeysOffset, delaySend, name }, substring]
    }

    function encodePatterns(patterns) {
        return encodeBlock(patterns, encodePattern, 'P')
    }

    function decodePatterns(substring) {
        return decodeBlock(substring, decodePattern, 'P')
    }

    function encodeDelaySettings(delaySettings) {
        return (
            (Number(delaySettings.delaySelection) << 4) +
            Number(delaySettings.feedbackSelection.replace('0.', ''))
        ).toString(36) + 'X'
    }

    function decodeDelaySettings(substring) {
        const idx = substring.indexOf('X')
        const num = parseInt(substring.slice(0, idx), 36)
        const delaySelection = `${num >> 4}`
        const feedbackSelection = `0.${num & 15}`
        return [{ delaySelection, feedbackSelection }, substring.slice(idx + 1)]
    }

    function encodeTempo(tempo) {
        return ('0' + tempo).slice(-3)
    }

    function decodeTempo(substring) {
        return [parseInt(substring.slice(0, 3)), substring.slice(3)]
    }

    function encodeEditedInstrument(instrument) {
        const scalingFactor = parseInt('zz', 36)
        const scaledData = [
            instrument.data.attack,
            instrument.data.decay,
            instrument.data.sustain,
            instrument.data.release,
            instrument.data.cutoff,
            instrument.data.resonance,
            instrument.data.adsrToFilter,
            instrument.data.distortion,
            instrument.data.volume,
            instrument.data.subVolume,
        ]
        const data = [...scaledData.map(x => Math.floor(x * scalingFactor)), instrument.data.filterType,]
        return instrumentMapping.find(x => x[0] === instrument.name)[1] +
            encodeArray(data)
    }

    function decodeEditedInstrument(substring) {
        const name = instrumentMapping.find(x => x[1] === substring[0])[0]
        const [data, newSubstring] = decodeArray(substring.slice(1))
        const scalingFactor = parseInt('zz', 36)
        const scaledData = data.map(x => x / scalingFactor)
        const [attack, decay, sustain, release, cutoff, resonance,
            adsrToFilter, distortion, volume, subVolume, filterType_unused] = scaledData
        const filterType = data[data.length - 1]
        const instrument = {
            name, data: {
                attack, decay, sustain, release, cutoff, resonance,
                adsrToFilter, distortion, volume, filterType,
                // Support earlier versions of the format
                subVolume: filterType_unused === undefined ? 0 : subVolume,
            }
        }
        return [instrument, newSubstring]
    }

    function encodeEditedInstruments(instruments) {
        return encodeBlock(instruments, encodeEditedInstrument, '')
    }

    function decodeEditedInstruments(substring) {
        return decodeBlock(substring, decodeEditedInstrument, '')
    }

    function encodeTrack(track) {
        return '~' + version + encodeTempo(track.tempo) + encodeDelaySettings(track.delaySettings) +
            encodeArrayOfArrays(track.song) + encodePatterns(track.patterns) +
            encodeEditedInstruments(track.editedInstruments)
    }

    function decodeTrack(substring) {
        if (substring.slice(0, 2) !== '~' + version)
            throw new Error('Invalid format / format version mismatch.')
        substring = substring.slice(2)
        const [tempo, newSubstring] = decodeTempo(substring)
        substring = newSubstring
        const [delaySettings, newSubstring2] = decodeDelaySettings(substring)
        substring = newSubstring2
        const [song, newSubstring3] = decodeArrayOfArrays(substring)
        substring = newSubstring3
        const [patterns, newSubstring4] = decodePatterns(substring)
        substring = newSubstring4
        const [editedInstruments, newSubstring5] = decodeEditedInstruments(substring)
        return {
            tempo, delaySettings, song, patterns, editedInstruments
        }
    }

    return {
        encodeArray,
        decodeArray,
        encodeArrayOfArrays,
        decodeArrayOfArrays,
        encodePattern,
        decodePattern,
        encodePatterns,
        decodePatterns,
        encodeDelaySettings,
        decodeDelaySettings,
        encodeTempo,
        decodeTempo,
        encodeEditedInstrument,
        decodeEditedInstrument,
        encodeEditedInstruments,
        decodeEditedInstruments,
        encodeTrack,
        decodeTrack,
    }
}
