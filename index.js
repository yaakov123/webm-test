let recorder
let recordButton = document.querySelector('#recordButton');
let stopButton = document.querySelector('#stopButton');
let audio = document.querySelector('#audio');
let playButton = document.querySelector('#playButton');

window.MediaRecorder = require('./lib/index');
window.MediaRecorder.encoder = require('./lib/mpeg-encoder');
window.MediaRecorder.prototype.mimeType = 'audio/mpeg'

recordButton.addEventListener('click', () => {
  // Request permissions to record audio
  navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
    recorder = new MediaRecorder(stream)

    // Set record to <audio> when recording will be finished
    recorder.addEventListener('dataavailable', e => {
      audio.src = URL.createObjectURL(e.data)
    })

    // Start recording
    recorder.start();
  })
})

stopButton.addEventListener('click', () => {
  // Stop recording
  recorder.stop()
  // Remove “recording” icon from browser tab
  recorder.stream.getTracks().forEach(i => i.stop())
})

playButton.addEventListener('click', () => {
  audio.play();
})

