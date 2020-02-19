// modules are defined as an array
// [ module function, map of requires ]
//
// map of requires is short require name -> numeric require
//
// anything defined in a previous bundle is accessed via the
// orig method which is the require for previous bundles
parcelRequire = (function (modules, cache, entry, globalName) {
  // Save the require from previous bundle to this closure if any
  var previousRequire = typeof parcelRequire === 'function' && parcelRequire;
  var nodeRequire = typeof require === 'function' && require;

  function newRequire(name, jumped) {
    if (!cache[name]) {
      if (!modules[name]) {
        // if we cannot find the module within our internal map or
        // cache jump to the current global require ie. the last bundle
        // that was added to the page.
        var currentRequire = typeof parcelRequire === 'function' && parcelRequire;
        if (!jumped && currentRequire) {
          return currentRequire(name, true);
        }

        // If there are other bundles on this page the require from the
        // previous one is saved to 'previousRequire'. Repeat this as
        // many times as there are bundles until the module is found or
        // we exhaust the require chain.
        if (previousRequire) {
          return previousRequire(name, true);
        }

        // Try the node require function if it exists.
        if (nodeRequire && typeof name === 'string') {
          return nodeRequire(name);
        }

        var err = new Error('Cannot find module \'' + name + '\'');
        err.code = 'MODULE_NOT_FOUND';
        throw err;
      }

      localRequire.resolve = resolve;
      localRequire.cache = {};

      var module = cache[name] = new newRequire.Module(name);

      modules[name][0].call(module.exports, localRequire, module, module.exports, this);
    }

    return cache[name].exports;

    function localRequire(x){
      return newRequire(localRequire.resolve(x));
    }

    function resolve(x){
      return modules[name][1][x] || x;
    }
  }

  function Module(moduleName) {
    this.id = moduleName;
    this.bundle = newRequire;
    this.exports = {};
  }

  newRequire.isParcelRequire = true;
  newRequire.Module = Module;
  newRequire.modules = modules;
  newRequire.cache = cache;
  newRequire.parent = previousRequire;
  newRequire.register = function (id, exports) {
    modules[id] = [function (require, module) {
      module.exports = exports;
    }, {}];
  };

  var error;
  for (var i = 0; i < entry.length; i++) {
    try {
      newRequire(entry[i]);
    } catch (e) {
      // Save first error but execute all entries
      if (!error) {
        error = e;
      }
    }
  }

  if (entry.length) {
    // Expose entry point to Node, AMD or browser globals
    // Based on https://github.com/ForbesLindesay/umd/blob/master/template.js
    var mainExports = newRequire(entry[entry.length - 1]);

    // CommonJS
    if (typeof exports === "object" && typeof module !== "undefined") {
      module.exports = mainExports;

    // RequireJS
    } else if (typeof define === "function" && define.amd) {
     define(function () {
       return mainExports;
     });

    // <script>
    } else if (globalName) {
      this[globalName] = mainExports;
    }
  }

  // Override the current require with this new one
  parcelRequire = newRequire;

  if (error) {
    // throw error from earlier, _after updating parcelRequire_
    throw error;
  }

  return newRequire;
})({"lib/wave-encoder.js":[function(require,module,exports) {

},{}],"lib/index.js":[function(require,module,exports) {
var AudioContext = window.AudioContext || window.webkitAudioContext;

function createWorker(fn) {
  var js = fn.toString().replace(/^function\s*\(\)\s*{/, '').replace(/}$/, '');
  var blob = new Blob([js]);
  return new Worker(URL.createObjectURL(blob));
}

function error(method) {
  var event = new Event('error');
  event.data = new Error('Wrong state for ' + method);
  return event;
}

var context, processor;
/**
 * Audio Recorder with MediaRecorder API.
 *
 * @param {MediaStream} stream The audio stream to record.
 *
 * @example
 * navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
 *   var recorder = new MediaRecorder(stream)
 * })
 *
 * @class
 */

function MediaRecorder(stream) {
  /**
   * The `MediaStream` passed into the constructor.
   * @type {MediaStream}
   */
  this.stream = stream;
  /**
   * The current state of recording process.
   * @type {"inactive"|"recording"|"paused"}
   */

  this.state = 'inactive';
  this.em = document.createDocumentFragment();
  this.encoder = createWorker(MediaRecorder.encoder);
  var recorder = this;
  this.encoder.addEventListener('message', function (e) {
    var event = new Event('dataavailable');
    event.data = new Blob([e.data], {
      type: recorder.mimeType
    });
    recorder.em.dispatchEvent(event);

    if (recorder.state === 'inactive') {
      recorder.em.dispatchEvent(new Event('stop'));
    }
  });
}

MediaRecorder.prototype = {
  /**
   * The MIME type that is being used for recording.
   * @type {string}
   */
  mimeType: 'audio/wav',

  /**
   * Begins recording media.
   *
   * @param {number} [timeslice] The milliseconds to record into each `Blob`.
   *                             If this parameter isn’t included, single `Blob`
   *                             will be recorded.
   *
   * @return {undefined}
   *
   * @example
   * recordButton.addEventListener('click', function () {
   *   recorder.start()
   * })
   */
  start: function start(timeslice) {
    if (this.state !== 'inactive') {
      return this.em.dispatchEvent(error('start'));
    }

    this.state = 'recording';

    if (!context) {
      context = new AudioContext();
    }

    this.clone = this.stream.clone();
    var input = context.createMediaStreamSource(this.clone);

    if (!processor) {
      processor = context.createScriptProcessor(2048, 1, 1);
    }

    var recorder = this;

    processor.onaudioprocess = function (e) {
      if (recorder.state === 'recording') {
        recorder.encoder.postMessage(['encode', e.inputBuffer.getChannelData(0)]);
      }
    };

    input.connect(processor);
    processor.connect(context.destination);
    this.em.dispatchEvent(new Event('start'));

    if (timeslice) {
      this.slicing = setInterval(function () {
        if (recorder.state === 'recording') recorder.requestData();
      }, timeslice);
    }

    return undefined;
  },

  /**
   * Stop media capture and raise `dataavailable` event with recorded data.
   *
   * @return {undefined}
   *
   * @example
   * finishButton.addEventListener('click', function () {
   *   recorder.stop()
   * })
   */
  stop: function stop() {
    if (this.state === 'inactive') {
      return this.em.dispatchEvent(error('stop'));
    }

    this.requestData();
    this.state = 'inactive';
    this.clone.getTracks().forEach(function (track) {
      track.stop();
    });
    return clearInterval(this.slicing);
  },

  /**
   * Pauses recording of media streams.
   *
   * @return {undefined}
   *
   * @example
   * pauseButton.addEventListener('click', function () {
   *   recorder.pause()
   * })
   */
  pause: function pause() {
    if (this.state !== 'recording') {
      return this.em.dispatchEvent(error('pause'));
    }

    this.state = 'paused';
    return this.em.dispatchEvent(new Event('pause'));
  },

  /**
   * Resumes media recording when it has been previously paused.
   *
   * @return {undefined}
   *
   * @example
   * resumeButton.addEventListener('click', function () {
   *   recorder.resume()
   * })
   */
  resume: function resume() {
    if (this.state !== 'paused') {
      return this.em.dispatchEvent(error('resume'));
    }

    this.state = 'recording';
    return this.em.dispatchEvent(new Event('resume'));
  },

  /**
   * Raise a `dataavailable` event containing the captured media.
   *
   * @return {undefined}
   *
   * @example
   * this.on('nextData', function () {
   *   recorder.requestData()
   * })
   */
  requestData: function requestData() {
    if (this.state === 'inactive') {
      return this.em.dispatchEvent(error('requestData'));
    }

    return this.encoder.postMessage(['dump', context.sampleRate]);
  },

  /**
   * Add listener for specified event type.
   *
   * @param {"start"|"stop"|"pause"|"resume"|"dataavailable"|"error"}
   * type Event type.
   * @param {function} listener The listener function.
   *
   * @return {undefined}
   *
   * @example
   * recorder.addEventListener('dataavailable', function (e) {
   *   audio.src = URL.createObjectURL(e.data)
   * })
   */
  addEventListener: function addEventListener() {
    this.em.addEventListener.apply(this.em, arguments);
  },

  /**
   * Remove event listener.
   *
   * @param {"start"|"stop"|"pause"|"resume"|"dataavailable"|"error"}
   * type Event type.
   * @param {function} listener The same function used in `addEventListener`.
   *
   * @return {undefined}
   */
  removeEventListener: function removeEventListener() {
    this.em.removeEventListener.apply(this.em, arguments);
  },

  /**
   * Calls each of the listeners registered for a given event.
   *
   * @param {Event} event The event object.
   *
   * @return {boolean} Is event was no canceled by any listener.
   */
  dispatchEvent: function dispatchEvent() {
    this.em.dispatchEvent.apply(this.em, arguments);
  }
  /**
   * Returns `true` if the MIME type specified is one the polyfill can record.
   *
   * This polyfill supports `audio/wav` and `audio/mpeg`.
   *
   * @param {string} mimeType The mimeType to check.
   *
   * @return {boolean} `true` on `audio/wav` and `audio/mpeg` MIME type.
   */

};

MediaRecorder.isTypeSupported = function isTypeSupported(mimeType) {
  return MediaRecorder.prototype.mimeType === mimeType;
};
/**
 * `true` if MediaRecorder can not be polyfilled in the current browser.
 * @type {boolean}
 *
 * @example
 * if (MediaRecorder.notSupported) {
 *   showWarning('Audio recording is not supported in this browser')
 * }
 */


MediaRecorder.notSupported = !navigator.mediaDevices || !AudioContext;
/**
 * Converts RAW audio buffer to compressed audio files.
 * It will be loaded to Web Worker.
 * By default, WAVE encoder will be used.
 * @type {function}
 *
 * @example
 * MediaRecorder.prototype.mimeType = 'audio/ogg'
 * MediaRecorder.encoder = oggEncoder
 */

MediaRecorder.encoder = require('./wave-encoder');
module.exports = MediaRecorder;
},{"./wave-encoder":"lib/wave-encoder.js"}],"lib/mpeg-encoder.js":[function(require,module,exports) {
module.exports = function () {
  importScripts('https://cdnjs.cloudflare.com/ajax/libs/lamejs/1.2.0/lame.min.js');
  var CHANNELS = 1;
  var KBPS = 128;
  var SAMPLE_RATE = 44100;
  var encoder = new lamejs.Mp3Encoder(CHANNELS, SAMPLE_RATE, KBPS);
  var recorded = new Int8Array();

  function concat(a, b) {
    if (b.length === 0) {
      return a;
    }

    var c = new Int8Array(a.length + b.length);
    c.set(a);
    c.set(b, a.length);
    return c;
  }

  function encode(buffer) {
    for (var i = 0; i < buffer.length; i++) {
      buffer[i] = buffer[i] * 32767.5;
    }

    var buf = encoder.encodeBuffer(buffer);
    recorded = concat(recorded, buf);
  }

  function dump() {
    var buf = encoder.flush();
    recorded = concat(recorded, buf);
    var buffer = recorded.buffer;
    recorded = new Int8Array();
    postMessage(buffer, [buffer]);
  }

  onmessage = function onmessage(e) {
    if (e.data[0] === 'encode') {
      encode(e.data[1]);
    } else {
      dump(e.data[1]);
    }
  };
};
},{}],"index.js":[function(require,module,exports) {
var recorder;
var recordButton = document.querySelector('#recordButton');
var stopButton = document.querySelector('#stopButton');
var audio = document.querySelector('#audio');
var playButton = document.querySelector('#playButton');
window.MediaRecorder = require('./lib/index');
window.MediaRecorder.encoder = require('./lib/mpeg-encoder');
window.MediaRecorder.prototype.mimeType = 'audio/mpeg';
recordButton.addEventListener('click', function () {
  // Request permissions to record audio
  navigator.mediaDevices.getUserMedia({
    audio: true
  }).then(function (stream) {
    recorder = new MediaRecorder(stream); // Set record to <audio> when recording will be finished

    recorder.addEventListener('dataavailable', function (e) {
      audio.src = URL.createObjectURL(e.data);
    }); // Start recording

    recorder.start();
  });
});
stopButton.addEventListener('click', function () {
  // Stop recording
  recorder.stop(); // Remove “recording” icon from browser tab

  recorder.stream.getTracks().forEach(function (i) {
    return i.stop();
  });
});
playButton.addEventListener('click', function () {
  audio.play();
});
},{"./lib/index":"lib/index.js","./lib/mpeg-encoder":"lib/mpeg-encoder.js"}],"../../AppData/Roaming/npm/node_modules/parcel-bundler/src/builtins/hmr-runtime.js":[function(require,module,exports) {
var global = arguments[3];
var OVERLAY_ID = '__parcel__error__overlay__';
var OldModule = module.bundle.Module;

function Module(moduleName) {
  OldModule.call(this, moduleName);
  this.hot = {
    data: module.bundle.hotData,
    _acceptCallbacks: [],
    _disposeCallbacks: [],
    accept: function (fn) {
      this._acceptCallbacks.push(fn || function () {});
    },
    dispose: function (fn) {
      this._disposeCallbacks.push(fn);
    }
  };
  module.bundle.hotData = null;
}

module.bundle.Module = Module;
var checkedAssets, assetsToAccept;
var parent = module.bundle.parent;

if ((!parent || !parent.isParcelRequire) && typeof WebSocket !== 'undefined') {
  var hostname = "" || location.hostname;
  var protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  var ws = new WebSocket(protocol + '://' + hostname + ':' + "51043" + '/');

  ws.onmessage = function (event) {
    checkedAssets = {};
    assetsToAccept = [];
    var data = JSON.parse(event.data);

    if (data.type === 'update') {
      var handled = false;
      data.assets.forEach(function (asset) {
        if (!asset.isNew) {
          var didAccept = hmrAcceptCheck(global.parcelRequire, asset.id);

          if (didAccept) {
            handled = true;
          }
        }
      }); // Enable HMR for CSS by default.

      handled = handled || data.assets.every(function (asset) {
        return asset.type === 'css' && asset.generated.js;
      });

      if (handled) {
        console.clear();
        data.assets.forEach(function (asset) {
          hmrApply(global.parcelRequire, asset);
        });
        assetsToAccept.forEach(function (v) {
          hmrAcceptRun(v[0], v[1]);
        });
      } else {
        window.location.reload();
      }
    }

    if (data.type === 'reload') {
      ws.close();

      ws.onclose = function () {
        location.reload();
      };
    }

    if (data.type === 'error-resolved') {
      console.log('[parcel] ✨ Error resolved');
      removeErrorOverlay();
    }

    if (data.type === 'error') {
      console.error('[parcel] 🚨  ' + data.error.message + '\n' + data.error.stack);
      removeErrorOverlay();
      var overlay = createErrorOverlay(data);
      document.body.appendChild(overlay);
    }
  };
}

function removeErrorOverlay() {
  var overlay = document.getElementById(OVERLAY_ID);

  if (overlay) {
    overlay.remove();
  }
}

function createErrorOverlay(data) {
  var overlay = document.createElement('div');
  overlay.id = OVERLAY_ID; // html encode message and stack trace

  var message = document.createElement('div');
  var stackTrace = document.createElement('pre');
  message.innerText = data.error.message;
  stackTrace.innerText = data.error.stack;
  overlay.innerHTML = '<div style="background: black; font-size: 16px; color: white; position: fixed; height: 100%; width: 100%; top: 0px; left: 0px; padding: 30px; opacity: 0.85; font-family: Menlo, Consolas, monospace; z-index: 9999;">' + '<span style="background: red; padding: 2px 4px; border-radius: 2px;">ERROR</span>' + '<span style="top: 2px; margin-left: 5px; position: relative;">🚨</span>' + '<div style="font-size: 18px; font-weight: bold; margin-top: 20px;">' + message.innerHTML + '</div>' + '<pre>' + stackTrace.innerHTML + '</pre>' + '</div>';
  return overlay;
}

function getParents(bundle, id) {
  var modules = bundle.modules;

  if (!modules) {
    return [];
  }

  var parents = [];
  var k, d, dep;

  for (k in modules) {
    for (d in modules[k][1]) {
      dep = modules[k][1][d];

      if (dep === id || Array.isArray(dep) && dep[dep.length - 1] === id) {
        parents.push(k);
      }
    }
  }

  if (bundle.parent) {
    parents = parents.concat(getParents(bundle.parent, id));
  }

  return parents;
}

function hmrApply(bundle, asset) {
  var modules = bundle.modules;

  if (!modules) {
    return;
  }

  if (modules[asset.id] || !bundle.parent) {
    var fn = new Function('require', 'module', 'exports', asset.generated.js);
    asset.isNew = !modules[asset.id];
    modules[asset.id] = [fn, asset.deps];
  } else if (bundle.parent) {
    hmrApply(bundle.parent, asset);
  }
}

function hmrAcceptCheck(bundle, id) {
  var modules = bundle.modules;

  if (!modules) {
    return;
  }

  if (!modules[id] && bundle.parent) {
    return hmrAcceptCheck(bundle.parent, id);
  }

  if (checkedAssets[id]) {
    return;
  }

  checkedAssets[id] = true;
  var cached = bundle.cache[id];
  assetsToAccept.push([bundle, id]);

  if (cached && cached.hot && cached.hot._acceptCallbacks.length) {
    return true;
  }

  return getParents(global.parcelRequire, id).some(function (id) {
    return hmrAcceptCheck(global.parcelRequire, id);
  });
}

function hmrAcceptRun(bundle, id) {
  var cached = bundle.cache[id];
  bundle.hotData = {};

  if (cached) {
    cached.hot.data = bundle.hotData;
  }

  if (cached && cached.hot && cached.hot._disposeCallbacks.length) {
    cached.hot._disposeCallbacks.forEach(function (cb) {
      cb(bundle.hotData);
    });
  }

  delete bundle.cache[id];
  bundle(id);
  cached = bundle.cache[id];

  if (cached && cached.hot && cached.hot._acceptCallbacks.length) {
    cached.hot._acceptCallbacks.forEach(function (cb) {
      cb();
    });

    return true;
  }
}
},{}]},{},["../../AppData/Roaming/npm/node_modules/parcel-bundler/src/builtins/hmr-runtime.js","index.js"], null)
//# sourceMappingURL=/webm-test.e31bb0bc.js.map