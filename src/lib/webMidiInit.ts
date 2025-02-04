import { WebMidi } from 'webmidi';
import { get } from 'svelte/store';
import {
	selectedMidiInputMTC,
	selectedMidiInputSPP,
	midiInputs,
	syncModeIsMTC,
	mtcData,
	sppData,
	isPlaying
} from '$lib/stores';
import type { MTCData, SPPData } from '$lib/stores';
import { onSPPMessage, onMidiClockMessage } from '$lib/sppMessages';
import { onMtcMessage, onSysexMessage } from '$lib/mtcMessages';
import { videoPlayerStore } from '$lib/videoPlayerStore';

function syncMode() {
	if (get(syncModeIsMTC)) {
		return 'MTC';
	} else {
		return 'SPP';
	}
}

// eslint-disable-next-line no-unused-labels
$: selectedMidiInputMTC.subscribe((value) => {
	stopMtcAndSPPListeners();
	restartListeners();
	logListOfInputs();
	console.log(`Selected MTC  input: ${value}`);
});
// eslint-disable-next-line no-unused-labels
$: selectedMidiInputSPP.subscribe((value) => {
	stopMtcAndSPPListeners();
	restartListeners();
	logListOfInputs();
	logListOfInputs();
	console.log(`Selected SPP input: ${value}`);
});
// eslint-disable-next-line no-unused-labels
$: syncModeIsMTC.subscribe(() => {
	restartListeners();
});

function restartListeners() {
	stopMtcAndSPPListeners();
	if (get(syncModeIsMTC)) {
		startMtcListening();
	} else {
		startSPPListening();
	}
	startMidiClockListening();
}

// eslint-disable-next-line
$: isPlaying;

// Enable WEBMIDI.js and trigger the onEnabled() function when ready

export function startWebMidi() {
	WebMidi.enable({ sysex: true })
		.then(() => console.log('System exclusive messages are enabled'))
		.catch((err) => console.log(err));

	WebMidi.addListener('midiaccessgranted', () => {
		if (WebMidi.enabled) {
			console.log('MIDI access granted');
		}
	});

	WebMidi.addListener('connected', () => {
		addMidiInputOptions();
	});

	WebMidi.addListener('disconnected', () => {
		console.log('Device disconnected');
	});

	WebMidi.addListener('disabled', () => {
		if (!WebMidi.enabled) {
			console.log('WEBMIDI disabled');
		}
	});
}
// startWebMidi();
// restartListeners();

// function closeAllMidiInputs() {
// 	for (const input of WebMidi.inputs) {
// 		input.close();
// 	}
// }

// function closeAllMidiOutputs() {
// 	for (const output of WebMidi.outputs) {
// 		output.close();
// 	}
// 	console.log('All MIDI outputs closed');
// 	console.table(
// 		WebMidi.outputs.map((output) => ({
// 			name: output.name,
// 			manufacturer: output.manufacturer,
// 			state: output.state,
// 			connection: output.connection
// 		}))
// 	);
// }

function addMidiInputOptions() {
	if (WebMidi.inputs.length === 0) {
		midiInputs.set([{ name: 'NO MIDI INPUT AVAILABLE', value: '' }]);
	} else {
		midiInputs.set([
			{ name: 'DISABLED', value: 'DISABLED' },
			...WebMidi.inputs.map((input) => ({
				name: input.name,
				value: input.name
			}))
		]);
		if (WebMidi.inputs.find((input) => input.name === 'loopMIDI Port')) {
			console.log('LoopMIDI port found. Set as default because it works well.');
			selectedMidiInputMTC.set('loopMIDI Port');
		} else {
			selectedMidiInputMTC.set('DISABLED');
		}
		selectedMidiInputSPP.set('DISABLED');
	}
}

function startMtcListening() {
	if (WebMidi.enabled) {
		const input = getSelectedMidiInput('MTC');
		console.log('MTC listener starting on port ', input?.name);
		if (input) {
			console.info(`Listening for MTC messages from ${input.name}...`);
			input.addListener('sysex', onSysexMessage);
			input.addListener('timecode', onMtcMessage);
			input.addListener('start', onStartMessage);
			input.addListener('continue', onContinueMessage);
			input.addListener('stop', onStopMessage);
			input.addListener('songposition', onSPPMessage);
		} else {
			console.warn(`MIDI input not found`);
		}
	}
}

