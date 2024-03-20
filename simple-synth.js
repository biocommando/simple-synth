{
    let isWorkletNode = false;
    try { window } catch (e) { isWorkletNode = true; }
    if (!isWorkletNode) {
        window.currentTime = 0
        window.sampleRate = 44100
    }

    const expensiveInterval = 32;

    const invPi = 1 / Math.PI;

    function hardClip(input) {
        return input > 1 ? 1 : (input < -1 ? -1 : input)
    }

    class LpfNPole {

        constructor(poles) {
            this.cutCalc = 0
            this.feedbackGain = 0
            this.stages = new Array(poles).fill(0)
            this.prevOut = 0
        }

        setCutoff(c) {
            c = c < 0 ? 0 : c
            this.cutCalc = c / (invPi + c)
        }

        setResonance(r) {
            this.feedbackGain = r
        }

        process(input) {
            let s = input - 5 * hardClip(this.prevOut * this.feedbackGain)
            for (let i = 0; i < this.stages.length; i++) {
                this.processStage(i, s)
                s = this.stages[i]
            }
            this.prevOut = s
            return s
        }

        processStage(stage, input) {
            this.stages[stage] = this.stages[stage] + this.cutCalc * (input - this.stages[stage])
        }
    }

    class HpfNPole {

        constructor(poles) {
            this.cutCalc = 0
            this.feedbackGain = 0
            this.stages = new Array(poles).fill(0).map(() => ({ i: 0, o: 0 }))
            this.prevOut = 0
        }

        setCutoff(c) {
            c = c < 0 ? 0 : c
            this.cutCalc = invPi / (invPi + c)
        }

        setResonance(r) {
            this.feedbackGain = r
        }

        process(input) {
            let s = input - 5 * hardClip(this.prevOut * this.feedbackGain)
            for (let i = 0; i < this.stages.length; i++) {
                this.processStage(i, s)
                s = this.stages[i].o
            }
            this.prevOut = s
            return s
        }

        processStage(stage, input) {
            this.stages[stage].o = this.cutCalc * (input + this.stages[stage].o - this.stages[stage].i);
            this.stages[stage].i = input;
        }
    }


    class Distortion {
        constructor(amount) {
            this.setAmount(amount)
        }

        setAmount(amount) {
            amount = Math.log10((9 * amount + 1))
            this.amount = Math.min(Math.max(amount, 0), 1)
            this.clipAt = Math.max(1 - amount, 0.001)
            this.amplify = 1 / this.clipAt
        }

        process(input) {
            return Math.min(Math.max(-this.clipAt, input * (1 + input * input * this.amount)), this.clipAt) * this.amplify
        }
    }

    class Delay {

        constructor() {
            this.delay = Math.floor(0.5 * sampleRate)
            this.feedback = 0.5
            // for send delay usage
            this.dry = 0
            this.wet = 1
            this.buffer = new Array(sampleRate).fill(0)
            this.index = 0
        }

        process(input) {
            const output = input * this.dry + this.wet * this.buffer[this.index]
            this.buffer[this.index] = this.buffer[this.index] * this.feedback + input
            this.index++
            if (this.index >= this.delay) this.index = 0
            return output
        }

        setMix(dryWetMix) {
            this.dry = 1 - dryWetMix
            this.wet = dryWetMix
        }

    }

    // Based on
    // https://github.com/ddiakopoulos/MoogLadders/blob/master/src/MicrotrackerModel.h
    class MoogFilter {
        constructor() {
            this.p0 = 0
            this.p1 = 0
            this.p2 = 0
            this.p3 = 0
            this.p32 = 0
            this.p33 = 0
            this.p34 = 0
            this.cutoff = 0
            this.resonance = 0
            this.setCutoff(1.0)
            this.setResonance(0.10)
        }
        process(input) {
            const k = this.resonance * 4;
            // Coefficients optimized using differential evolution
            // to make feedback gain 4.0 correspond closely to the
            // border of instability, for all values of omega.
            const out = this.p3 * 0.360891 + this.p32 * 0.417290 + this.p33 * 0.177896 + this.p34 * 0.0439725;

            this.p34 = this.p33;
            this.p33 = this.p32;
            this.p32 = this.p3;

            this.p0 += (this.fast_tanh(input - k * out) - this.fast_tanh(this.p0)) * this.cutoff;
            this.p1 += (this.fast_tanh(this.p0) - this.fast_tanh(this.p1)) * this.cutoff;
            this.p2 += (this.fast_tanh(this.p1) - this.fast_tanh(this.p2)) * this.cutoff;
            this.p3 += (this.fast_tanh(this.p2) - this.fast_tanh(this.p3)) * this.cutoff;

            return out;
        }

        setResonance(r) {
            this.resonance = r;
        }

        setCutoff(c) {
            this.cutoff = c * 2 * Math.PI * 1000 / sampleRate;
            this.cutoff = c > 1 ? 1 : (c < 0 ? 0 : c);
        }
        fast_tanh(x) {
            const x2 = x * x;
            return x * (27.0 + x2) / (27.0 + 9.0 * x2);
        }
    }

    class MS20Filter {

        update() {
            this.k2 = 2.2 * this.resonance;
            const cmtemp = 10.0 - (this.integratedCutoff * (this.cutmod + 1) * 1.4);
            this.R1 = Math.pow(2.0, cmtemp * 0.7382) * this.pR1;
            this.R2 = 3 * this.R1;
            this.Cx = this.Cx0 / this.R1;
            this.Bx = 2 * this.Cx;
            this.Ax = this.Cx;
            const tempTerm2 = (2 * this.k2 * this.T) / this.C2;        // dependent on resonance
            const tempTerm3 = (2 * this.R2 * this.T) / (this.C1 * this.R1); // dependent on cutoff
            this.Cy = 4 * this.R2 + this.tempTerm1 - tempTerm2 + tempTerm3 + this.Cx;
            this.By = ((-8) * this.R2 + this.Bx);
            this.Ay = 4 * this.R2 - this.tempTerm1 + tempTerm2 - tempTerm3 + this.Ax;
            this.iCy = 1 / this.Cy;
        }

        updateConstants() {
            this.C1 = this.pC1;
            this.C2 = this.C1 * 0.30303;
            this.Cx0 = (this.T * this.T) / (this.C1 * this.C2);
            this.tempTerm1 = (2 * this.T) / this.C1 + (2 * this.T) / this.C2;
        }

        constructor() {
            this.T = 1.0 / sampleRate;
            this.pC1 = 0.0000000033;
            this.pR1 = 20000;
            this.xm2 = 0;
            this.xm1 = 0;
            this.ym1 = 0;
            this.ym2 = 0;
            this.sampleIdx = 14;
            this.setCutoff(1);
            this.integratedCutoff = this.cutoff;
            this.setResonance(0);
            this.setModulation(0);
            this.updateConstants();
            this.update();
        }

        process(x) {
            this.integratedCutoff = this.integratedCutoff + (this.cutoff - this.integratedCutoff) * 0.01;
            if (++this.sampleIdx == 15) {
                this.sampleIdx = 0;
                this.update();
            }
            const y = (this.Ax * this.xm2 + this.Bx * this.xm1 + this.Cx * x - this.Ay * this.ym2 - this.By * this.ym1) * this.iCy;

            // saturation
            if (x < -1)
                x = -1;
            else if (x > 1)
                x = 1;
            this.xm1 = x;
            this.ym2 = this.ym1;
            this.ym1 = y;
            return y;
        }
        setCutoff(v) {
            if (v < 0) v = 0;
            if (v > 1) v = 1;
            this.cutoff = 10 * v;
        }

        setResonance(v) {
            this.resonance = v;
        }

        setModulation(v) {
            this.cutmod = v;
        }

        setComponentValues(c, r) {
            this.pC1 = c;
            this.pR1 = r;
            this.updateConstants();
        }

        reset() {
            this.integratedCutoff = this.cutoff;
            this.xm2 = 0;
            this.xm1 = 0;
            this.ym1 = 0;
            this.ym2 = 0;
            this.sampleIdx = 14;
            this.updateConstants();
            this.update();
        }
    };

    class Envelope {
        constructor(hasLength) {
            this.length = hasLength ? 0 : -1
            this.phase = 0
            this.ratio = 0
        }
        setLength(samples) {
            if (this.length >= 0 && samples >= 0) {
                this.length = samples;
            }
        }
        hasNext() {
            return this.length == -1 || this.phase < this.length;
        }
        reset() {
            this.phase = 0;
            this.ratio = 0;
        }
        calcuateNext() {
            if (++this.phase >= this.length) {
                this.phase = this.length;
                this.ratio = 1;
            }
            else {
                this.ratio = this.phase / this.length;
            }
        }
    }

    class AdsrEnvelope {
        constructor() {
            this.endReached = true
            this.sustain = 0
            this.stage = 0
            this.releaseLevel = 0
            this.envelope = 0
            this.stages = [
                new Envelope(true),
                new Envelope(true),
                new Envelope(false),
                new Envelope(true)
            ]
        }


        setAttack(seconds) {
            this.stages[0].setLength(seconds * sampleRate);
        }
        setDecay(seconds) {
            this.stages[1].setLength(seconds * sampleRate);
        }
        setSustain(level) {
            this.sustain = level;
        }
        setRelease(seconds) {
            this.stages[3].setLength(seconds * sampleRate);
        }
        trigger() {
            this.endReached = false;
            this.triggerStage(0);
        }
        release() {
            if (this.stage >= 3) return;
            this.releaseLevel = this.envelope;
            this.triggerStage(3);
        }
        triggerStage(stage) {
            this.stage = stage;
            this.stages[stage].reset();
        }
        getRatio() {
            return this.stages[this.stage].ratio;
        }
        calculateNext() {
            if (this.endReached) {
                return;
            }
            var current = this.stages[this.stage];
            if (current.hasNext()) {
                current.calcuateNext();
                var ratio = current.ratio;
                switch (this.stage) {
                    case 0:
                        this.envelope = ratio;
                        break;
                    case 1:
                        this.envelope = 1 - (1 - this.sustain) * ratio;
                        break;
                    case 2:
                        this.envelope = this.sustain;
                        break;
                    case 3:
                        this.envelope = this.releaseLevel * (1 - ratio);
                        break;
                    default:
                        break;
                }
            }
            else if (this.stage < 3) {
                this.triggerStage(this.stage + 1);
                this.calculateNext();
            } else {
                // release ended
                this.envelope = 0;
                this.endReached = true;
            }
        }
    }

    const createVoice = init => {
        const adsr = new AdsrEnvelope()
        adsr.setAttack(init.attack / expensiveInterval)
        adsr.setDecay(init.decay / expensiveInterval)
        adsr.setSustain(init.sustain)
        adsr.setRelease(init.release / expensiveInterval)

        let filter
        switch (init.filterType) {
            case 1:
                filter = new LpfNPole(2)
                break
            case 2:
                filter = new LpfNPole(4)
                break
            case 3:
                filter = new HpfNPole(2)
                break
            case 4:
                filter = new HpfNPole(4)
                break
            case 5:
                filter = new MS20Filter()
                break
            default:
            case 0:
                filter = new MoogFilter()
                break
        }


        filter.setCutoff(init.cutoff)
        filter.setResonance(init.resonance)

        const distortion = new Distortion(init.distortion)

        let killAt = undefined
        if (init.lengthMs) {
            killAt = currentTime + init.lengthMs * 0.001
        }

        return {
            oscShape: init.oscShape,
            adsr,
            adsrToFilter: init.adsrToFilter,
            cutoff: init.cutoff,
            resonance: init.resonance,
            distortion,
            filter,
            phase: 0,
            phaseProgress: init.phaseProgress,
            volume: init.volume,
            id: init.id,
            killAt,
            delaySend: init.delaySend,
            oneshot: !!init.constantRate
        }
    }

    let extClass
    if (isWorkletNode) {
        extClass = AudioWorkletProcessor
    } else {
        extClass = class Dummy {
            constructor() {
                this.port = { postMessage: () => {} }
            }
        }
    }

    class SimpleSynth extends extClass {
        constructor() {
            super();
            this.voices = []
            this.idCounter = 0
            this.presets = {}
            this.sequence = undefined
            this.sendDelay = new Delay()

            if (isWorkletNode) {
                this.port.onmessage = e => this.handlePortEvent(e.data)
            }

        }

        handlePortEvent(message) {
            if (message.type === 'note-on') {
                const noteId = this.noteOn(message.note, message.voiceInit, message.lengthMs)
                this.postMessage('note-on' , {
                    noteId,
                    correlationId: message.correlationId
                })
            } else if (message.type === 'note-off') {
                this.noteOff(message.noteId)
            } else if (message.type === 'preset') {
                this.presets[message.presetId] = message.presetData
            } else if (message.type === 'start-sequence') {
                this.startSequence(message.sequence, message.offset)
            } else if (message.type === 'stop-sequence') {
                this.stopSequence()
            } else if (message.type === 'update-sequence') {
                this.updateSequence(message.sequence)
            } else if (message.type === 'delay-parameters') {
                this.sendDelay.delay = Math.floor(Math.min(message.delayMs, 1000) / 1000 * sampleRate)
                for (let i = 0; i < this.sendDelay.buffer.length; i++) this.sendDelay.buffer[i] = 0
                this.sendDelay.feedback = message.feedback
            }
        }

        process(inputs, outputDevices, parameters) {
            const dev1OutputChannels = outputDevices[0]
            const channel1LeftBuffer = dev1OutputChannels[0]

            if (!isWorkletNode) {
                currentTime += channel1LeftBuffer.length / sampleRate
            }

            if (this.sequence) {
                const step = this.sequence.step
                const next = this.sequence.noteData[step]
                if (next && next.position <= this.sequence.position) {
                    this.sequence.step++
                    this.postMessage('seq-step', {step: this.sequence.step, positionSeconds: this.sequence.position / sampleRate})
                    next.notes.forEach(noteInit => {
                        this.noteOn(noteInit.note, { presetId: noteInit.preset, delaySend: noteInit.delaySend }, noteInit.lengthMs)
                    })
                } else if (!next && !this.sequence.stopNotified) {
                    this.sequence.stopNotified = true
                    this.postMessage('seq-end', {})
                }
                this.sequence.position += channel1LeftBuffer.length
            }

            let expensiveCnt = 0
            for (let i = 0; i < channel1LeftBuffer.length; i++) {
                let value = 0, delaySendValue = 0
                for (let k = 0; k < this.voices.length; k++) {
                    let voice = this.voices[k]
                    let vValue = voice.oscShape[Math.floor(voice.phase * voice.oscShape.length)]
                    vValue = voice.filter.process(vValue)
                    vValue = voice.distortion.process(vValue)

                    if (expensiveCnt === 0) {
                        voice.instVol = voice.volume * voice.adsr.envelope
                        voice.filter.setCutoff(voice.cutoff + voice.adsr.envelope * voice.adsrToFilter)
                        voice.adsr.calculateNext()
                    }

                    vValue *= voice.instVol

                    voice.phase += voice.phaseProgress
                    if (voice.phase >= 1) {
                        voice.phase -= 1
                        if (voice.oneshot) {
                            voice.killAt = currentTime
                        }
                    }
                    value += vValue
                    delaySendValue += vValue * voice.delaySend
                }

                value += this.sendDelay.process(delaySendValue)

                for (let j = 0; j < dev1OutputChannels.length; j++) {
                    dev1OutputChannels[j][i] = value
                }
                if (++expensiveCnt === expensiveInterval) expensiveCnt = 0;
            }
            this.voices = this.voices.filter(v => !v.adsr.endReached)
            this.voices.forEach(voice => {
                if (voice.killAt <= currentTime) {
                    voice.killAt = undefined
                    voice.adsr.release()
                }
            })
            return true
        }

        postMessage(id, payload) {
            this.port.postMessage({id, ...payload})
        }

        noteOn(note, init, lengthMs) {
            const delaySend = init.delaySend
            if (this.presets[init.presetId]) {
                // mutation doesn't matter
                init = this.presets[init.presetId]
                init.lengthMs = lengthMs
            }

            const constantRate = !!init.constantRate

            init.delaySend = delaySend
            if (!constantRate) {
                init.phaseProgress = 16.3515978 * Math.pow(2, note / 12) / sampleRate
            } else {
                init.phaseProgress = (init.originalSampleRate ? init.originalSampleRate : 44100) / sampleRate / init.oscShape.length
            }
            init.id = ++this.idCounter
            const voice = createVoice(init)
            this.voices.push(voice)
            voice.adsr.trigger()
            return init.id
        }

        noteOff(id) {
            const voice = this.voices.find(v => v.id === id)
            voice && voice.adsr.release()
        }

        startSequence(sequence, offsetMs) {
            this.sequence = {
                position: offsetMs ? Math.floor(offsetMs / 1000 * sampleRate) : 0,
                step: 0
            }

            this.updateSequence(sequence)
        }

        stopSequence() {
            this.sequence = undefined
            this.voices.forEach(v => v.adsr.release())
        }

        updateSequence(sequence) {
            if (this.sequence) {
                this.sequence.noteData = sequence.map(x => ({ ...x, position: x.position / 1000 * sampleRate }))
                if (this.sequence.position > 0) {
                    this.sequence.noteData = this.sequence.noteData.filter(x => x.position >= this.sequence.position)
                }
            }
        }

    }

    if (isWorkletNode) {
        registerProcessor('simple-synth-processor', SimpleSynth)
    } else {
        window.SimpleSynth = SimpleSynth
    }
}