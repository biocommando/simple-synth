const originalInstruments = {
    "basic": { "subVolume": 0, "attack": 0.02, "decay": 0.1, "sustain": 0.2, "release": 0.2, "cutoff": 0.1, "resonance": 0.5, "adsrToFilter": 0.2, "distortion": 0, "volume": 0.5, "filterType": 0 },
    "pluck": { "subVolume": 0, "attack": 0, "decay": 0.2, "sustain": 0, "release": 0.1, "cutoff": 0.01, "resonance": 0.55, "adsrToFilter": 0.55, "distortion": 0, "volume": 0.5, "filterType": 0 },
    "soft-bass": { "subVolume": 0, "attack": 0, "decay": 0.3, "sustain": 0.6, "release": 0.3, "cutoff": 0, "resonance": 0.3, "adsrToFilter": 0.15, "distortion": 0, "volume": 0.4, "filterType": 0 },
    "bass": { "subVolume": 0, "attack": 0.004, "decay": 0.1, "sustain": 0.7, "release": 0.1, "cutoff": 0.4, "resonance": 0, "adsrToFilter": 0.2, "distortion": 0, "volume": 0.27, "filterType": 0 },
    "piano": { "subVolume": 0, "attack": 0, "decay": 0.25, "sustain": 0.4, "release": 0.5, "cutoff": 0.5, "resonance": 0, "adsrToFilter": 0.5, "distortion": 0, "volume": 0.25, "filterType": 0 },
    "voc-pad": { "subVolume": 0, "attack": 0.15, "decay": 0.35, "sustain": 0.6, "release": 0.5, "cutoff": 0.2, "resonance": 0.6, "adsrToFilter": 0.4, "distortion": 0, "volume": 0.4, "filterType": 0 },
    "guitar": { "subVolume": 0, "attack": 0, "decay": 0.35, "sustain": 0.15, "release": 0.5, "cutoff": 0.15, "resonance": 0.3, "adsrToFilter": 0.7, "distortion": 0, "volume": 0.4, "filterType": 0 },
    "soft-synth": { "subVolume": 0, "attack": 0.025, "decay": 0.3, "sustain": 0.35, "release": 0.3, "cutoff": 0.2, "resonance": 0.4, "adsrToFilter": 0.3, "distortion": 0, "volume": 0.4, "filterType": 0 },
    "mellow-strings": { "subVolume": 0, "attack": 0.3, "decay": 0.4, "sustain": 0.7, "release": 0.25, "cutoff": 0.5, "resonance": 0.3, "adsrToFilter": 0, "distortion": 0, "volume": 0.35, "filterType": 0 },
    "reso-stab": { "subVolume": 0, "attack": 0.002, "decay": 0.25, "sustain": 0.2, "release": 0.1, "cutoff": 0.1, "resonance": 0.8, "adsrToFilter": 0.3, "distortion": 0, "volume": 0.4, "filterType": 0 },
    "gnarly": { "subVolume": 0, "attack": 0, "decay": 0.1, "sustain": 0.5, "release": 0.1, "cutoff": 0.5, "resonance": 0.2, "adsrToFilter": 0.5, "distortion": 0, "volume": 0.3, "filterType": 0 },
    "synth-pluck": { "subVolume": 0, "attack": 0.0005, "decay": 0.3, "sustain": 0, "release": 0.2, "cutoff": 0, "resonance": 0.6, "adsrToFilter": 0.4, "distortion": 0, "volume": 0.3, "filterType": 0 },
    "industrialism": { "subVolume": 0, "attack": 0, "decay": 0.4, "sustain": 0.4, "release": 0.03, "cutoff": 0.4, "resonance": 0.2, "adsrToFilter": 0.4, "distortion": 0, "volume": 0.3, "filterType": 0 },
    "totally-alien": { "subVolume": 0, "attack": 0.3, "decay": 0.6, "sustain": 0.2, "release": 0.03, "cutoff": 0.2, "resonance": 0.6, "adsrToFilter": 0.7, "distortion": 0, "volume": 0.3, "filterType": 0 },
    "hihat": { "subVolume": 0, "attack": 0, "decay": 0.137, "sustain": 0, "release": 0, "cutoff": 1, "resonance": 0, "adsrToFilter": 0, "distortion": 0, "volume": 0.4, "constantRate": true, "filterType": 0 },
    "hihat2": { "subVolume": 0, "attack": 0, "decay": 0.281, "sustain": 0, "release": 0, "cutoff": 1, "resonance": 0, "adsrToFilter": 0, "distortion": 0, "volume": 0.4, "constantRate": true, originalSampleRate: 16000, "filterType": 0 },
    "kick": { "subVolume": 0, "attack": 0, "decay": 0.103, "sustain": 0, "release": 0, "cutoff": 0.8, "resonance": 0.2, "adsrToFilter": 0.7, "distortion": 0, "volume": 1, "constantRate": true, "filterType": 0 },
    "kick2": { "subVolume": 0, "attack": 0, "decay": 0.3, "sustain": 0, "release": 0, "cutoff": 1, "resonance": 0, "adsrToFilter": 0, "distortion": 0, "volume": 0.6, "constantRate": true, originalSampleRate: 11025, "filterType": 0 },
    "snare": { "subVolume": 0, "attack": 0, "decay": 0.104, "sustain": 0, "release": 0, "cutoff": 1, "resonance": 0, "adsrToFilter": 0, "distortion": 0, "volume": 0.7, "constantRate": true, "filterType": 0 },
    "clap": { "subVolume": 0, "attack": 0, "decay": 0.162, "sustain": 0, "release": 0, "cutoff": 1, "resonance": 0, "adsrToFilter": 0, "distortion": 0, "volume": 0.7, "constantRate": true, originalSampleRate: 22050, "filterType": 0 },
    "crash": { "subVolume": 0, "attack": 0, "decay": 0.6, "sustain": 0, "release": 0, "cutoff": 1, "resonance": 0, "adsrToFilter": 0, "distortion": 0, "volume": 0.7, "constantRate": true, originalSampleRate: 11025, "filterType": 0 },
}

const instruments = JSON.parse(JSON.stringify(originalInstruments))

function editInstrument(parameterName, parameterValue) {
    const presetName = patterns[editPatternIdx].instrument
    instruments[presetName][parameterName] = parameterValue
    processor.port.postMessage({type: 'preset', presetId: presetName, presetData: instruments[presetName]})
}

const intrumentParamsDirtyList = ["attack","decay","sustain","release","cutoff","resonance","adsrToFilter", "distortion","volume","filterType"]
function resetInstrument() {
    const presetName = patterns[editPatternIdx].instrument;
    intrumentParamsDirtyList.forEach(param => {
        instruments[presetName][param] = originalInstruments[presetName][param]
    })
    instrumentParametersToUi()
    processor.port.postMessage({type: 'preset', presetId: presetName, presetData: instruments[presetName]})
}

function getListOfEditedInstruments() {
    const paramsToCompare = intrumentParamsDirtyList
    return Object.keys(instruments).filter(key => 
        paramsToCompare.some(param =>
            originalInstruments[key][param] !== instruments[key][param]
        )
    )
}