function startMidiClockListening() {
	if (WebMidi.enabled) {
		const input = getSelectedMidiInput('SPP');
		console.log('Clock listener starting on port ', input?.name);
		if (input) {
			console.info(`Listening for clock messages from ${input.name}...`);
			input.addListener('clock', onMidiClockMessage);
		} else {
			console.warn(`MIDI input not found`);
		}
	}
}

// function stopMidiClockLisening() {
// 	if (WebMidi.enabled) {
// 		console.log('Clock listener stopping');
// 		// Remove all listeners
// 		for (const input of WebMidi.inputs) {
// 			input.removeListener('clock');
// 			console.info(`Removed listeners for CLOCK from ${input.name}...`);
// 		}
// 	}
// }

function stopMtcAndSPPListeners() {
	if (WebMidi.enabled) {
		console.log('MTC and clock listener stopping');
		// Remove all listeners
		for (const input of WebMidi.inputs) {
			input.removeListener();
			console.info(`Removed listeners for ALL messages from ${input.name}...`);
		}
	}
}

export function startSPPListening() {
	const input = getSelectedMidiInput('SPP');
	console.log('SPP listener starting on port ', input?.name);

	if (WebMidi.enabled && input) {
		// input.addListener('clock', onMidiClockMessage);
		input.addListener('songposition', onSPPMessage);
		// input.addListener('sysex', onSysexMessage);
		input.addListener('start', onStartMessage);
		input.addListener('continue', onContinueMessage);
		input.addListener('stop', onStopMessage);
	} else if (!WebMidi.enabled) {
		console.warn('WEBMIDI not enabled. Cannot start SPP listener.');
	} else {
		console.warn(`MIDI input not found`);
	}
}

function getSelectedMidiInput(syncMode = 'MTC') {
	if (syncMode === 'MTC') {
		return WebMidi.getInputByName(get(selectedMidiInputMTC));
	} else if (syncMode === 'SPP') {
		return WebMidi.getInputByName(get(selectedMidiInputSPP));
	}
}

function logListOfInputs() {
	if (WebMidi.enabled) {
		console.log('List of available MIDI inputs:');
		console.table(
			WebMidi.inputs.map((input) => ({
				name: input.name,
				manufacturer: input.manufacturer,
				state: input.state,
				connection: input.connection
			}))
		);
	} else {
		console.warn('WEBMIDI not enabled. Cannot log list of available MIDI inputs.');
	}
}

export function refreshPorts() {
	console.log('Refreshing MIDI ports');
	if (WebMidi.enabled) {
		logListOfInputs();
		stopMtcAndSPPListeners();
		midiInputs.set([]);
		WebMidi.disable();
	} else {
		console.log('WebMidi is already stopped');
	}
	// empty midiInputs store
	startWebMidi();
	addMidiInputOptions();
}

export function onStartMessage() {
	console.log('Received start message');
	startPlaying();
	seekPosition();
}

export function onContinueMessage() {
	startPlaying();
	seekPosition();
}

export function onStopMessage(midiData: { type: string } | null) {
	if (midiData === null) {
		console.error('Received null stop message');
		return;
	}
	if (midiData.type === 'stop') {
		console.log('Received stop message');
		videoPlayerStore.pause();

		// Clear any pending seek operation
		if (seekTimeout !== null) {
			clearTimeout(seekTimeout);
			seekTimeout = null;
		}
	}
	isPlaying.set(false);
	sppData.set({
		...get(sppData),
		secondsOnSPP: 0
	});
	console.log('Stopped playing. isPLaying:', get(isPlaying));
}

let seekTimeout: ReturnType<typeof setTimeout> | null = null;

export function seekPosition(): void {
	if (seekTimeout !== null) {
		clearTimeout(seekTimeout);
	}

	const debounceTime = 0;

	seekTimeout = setTimeout(() => {
		let data: SPPData | MTCData;
		let seekTime;
		if (syncMode() === 'MTC') {
			data = get(mtcData);
		} else if (syncMode() === 'SPP') {
			data = get(sppData);
		} else {
			throw new Error('Invalid sync mode');
		}
		if (data && typeof data.seekPosition === 'number') {
			seekTime = data.seekPosition + debounceTime / 1000;
			console.log('Seeking to:', seekTime, 'seconds');
			videoPlayerStore.seek(seekTime);
		} else {
			console.warn('Invalid data for seeking');
		}
	}, debounceTime); // 0ms debounce
}

export function startPlaying() {
	isPlaying.set(true);
	videoPlayerStore.play();
}
